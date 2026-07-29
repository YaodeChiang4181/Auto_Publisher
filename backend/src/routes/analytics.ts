import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import { redis } from '../redis';

export default async function analyticsRoutes(server: FastifyInstance) {
  server.post('/track', async (request, reply) => {
    const { eventId, actionType } = request.body as any;
    const sessionId = request.cookies.sessionToken;

    if (!sessionId || !eventId || !actionType) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      // Check if session was geo-verified
      const statusStr = await redis.get(`session_status:${sessionId}`);
      if (statusStr) {
        const status = JSON.parse(statusStr);
        if (status.isGeoVerified === false) {
          // Do not track unverified users, but return success to avoid frontend errors
          return { success: true, ignored: true };
        }
      }

      const actionLog = await prisma.actionLog.create({
        data: {
          sessionId,
          eventId,
          actionType
        }
      });
      return { success: true, id: actionLog.id };
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to track action' });
    }
  });
}
