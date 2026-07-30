import 'dotenv/config';
import Fastify from 'fastify';
import { prisma } from './prisma';
import { redis } from './redis';
import crypto from 'crypto';
import axios from 'axios';
import * as line from '@line/bot-sdk';
import { startScheduler } from './scheduler';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import adminRoutes from './routes/admin';
import unlockRoutes from './routes/unlock';
import analyticsRoutes from './routes/analytics';
import superadminRoutes from './routes/superadmin';

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
    fileSize: 15 * 1024 * 1024, // 15MB limit
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

// Initialize LINE client
const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
});

import { fetchTrendingForEvent } from './services/trendingScraper';
import { Client as QStashClient } from '@upstash/qstash';

const qstash = new QStashClient({
  token: process.env.QSTASH_TOKEN || 'mock-token-for-dev'
});


// API: Health check & Config
server.get('/health', async (_request, _reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString()
  };
});

// 新增 /api/health 為了避免 Vite proxy 沒重開抓不到
server.get('/api/health', async (_request, _reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString()
  };
});

// 註冊 Admin API 路由
server.register(adminRoutes, { prefix: '/api/admin' });
server.register(unlockRoutes, { prefix: '/api/unlock' });
server.register(analyticsRoutes, { prefix: '/api/analytics' });
server.register(superadminRoutes, { prefix: '/api/superadmin' });

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
  
  // Store token in Redis with a TTL of 60 seconds (for dynamic refresh)
  // The value can be a JSON string with the eventId and venueId
  const tokenData = JSON.stringify({ eventId, venueId });
  await redis.setex(`qr_token:${token}`, 60, tokenData);

  return { token, expiresIn: 60 };
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
        // User is outside the geo-fence
        isGeoVerified = false;
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

  // Update EventScanStat only if geo-verified (so unverified users are excluded from stats)
  if (isGeoVerified) {
    await prisma.eventScanStat.upsert({
      where: { eventId },
      update: {
        totalScans: { increment: 1 },
        verifiedScans: { increment: 1 },
        geoVerifiedScans: { increment: 1 },
        lastScannedAt: new Date()
      },
      create: {
        eventId,
        totalScans: 1,
        verifiedScans: 1,
        geoVerifiedScans: 1,
      }
    });
  }

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
    unlockTime: event?.unlockTime,
    isGeoVerified: isGeoVerified
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

// API: LINE Login Auth Redirect
server.get('/api/line/auth', async (request, reply) => {
  const clientId = process.env.LINE_CHANNEL_ID;
  const redirectUri = encodeURIComponent(process.env.LINE_LOGIN_REDIRECT_URI || 'http://localhost:3000/api/line/callback');
  // State 為了安全起見應該要是隨機字串，這裡簡化處理，將 browserToken 當作 state 傳遞
  const browserToken = request.cookies.sessionToken || '';
  
  const authUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${browserToken}&scope=profile%20openid&bot_prompt=normal`;
  
  reply.redirect(authUrl);
});

// API: LINE Login Callback
server.get('/api/line/callback', async (request, reply) => {
  const { code, state, error } = request.query as { code?: string, state?: string, error?: string };
  
  if (error || !code) {
    // 授權失敗或取消，導向回前端並帶上錯誤參數
    return reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/wait?error=auth_failed`);
  }

  try {
    // 1. 使用 code 換取 access_token
    const tokenResponse = await axios.post('https://api.line.me/oauth2/v2.1/token', new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.LINE_LOGIN_REDIRECT_URI || 'http://localhost:3000/api/line/callback',
      client_id: process.env.LINE_CHANNEL_ID || '',
      client_secret: process.env.LINE_CHANNEL_SECRET || ''
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;
    
    // 2. 取得用戶 profile 以獲取 userId
    const profileResponse = await axios.get('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const userId = profileResponse.data.userId;
    
    // 3. 將 userId 綁定到原本的 session (state 就是 browserToken)
    const browserToken = state;
    if (browserToken) {
      await prisma.session.update({
        where: { browserToken },
        data: { lineUserId: userId }
      });
    }
    
    // 4. 成功後導向回前端 WaitRoom
    return reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/wait?line_linked=true`);
  } catch (err) {
    server.log.error(err);
    return reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/wait?error=auth_failed`);
  }
});

// API: Server-Sent Events (SSE) for unlock status
server.get('/api/session/sse', async (request, reply) => {
  const browserToken = request.cookies.sessionToken;
  if (!browserToken) {
    reply.status(401).send({ error: 'Missing session cookie' });
    return;
  }

  // Setup SSE Headers
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  // For CORS if needed, though we run on same origin
  reply.raw.setHeader('Access-Control-Allow-Origin', '*');

  let isClientConnected = true;
  request.raw.on('close', () => {
    isClientConnected = false;
  });

  const checkStatus = async () => {
    if (!isClientConnected) return;

    try {
      const cachedStatus = await redis.get(`session_status:${browserToken}`);
      if (cachedStatus) {
        const parsed = JSON.parse(cachedStatus);
        
        // Lazy unlock
        if (!parsed.isUnlocked && parsed.unlockTime && new Date() >= new Date(parsed.unlockTime)) {
          parsed.isUnlocked = true;
        }

        if (parsed.isUnlocked) {
          reply.raw.write(`data: ${JSON.stringify({ isUnlocked: true })}\n\n`);
          // Note: Node's reply.raw.end() might cause Fastify to complain if called prematurely, but SSE implies manual ending.
          reply.raw.end();
          isClientConnected = false;
          return;
        } else {
          // Send current countdown time
          reply.raw.write(`data: ${JSON.stringify({ unlockTime: parsed.unlockTime })}\n\n`);
        }
      } else {
        // Fallback to DB if Redis is cleared
        const session = await prisma.session.findUnique({ 
          where: { browserToken },
          include: { event: true } 
        });
        
        if (session) {
          let isUnlocked = session.isUnlocked;
          const unlockTime = session.event?.unlockTime;

          if (!isUnlocked && unlockTime && new Date() >= new Date(unlockTime)) {
            isUnlocked = true;
          }

          if (isUnlocked) {
            reply.raw.write(`data: ${JSON.stringify({ isUnlocked: true })}\n\n`);
            reply.raw.end();
            isClientConnected = false;
            return;
          } else {
            reply.raw.write(`data: ${JSON.stringify({ unlockTime })}\n\n`);
          }
        }
      }
    } catch (err) {
      console.error('[SSE Error]', err);
    }
  };

  // Initial check
  await checkStatus();

  // Schedule internal polling every 2 seconds
  const interval = setInterval(() => {
    if (isClientConnected) {
      checkStatus();
    } else {
      clearInterval(interval);
    }
  }, 2000);

  // Clear interval on disconnect
  request.raw.on('close', () => {
    clearInterval(interval);
  });
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

    // 3. 找出所有訂閱推播的觀眾，發送 LINE 通知
    const pushPromises = sessions
      .filter(s => s.lineUserId)
      .map(async (s) => {
        try {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          await lineClient.pushMessage({
            to: s.lineUserId as string,
            messages: [{
              type: 'text',
              text: `彩蛋已解鎖！\n您觀看的活動已結束，點擊查看專屬深度討論與彩蛋解析：\n${frontendUrl}/unlock/${eventId}`
            }]
          });
          // 同步更新每位使用者的 Redis 狀態快取，讓等候室瞬間放行
          await redis.setex(`session_status:${s.browserToken}`, 3600, JSON.stringify({
            isUnlocked: true,
            unlockTime: new Date()
          }));
        } catch (e) {
          server.log.error(e as Error, `LINE Push failed for ${s.lineUserId}`);
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

// 診斷工具 API (用於排解無法收到推播的問題)
server.get('/api/diagnostics', async (_request, reply) => {
  try {
    const publicUrl = (process.env.PUBLIC_URL || 'https://auto-publisher.vercel.app').replace(/\/$/, '');
    const hasQstashToken = !!process.env.QSTASH_TOKEN;
    const hasLineToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    let qstashTest = 'Not Tested';
    let lineTest = 'Not Tested';

    // 1. 測試 QStash
    if (hasQstashToken) {
      try {
        const res = await qstash.publishJSON({
          url: `${publicUrl}/api/diagnostics`, // dummy self-ping
          body: { test: true }
        });
        qstashTest = `Success (MessageID: ${res.messageId})`;
      } catch (err: any) {
        qstashTest = `Failed: ${err.message}`;
      }
    } else {
      qstashTest = 'Failed: QSTASH_TOKEN missing';
    }

    // 2. 測試 LINE 推播 (找最近一個綁定 LINE 的用戶測試發送)
    if (hasLineToken) {
      const session = await prisma.session.findFirst({
        where: { lineUserId: { not: null } },
        orderBy: { verifiedAt: 'desc' }
      });
      if (session && session.lineUserId) {
        try {
          await lineClient.pushMessage({
            to: session.lineUserId,
            messages: [{ type: 'text', text: '系統診斷：這是一條測試推播。若您收到，代表 LINE 推播功能完全正常！' }]
          });
          lineTest = `Success (Sent to: ${session.lineUserId.substring(0,5)}...)`;
        } catch (err: any) {
          lineTest = `Failed: ${err.message || (err.response && JSON.stringify(err.response.data))}`;
        }
      } else {
        lineTest = 'Skipped: No LINE user found in database';
      }
    } else {
      lineTest = 'Failed: LINE_CHANNEL_ACCESS_TOKEN missing';
    }

    return {
      publicUrl,
      hasQstashToken,
      hasLineToken,
      qstashTest,
      lineTest,
      suggestion: '如果 qstashTest 失敗，請檢查 QSTASH_TOKEN。如果 lineTest 失敗，請檢查 LINE Provider 是否一致或是否已加好友。'
    };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
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
