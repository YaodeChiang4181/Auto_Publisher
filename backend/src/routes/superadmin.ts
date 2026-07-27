import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export default async function superadminRoutes(server: FastifyInstance) {
  // Middleware: Require authentication AND SUPER_ADMIN role
  server.addHook('preValidation', async (_request, _reply) => {
    try {
      await server.authenticate(_request, _reply);
      const user = _request.user as any;
      if (user.role !== 'SUPER_ADMIN') {
        return _reply.status(403).send({ error: 'Requires SUPER_ADMIN privileges' });
      }
    } catch (err) {
      return _reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // ==========================================
  // Analytics & Dashboard Stats
  // ==========================================
  server.get('/stats', async (_request, _reply) => {
    const venueCount = await prisma.venue.count();
    const eventCount = await prisma.event.count();
    const userCount = await prisma.adminUser.count({ where: { role: 'VENUE_MANAGER' } });
    
    // Ads stats
    const totalViews = await prisma.advertisement.aggregate({
      _sum: { viewCount: true }
    });
    
    return {
      venueCount,
      eventCount,
      userCount,
      totalAdViews: totalViews._sum.viewCount || 0
    };
  });

  // ==========================================
  // Venues Management
  // ==========================================
  server.get('/venues', async (_request, _reply) => {
    const venues = await prisma.venue.findMany({
      include: {
        _count: {
          select: { events: true, adminUsers: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return venues;
  });

  server.post('/venues', async (_request, _reply) => {
    const { name, geoLat, geoLng, geoRadius, contactName, contactPhone } = _request.body as any;
    if (!name || geoLat == null || geoLng == null || !geoRadius) {
      return _reply.status(400).send({ error: 'Missing required venue fields' });
    }

    const venue = await prisma.venue.create({
      data: {
        name,
        geoLat: parseFloat(geoLat),
        geoLng: parseFloat(geoLng),
        geoRadius: parseFloat(geoRadius),
        contactName,
        contactPhone
      }
    });
    return venue;
  });

  server.put('/venues/:id', async (_request, _reply) => {
    const { id } = _request.params as any;
    const { name, geoLat, geoLng, geoRadius, contactName, contactPhone, status } = _request.body as any;
    
    const venue = await prisma.venue.update({
      where: { id },
      data: {
        name,
        geoLat: geoLat != null ? parseFloat(geoLat) : undefined,
        geoLng: geoLng != null ? parseFloat(geoLng) : undefined,
        geoRadius: geoRadius != null ? parseFloat(geoRadius) : undefined,
        contactName,
        contactPhone,
        status
      }
    });
    return venue;
  });

  // ==========================================
  // Ad Campaigns Management (Central Ads)
  // ==========================================
  server.get('/campaigns', async (_request, _reply) => {
    const campaigns = await prisma.adCampaign.findMany({
      include: {
        ads: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return campaigns;
  });

  server.post('/campaigns', async (_request, _reply) => {
    const { title, sponsor, startDate, endDate, targetVenues } = _request.body as any;
    if (!title || !sponsor || !startDate || !endDate) {
      return _reply.status(400).send({ error: 'Missing required campaign fields' });
    }

    const campaign = await prisma.adCampaign.create({
      data: {
        title,
        sponsor,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        targetVenues: targetVenues ? JSON.stringify(targetVenues) : null
      }
    });
    return campaign;
  });

  // ==========================================
  // Accounts Management (B2B Venue Managers)
  // ==========================================
  server.get('/users', async (_request, _reply) => {
    const users = await prisma.adminUser.findMany({
      include: {
        venue: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return users;
  });

  server.post('/users', async (_request, _reply) => {
    const { username, password, name, role, venueId } = _request.body as any;
    if (!username || !password || !name) {
      return _reply.status(400).send({ error: 'Missing required user fields' });
    }

    const existing = await prisma.adminUser.findUnique({ where: { username } });
    if (existing) {
      return _reply.status(400).send({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.adminUser.create({
      data: {
        username,
        passwordHash,
        name,
        role: role || 'VENUE_MANAGER',
        venueId: venueId || null
      }
    });
    
    // 隱藏密碼雜湊後回傳
    const { passwordHash: _ph, ...safeUser } = user;
    return safeUser;
  });
}
