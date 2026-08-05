import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import { fetchTrendingForEvent } from '../services/trendingScraper';

export default async function unlockRoutes(server: FastifyInstance) {
  
  // 取得特定活動的廣告 (不限解鎖狀態，供候車室使用)
  server.get('/ads/:eventId', async (request, reply) => {
    const { eventId } = request.params as any;
    try {
      const event = await prisma.event.findUnique({
        where: { id: eventId }
      });

      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      const now = new Date();
      const centralAds = await prisma.advertisement.findMany({
        where: { 
          type: 'CENTRAL',
          OR: [
            { campaignId: null },
            {
              campaign: {
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now }
              }
            }
          ]
        }
      });
      
      const venueAds = await prisma.advertisement.findMany({
        where: { venueId: event.venueId, type: 'VENUE' }
      });

      return {
        central: centralAds,
        venue: venueAds
      };
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
  server.get('/content/:eventId', async (request, reply) => {
    const { eventId } = request.params as any;
    const sessionToken = request.cookies.sessionToken || request.headers.authorization?.replace('Bearer ', '');

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
      const now = new Date();
      const centralAds = await prisma.advertisement.findMany({
        where: { 
          type: 'CENTRAL',
          OR: [
            { campaignId: null },
            {
              campaign: {
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now }
              }
            }
          ]
        }
      });
      
      const venueAds = await prisma.advertisement.findMany({
        where: { venueId: event.venueId, type: 'VENUE' }
      });

      const officialReviews = await prisma.advertisement.findMany({
        where: { venueId: event.venueId, type: 'OFFICIAL_REVIEW' },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      return {
        trending,
        ads: {
          central: centralAds,
          venue: venueAds
        },
        officialReview: officialReviews.length > 0 ? officialReviews[0] : null
      };
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}
