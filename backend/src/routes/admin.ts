import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
const { authenticator } = require('otplib');

export default async function adminRoutes(server: FastifyInstance) {
  // 建立初始帳號 (緊急/測試用)
  server.get('/seed', async (_request, _reply) => {
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

  // 登入 API - 加上 Rate Limiting (防暴力破解)
  server.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
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

    // 若啟用了 2FA，則先核發 5 分鐘的短暫憑證要求輸入動態密碼
    if (user.isTwoFactorEnabled) {
      const tempToken = server.jwt.sign({ 
        id: user.id, 
        isTemp: true 
      }, { expiresIn: '5m' });
      return { requires2FA: true, tempToken };
    }

    // 發行 24小時 的 JWT Token (滿足每24小時要求重新登入驗證的設計)
    const token = server.jwt.sign({ 
      id: user.id, 
      username: user.username, 
      role: user.role, 
      venueId: user.venueId 
    }, { expiresIn: '24h' });

    return { token, user: { id: user.id, username: user.username, role: user.role, venueId: user.venueId } };
  });

  // 驗證 2FA API
  server.post('/verify-2fa', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' }
    }
  }, async (request, reply) => {
    const { tempToken, token } = request.body as any;
    if (!tempToken || !token) {
      return reply.status(400).send({ error: 'Missing token data' });
    }

    try {
      const decoded = server.jwt.verify<{id: string, isTemp: boolean}>(tempToken);
      if (!decoded.isTemp) throw new Error('Invalid token type');
      
      const user = await prisma.adminUser.findUnique({ where: { id: decoded.id } });
      if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
        return reply.status(400).send({ error: '2FA is not properly set up' });
      }

      const isValid = authenticator.check(token, user.twoFactorSecret);
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid 2FA code' });
      }

      // 驗證成功，核發 24 小時憑證
      const finalToken = server.jwt.sign({ 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        venueId: user.venueId 
      }, { expiresIn: '24h' });

      return { token: finalToken, user: { id: user.id, username: user.username, role: user.role, venueId: user.venueId } };
    } catch (e) {
      return reply.status(401).send({ error: 'Session expired or invalid' });
    }
  });

  // 產出 2FA 綁定 QR Code
  server.post('/2fa/generate', { preValidation: [server.authenticate] }, async (request, reply) => {
    const userContext = request.user as any;
    const user = await prisma.adminUser.findUnique({ where: { id: userContext.id } });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.isTwoFactorEnabled) {
      return reply.status(400).send({ error: '2FA is already enabled' });
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.username, 'AutoPublisher', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // 將 secret 暫時存回資料庫，但不啟用
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret }
    });

    return { qrCodeUrl, secret };
  });

  // 確認並啟用 2FA
  server.post('/2fa/enable', { preValidation: [server.authenticate] }, async (request, reply) => {
    const { token } = request.body as any;
    const userContext = request.user as any;
    
    const user = await prisma.adminUser.findUnique({ where: { id: userContext.id } });
    if (!user || !user.twoFactorSecret) return reply.status(400).send({ error: 'Setup 2FA first' });

    const isValid = authenticator.check(token, user.twoFactorSecret);
    if (!isValid) return reply.status(400).send({ error: 'Invalid 2FA code' });

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { isTwoFactorEnabled: true }
    });

    return { success: true };
  });

  // 更新場館的 Geo-fencing 設定
  server.put('/venue', { preValidation: [server.authenticate] }, async (request, reply) => {
    const userContext = request.user as any;
    const { geoLat, geoLng, geoRadius } = request.body as any;
    
    if (!userContext.venueId) return reply.status(403).send({ error: 'Not associated with a venue' });

    const updatedVenue = await prisma.venue.update({
      where: { id: userContext.venueId },
      data: { 
        geoLat: parseFloat(geoLat), 
        geoLng: parseFloat(geoLng), 
        geoRadius: parseFloat(geoRadius) 
      }
    });

    return { success: true, venue: updatedVenue };
  });

  // 取得當前管理員資訊
  server.get('/me', { preValidation: [server.authenticate] }, async (request, _reply) => {
    const user = request.user as any;
    const dbUser = await prisma.adminUser.findUnique({ 
      where: { id: user.id },
      include: { venue: true }
    });
    // 不回傳敏感的 secret
    if (dbUser) {
      (dbUser as any).twoFactorSecret = undefined;
      (dbUser as any).passwordHash = undefined;
    }
    return { user: dbUser };
  });

  // 取得所屬場館的事件
  server.get('/events', { preValidation: [server.authenticate] }, async (request, _reply) => {
    const user = request.user as any;
    const whereClause = user.role === 'SUPER_ADMIN' ? {} : { venueId: user.venueId };
    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' }
    });
    return events;
  });
}
