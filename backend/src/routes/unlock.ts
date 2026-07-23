import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import { fetchTrendingForEvent } from '../services/trendingScraper';

export default async function unlockRoutes(server: FastifyInstance) {
  
  server.get('/content/:eventId', async (request, reply) => {
    const { eventId } = request.params as any;
    const sessionToken = request.cookies.sessionToken;

    if (!sessionToken) {
      return reply.status(401).send({ error: 'Session cookie not found' });
    }

    try {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { venue: true }
      });

      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      // 驗證 Session 是否存在且綁定此 Event
      const session = await prisma.session.findUnique({
        where: { browserToken: sessionToken }
      });

      if (!session || session.eventId !== eventId) {
        return reply.status(401).send({ error: 'Invalid or expired session' });
      }

      // 驗證時間鎖 (Time-Lock 邏輯核心)
      // 若尚未解鎖，且系統當前時間還沒超過活動解鎖時間，則擋下請求
      if (!session.isUnlocked && new Date() < event.unlockTime) {
        return reply.status(403).send({ error: '活動尚未結束，無法觀看隱藏內容！(Time-Lock Enforced)' });
      }

      // 1. Get Trending Data
      const trending = await fetchTrendingForEvent(eventId, event.name);

      // 2. Get Ads (Central + Venue specific)
      const centralAds = await prisma.advertisement.findMany({
        where: { type: 'CENTRAL' }
      });
      
      const venueAds = await prisma.advertisement.findMany({
        where: { venueId: event.venueId, type: 'VENUE' }
      });

      return {
        trending,
        ads: {
          central: centralAds,
          venue: venueAds
        }
      };
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}
