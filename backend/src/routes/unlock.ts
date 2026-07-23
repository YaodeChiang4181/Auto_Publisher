import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import { fetchTrendingForEvent } from '../services/trendingScraper';

export default async function unlockRoutes(server: FastifyInstance) {
  
  server.get('/content/:eventId', async (request, reply) => {
    const { eventId } = request.params as any;

    try {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { venue: true }
      });

      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
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
