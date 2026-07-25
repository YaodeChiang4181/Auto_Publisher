import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';

export default async function analyticsRoutes(server: FastifyInstance) {
  server.post('/track', async (request, reply) => {
    const { eventId, actionType } = request.body as any;
    const sessionId = request.cookies.sessionToken;

    if (!sessionId || !eventId || !actionType) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
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
