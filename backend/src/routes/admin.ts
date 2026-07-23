import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';

export default async function adminRoutes(server: FastifyInstance) {
  // 建立初始帳號 (緊急/測試用)
  server.get('/seed', async (request, reply) => {
    const username = 'admin';
    const password = '123456';
    const existing = await prisma.adminUser.findUnique({ where: { username } });
    if (existing) {
      return { message: 'Admin already exists', venueId: existing.venueId };
    }
    const passwordHash = await bcrypt.hash(password, 10);
    let venue = await prisma.venue.findFirst();
    if (!venue) {
      venue = await prisma.venue.create({
        data: { name: 'Demo Venue', geoLat: 0, geoLng: 0, geoRadius: 100, isActive: true }
      });
    }
    await prisma.adminUser.create({
      data: { username, passwordHash, name: 'System Admin', role: 'SUPER_ADMIN', venueId: venue.id }
    });
    return { message: 'Admin created successfully' };
  });

  // 登入 API
  server.post('/login', async (request, reply) => {
    const { username, password } = request.body as any;
    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password are required' });
    }

    const user = await prisma.adminUser.findUnique({ where: { username } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    // 發行 JWT Token
    const token = server.jwt.sign({ 
      id: user.id, 
      username: user.username, 
      role: user.role, 
      venueId: user.venueId 
    }, { expiresIn: '7d' });

    return { token, user: { id: user.id, username: user.username, role: user.role, venueId: user.venueId } };
  });

  // 需要驗證的路由：取得當前管理員資訊
  server.get('/me', {
    preValidation: [server.authenticate]
  }, async (request, reply) => {
    const user = request.user as any;
    const dbUser = await prisma.adminUser.findUnique({ 
      where: { id: user.id },
      include: { venue: true }
    });
    return { user: dbUser };
  });

  // 需要驗證的路由：取得所屬場館的事件
  server.get('/events', {
    preValidation: [server.authenticate]
  }, async (request, reply) => {
    const user = request.user as any;
    
    // 如果是 SUPER_ADMIN，可以看全部；否則只能看自己的場館
    const whereClause = user.role === 'SUPER_ADMIN' ? {} : { venueId: user.venueId };
    
    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' }
    });
    return events;
  });
}
