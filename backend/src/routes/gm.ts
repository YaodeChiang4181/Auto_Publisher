import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import { Client as QStashClient } from '@upstash/qstash';

const qstash = new QStashClient({
  token: process.env.QSTASH_TOKEN || 'mock-token-for-dev'
});

export default async function gmRoutes(server: FastifyInstance) {
  // 取得 Event 資訊 (限帶入正確 token 的 GM)
  server.get('/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    
    const event = await prisma.event.findUnique({
      where: { gmControlToken: token },
      select: {
        id: true,
        name: true,
        startTime: true,
        unlockTime: true,
        gmLineUserId: true
      }
    });

    if (!event) return reply.status(404).send({ error: 'Event not found' });
    return event;
  });

  // 綁定 LINE 帳號 (簡易版：假設已經透過前端拿到 userId，直接綁定)
  // 如果要做完整的 LINE Login，會跟一般 user scan 類似，不過這裡假設前端給了 userId 或透過 oauth callback
  server.post('/:token/bind-line', async (request, reply) => {
    const { token } = request.params as { token: string };
    const { lineUserId } = request.body as { lineUserId: string };

    if (!lineUserId) return reply.status(400).send({ error: 'Missing lineUserId' });

    const event = await prisma.event.findUnique({ where: { gmControlToken: token } });
    if (!event) return reply.status(404).send({ error: 'Event not found' });

    await prisma.event.update({
      where: { gmControlToken: token },
      data: { gmLineUserId: lineUserId }
    });

    return { success: true };
  });

  // 延遲推播 (加時)
  server.post('/:token/delay', async (request, reply) => {
    const { token } = request.params as { token: string };
    const { minutes } = request.body as { minutes: number };

    if (!minutes || isNaN(minutes) || minutes <= 0) {
      return reply.status(400).send({ error: 'Invalid minutes' });
    }

    const event = await prisma.event.findUnique({ where: { gmControlToken: token } });
    if (!event) return reply.status(404).send({ error: 'Event not found' });

    // 如果已經解鎖，無法再延遲
    const sessions = await prisma.session.findMany({ where: { eventId: event.id } });
    const isAlreadyUnlocked = sessions.length > 0 && sessions.every(s => s.isUnlocked);
    if (isAlreadyUnlocked) {
      return reply.status(400).send({ error: 'Event already unlocked' });
    }

    const newUnlockTime = new Date(event.unlockTime.getTime() + minutes * 60 * 1000);

    const updatedEvent = await prisma.event.update({
      where: { gmControlToken: token },
      data: { unlockTime: newUnlockTime }
    });

    server.log.info(`[GM Action] Event ${event.id} delayed by ${minutes} minutes. New unlockTime: ${newUnlockTime.toISOString()}`);
    
    // Note: 我們不需要去取消原本 QStash 的排程，因為 server.ts 中的 Failsafe 機制
    // 會在時間到的時候檢查 date.now() < unlockTime，並自動重排。

    return updatedEvent;
  });

  // 立即發送 (提早結束)
  server.post('/:token/push-now', async (request, reply) => {
    const { token } = request.params as { token: string };

    const event = await prisma.event.findUnique({ where: { gmControlToken: token } });
    if (!event) return reply.status(404).send({ error: 'Event not found' });

    // 提早結束：直接把 unlockTime 設為現在，並觸發 webhook
    const newUnlockTime = new Date();
    await prisma.event.update({
      where: { gmControlToken: token },
      data: { unlockTime: newUnlockTime }
    });

    const publicUrl = (process.env.PUBLIC_URL || 'https://auto-publisher.vercel.app').replace(/\/$/, '');
    
    if (process.env.QSTASH_TOKEN) {
      await qstash.publishJSON({
        url: `${publicUrl}/api/webhooks/push`,
        body: { eventId: event.id }
      });
    } else {
      // 測試環境若沒 QStash，可以用 axios 直接打 (但會有迴圈依賴或超時風險，簡化處理)
      server.log.warn('No QStash token, manually trigger the webhook or test in production');
    }

    server.log.info(`[GM Action] Event ${event.id} pushed IMMEDIATELY.`);
    return { success: true, message: 'Push triggered immediately' };
  });
}
