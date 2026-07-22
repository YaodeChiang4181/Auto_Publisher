import Fastify from 'fastify';
import { prisma } from './prisma';
import { redis } from './redis';
import crypto from 'crypto';
import webpush from 'web-push';
import Redis from 'ioredis';
import { startScheduler } from './scheduler';

const server = Fastify({ logger: true });

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

// 為了接收 Redis 鍵值過期事件，我們需要另一個 Redis 連線 (Subscriber)
const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');


// API: Health check & Config
server.get('/health', async (request, reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    vapidPublicKey: vapidKeys.publicKey // 讓前端取得公鑰以建立推播訂閱
  };
});

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
server.get('/api/qr/scan', async (request, reply) => {
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

  // [Optional] Geo-fencing Light verification could be implemented here
  // e.g. check if user's geoLat/geoLng is within Venue's geoRadius

  // Create an anonymous Session for the user
  // We can use a cookie or let the frontend store this browserToken
  const browserToken = crypto.randomBytes(32).toString('hex');

  // Upsert the session into Postgres
  const session = await prisma.session.create({
    data: {
      eventId,
      browserToken,
      verifiedAt: new Date(),
      isUnlocked: false // locked initially (Time-Lock)
    }
  });

  // Calculate remaining time for the Event to finish (Time-Lock)
  // For simplicity, we just set a mock Time-Lock TTL in Redis
  // When this expires, a background job or polling mechanism will unlock the content
  await redis.setex(`session_timelock:${browserToken}`, 300, 'locked'); // 300 seconds as example

  // After successful scan, we might also want to invalidate the QR token immediately (Single-use)
  await redis.del(`qr_token:${token}`);

  return {
    success: true,
    message: 'Verification successful. Welcome to the event!',
    sessionToken: browserToken,
    eventId
  };
});

// API: Subscribe to Web Push
server.post('/api/push/subscribe', async (request, reply) => {
  const { browserToken, subscription } = request.body as { browserToken: string, subscription: any };

  if (!browserToken || !subscription) {
    return reply.status(400).send({ error: 'Missing browserToken or subscription' });
  }

  // 將訂閱資訊存入 Session
  await prisma.session.update({
    where: { browserToken },
    data: { pushSub: subscription }
  });

  return { success: true };
});

// API: Polling fallback for unlock status
server.get('/api/session/status', async (request, reply) => {
  const { browserToken } = request.query as { browserToken?: string };
  if (!browserToken) return reply.status(400).send({ error: 'Missing browserToken' });

  const session = await prisma.session.findUnique({ where: { browserToken } });
  if (!session) return reply.status(404).send({ error: 'Session not found' });

  return { isUnlocked: session.isUnlocked };
});

// API: Fetch active events for frontend selection
server.get('/api/events/active', async (request, reply) => {
  // 撈取最新的前 20 筆事件，包含關聯的場館資訊
  const events = await prisma.event.findMany({
    where: { isActive: true },
    include: { venue: true },
    orderBy: { startTime: 'asc' },
    take: 20
  });
  return events;
});

// Start the server
const start = async () => {
  try {
    // 啟動雲端常駐排程器
    startScheduler();
    // 啟用 Redis 的過期事件通知 (Ex)
    await redis.config('SET', 'notify-keyspace-events', 'Ex');

    // 訂閱過期事件
    redisSub.subscribe('__keyevent@0__:expired', (err) => {
      if (err) server.log.error(err, 'Failed to subscribe to Redis expired events');
    });

    // 處理「離場時間鎖」到期事件
    redisSub.on('message', async (channel, message) => {
      if (message.startsWith('session_timelock:')) {
        const browserToken = message.split(':')[1] as string;
        server.log.info(`Time-Lock expired for session: ${browserToken}`);

        try {
          // 更新資料庫狀態為已解鎖
          const session = await prisma.session.update({
            where: { browserToken },
            data: { isUnlocked: true }
          });

          // 如果使用者有允許 Web Push，則發送推播通知
          if (session.pushSub) {
            await webpush.sendNotification(
              session.pushSub as unknown as webpush.PushSubscription,
              JSON.stringify({ 
                title: '彩蛋已解鎖！', 
                body: '您觀看的活動已結束，點擊查看專屬深度討論與彩蛋解析。',
                url: `/unlock/${session.eventId}`
              })
            );
            server.log.info(`Push notification sent to: ${browserToken}`);
          }
        } catch (err) {
          server.log.error(err, 'Failed to handle time-lock expiration or send push');
        }
      }
    });

    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://0.0.0.0:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
