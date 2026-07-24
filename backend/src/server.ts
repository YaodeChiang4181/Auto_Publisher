import Fastify from 'fastify';
import { prisma } from './prisma';
import { redis } from './redis';
import crypto from 'crypto';
import webpush from 'web-push';
import { startScheduler } from './scheduler';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import adminRoutes from './routes/admin';
import unlockRoutes from './routes/unlock';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id: string;
      username: string;
      role: string;
      venueId: string | null;
    }
  }
}

const server = Fastify({ logger: true });

// Register JWT
server.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'super-secret-fallback-key'
});

// Register Rate Limit
server.register(fastifyRateLimit, {
  max: 100, // Default 100 reqs per minute
  timeWindow: '1 minute',
  redis: redis // [Feature] Use Redis for scalable rate-limiting across nodes
});

// Register Cookie
server.register(fastifyCookie, {
  secret: process.env.COOKIE_SECRET || 'my-cookie-secret',
  hook: 'onRequest'
});

// Register Multipart (for file uploads)
server.register(fastifyMultipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Register Static for serving uploaded ads
// [Bugfix] tsx ESM 模式下 __dirname 可能回傳 '.' 而非絕對路徑，改用 process.cwd()
server.register(fastifyStatic, {
  root: path.resolve(process.cwd(), 'uploads'),
  prefix: '/uploads/',
});

// Helper: Haversine distance formula
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
}

// Add authenticate decorator
server.decorate('authenticate', async function (request: any, reply: any) {
  try {
    const token = request.cookies.adminToken;
    if (!token) throw new Error('Missing adminToken cookie');
    const decoded = server.jwt.verify(token);
    request.user = decoded;
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// 讀取正式環境的 VAPID Keys，若無則生成測試用 Keys
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || webpush.generateVAPIDKeys().publicKey,
  privateKey: process.env.VAPID_PRIVATE_KEY || webpush.generateVAPIDKeys().privateKey
};
webpush.setVapidDetails(
  'mailto:admin@autopublisher.local',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

import { fetchTrendingForEvent } from './services/trendingScraper';


// API: Health check & Config
server.get('/health', async (_request, _reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    vapidPublicKey: vapidKeys.publicKey // 讓前端取得公鑰以建立推播訂閱
  };
});

// 新增 /api/health 為了避免 Vite proxy 沒重開抓不到
server.get('/api/health', async (_request, _reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    vapidPublicKey: vapidKeys.publicKey
  };
});

// 註冊 Admin API 路由
server.register(adminRoutes, { prefix: '/api/admin' });
server.register(unlockRoutes, { prefix: '/api/unlock' });

// API: Generate Dynamic QR Code Token
// Request expects: ?eventId=xxx&venueId=yyy
server.get('/api/qr/token', async (request, reply) => {
  const { eventId, venueId } = request.query as { eventId?: string; venueId?: string };

  if (!eventId || !venueId) {
    return reply.status(400).send({ error: 'Missing eventId or venueId' });
  }

  // Check if Event exists (Strict validation for POC)
  const eventExists = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!eventExists) {
    return reply.status(404).send({ error: 'Event not found' });
  }

  // Generate a short-lived token
  const token = crypto.randomBytes(16).toString('hex');
  
  // Store token in Redis with a TTL of 10 seconds (for dynamic refresh)
  // The value can be a JSON string with the eventId and venueId
  const tokenData = JSON.stringify({ eventId, venueId });
  await redis.setex(`qr_token:${token}`, 10, tokenData);

  return { token, expiresIn: 10 };
});

// API: Verify Token & Create Anonymous Session (QR Scan)
// Request expects: ?token=xxx (plus optional geoLat, geoLng for geo-fencing)
server.get('/api/qr/scan', {
  config: {
    rateLimit: { max: 300, timeWindow: '1 minute' } // 放寬至 300 次以應付散場連同個 Wi-Fi 的人潮
  }
}, async (request, reply) => {
  const { token, geoLat, geoLng } = request.query as { token?: string, geoLat?: string, geoLng?: string };

  if (!token) {
    return reply.status(400).send({ error: 'Token is required' });
  }

  // Verify the token in Redis
  const tokenDataStr = await redis.get(`qr_token:${token}`);
  if (!tokenDataStr) {
    return reply.status(403).send({ error: 'Invalid or expired token' });
  }

  const { eventId, venueId } = JSON.parse(tokenDataStr);

  let isGeoVerified = false;

  if (geoLat && geoLng) {
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (venue) {
      const distance = getDistanceInMeters(
        parseFloat(geoLat), parseFloat(geoLng),
        venue.geoLat, venue.geoLng
      );
      if (distance <= venue.geoRadius) {
        isGeoVerified = true;
      } else {
        return reply.status(403).send({ error: '您不在活動現場，無法解鎖內容 (Geo-fence failed)' });
      }
    }
  }

  // Create an anonymous Session for the user
  const browserToken = crypto.randomBytes(32).toString('hex');

  // Upsert the session into Postgres
  await prisma.session.create({
    data: {
      eventId,
      browserToken,
      verifiedAt: new Date(),
      isUnlocked: false
    }
  });

  // Update EventScanStat
  await prisma.eventScanStat.upsert({
    where: { eventId },
    update: {
      totalScans: { increment: 1 },
      verifiedScans: { increment: 1 },
      geoVerifiedScans: isGeoVerified ? { increment: 1 } : undefined,
      lastScannedAt: new Date()
    },
    create: {
      eventId,
      totalScans: 1,
      verifiedScans: 1,
      geoVerifiedScans: isGeoVerified ? 1 : 0,
    }
  });

  // Calculate remaining time for the Event to finish (Time-Lock)
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  let ttl = 300; // fallback
  if (event) {
    ttl = Math.max(1, Math.floor((event.unlockTime.getTime() - Date.now()) / 1000));
  }
  await redis.setex(`session_timelock:${browserToken}`, ttl, 'locked');
  
  // [Performance] 將初始狀態直接快取到 Redis，避免後續輪詢打爆 DB
  await redis.setex(`session_status:${browserToken}`, ttl + 3600, JSON.stringify({
    isUnlocked: false,
    unlockTime: event?.unlockTime
  }));

  // [Bugfix] 移除單次使用的 QR Token 刪除邏輯，允許多人同時掃描同一個 10 秒內的畫面
  // await redis.del(`qr_token:${token}`);

  // Set sessionToken as HttpOnly Cookie
  reply.setCookie('sessionToken', browserToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });

  return {
    success: true,
    message: 'Verification successful. Welcome to the event!',
    eventId
  };
});

// API: Subscribe to Web Push
server.post('/api/push/subscribe', {
  config: {
    rateLimit: { max: 300, timeWindow: '1 minute' } // 放寬與掃描同等，因爲會是一起動作的
  }
}, async (request, reply) => {
  const { subscription } = request.body as { subscription: any };
  const browserToken = request.cookies.sessionToken;

  if (!browserToken || !subscription) {
    return reply.status(400).send({ error: 'Missing session cookie or subscription' });
  }

  // 將訂閱資訊存入 Session
  await prisma.session.update({
    where: { browserToken },
    data: { pushSub: subscription }
  });

  return { success: true };
});

// API: Polling fallback for unlock status
server.get('/api/session/status', {
  config: {
    rateLimit: { max: 1000, timeWindow: '1 minute' } // 允許 1000 次輪詢，保護伺服器但完全滿足散場人數
  }
}, async (request, reply) => {
  const browserToken = request.cookies.sessionToken;
  if (!browserToken) return reply.status(401).send({ error: 'Missing session cookie' });

  // [Performance] 第一關：直接從 Redis 記憶體拿狀態 (0 毫秒極速，保護 DB)
  const cachedStatus = await redis.get(`session_status:${browserToken}`);
  if (cachedStatus) {
    const parsed = JSON.parse(cachedStatus);
    // [Fallback] 懶惰解鎖 (Lazy Unlock)：萬一 QStash 沒觸發或在本地測試，若時間到了就直接回傳解鎖
    if (!parsed.isUnlocked && parsed.unlockTime && new Date() >= new Date(parsed.unlockTime)) {
      parsed.isUnlocked = true;
    }
    return parsed;
  }

  // 第二關：如果記憶體沒有 (例如重啟)，才去資料庫拿
  const session = await prisma.session.findUnique({ 
    where: { browserToken },
    include: { event: true } 
  });
  if (!session) return reply.status(404).send({ error: 'Session not found' });

  let statusData = { 
    isUnlocked: session.isUnlocked,
    unlockTime: session.event?.unlockTime
  };
  
  // [Fallback] 懶惰解鎖
  if (!statusData.isUnlocked && statusData.unlockTime && new Date() >= new Date(statusData.unlockTime)) {
    statusData.isUnlocked = true;
    // 順便補上非同步的 DB 更新，確保後續資料一致性
    prisma.session.update({ where: { browserToken }, data: { isUnlocked: true } }).catch(() => {});
  }
  
  // 回補快取
  await redis.setex(`session_status:${browserToken}`, 3600, JSON.stringify(statusData));

  return statusData;
});

// API: Fetch active events for frontend selection
server.get('/api/events/active', async (_request, _reply) => {
  const events = await prisma.event.findMany({
    where: { isActive: true },
    include: { 
      venue: {
        include: { adminUsers: true }
      }
    },
    orderBy: { startTime: 'asc' },
    take: 20
  });
  return events;
});

// ==========================================
// QStash Webhooks
// ==========================================

// Webhook 1: 預熱爬蟲 (解鎖前 30 秒觸發)
server.post('/api/webhooks/prewarm', async (request, reply) => {
  // 注意：在正式環境中，請使用 @upstash/qstash Receiver 驗證簽章，防禦偽造請求
  const { eventId, eventName } = request.body as any;
  if (!eventId || !eventName) return reply.status(400).send({ error: 'Missing event details' });
  
  server.log.info(`[QStash] Pre-warming Scraper for Event ${eventName}`);
  try {
    // 預先啟動多源搜尋引擎，這會把結果寫入 Postgres (trendingResult)
    await fetchTrendingForEvent(eventId, eventName);
    return { success: true, message: 'Pre-warmed successfully' };
  } catch (error) {
    server.log.error(error as Error, '[QStash] Pre-warm failed');
    return reply.status(500).send({ error: 'Pre-warm failed' });
  }
});

// Webhook 2: 準點推播與解鎖 (精準於 UnlockTime 觸發)
server.post('/api/webhooks/push', async (request, reply) => {
  const { eventId } = request.body as any;
  if (!eventId) return reply.status(400).send({ error: 'Missing eventId' });

  server.log.info(`[QStash] Exact Unlock Triggered for Event ${eventId}`);
  try {
    // 1. 找出這個 Event 底下所有尚未解鎖的 Session
    const sessions = await prisma.session.findMany({
      where: { eventId, isUnlocked: false }
    });

    if (sessions.length === 0) return { success: true, message: 'No sessions to unlock' };

    // 2. 更新資料庫狀態
    await prisma.session.updateMany({
      where: { eventId, isUnlocked: false },
      data: { isUnlocked: true }
    });

    // 3. 找出所有訂閱推播的觀眾，批量發送通知
    const pushPromises = sessions
      .filter(s => s.pushSub)
      .map(async (s) => {
        try {
          await webpush.sendNotification(
            s.pushSub as unknown as webpush.PushSubscription,
            JSON.stringify({ 
              title: '彩蛋已解鎖！', 
              body: '您觀看的活動已結束，點擊查看專屬深度討論與彩蛋解析。',
              url: `/unlock/${eventId}`
            })
          );
          // 同步更新每位使用者的 Redis 狀態快取，讓等候室瞬間放行
          await redis.setex(`session_status:${s.browserToken}`, 3600, JSON.stringify({
            isUnlocked: true,
            unlockTime: new Date()
          }));
        } catch (e) {
          server.log.error(e as Error, `Push failed for ${s.browserToken}`);
        }
      });
      
    await Promise.all(pushPromises);
    server.log.info(`[QStash] Unlocked ${sessions.length} sessions and sent ${pushPromises.length} pushes.`);
    
    return { success: true, unlocked: sessions.length, pushes: pushPromises.length };
  } catch (error) {
    server.log.error(error as Error, '[QStash] Push Trigger failed');
    return reply.status(500).send({ error: 'Push trigger failed' });
  }
});

// Start the server
const start = async () => {
  try {
    // 啟動雲端常駐排程器 (僅作輔助，核心由 QStash 負責)
    startScheduler();

    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://0.0.0.0:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
