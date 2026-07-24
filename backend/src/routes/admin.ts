import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Client as QStashClient } from '@upstash/qstash';

const twofactor = require('node-2fa');

// QStash Client 初始化 (若無設定 TOKEN 則報錯或跳過)
const qstash = new QStashClient({
  token: process.env.QSTASH_TOKEN || 'mock-token-for-dev'
});

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

    // 發行 24小時 的 JWT Token
    const token = server.jwt.sign({ 
      id: user.id, 
      username: user.username, 
      role: user.role, 
      venueId: user.venueId 
    }, { expiresIn: '24h' });

    reply.setCookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    return { user: { id: user.id, username: user.username, role: user.role, venueId: user.venueId } };
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

      const verifyResult = twofactor.verifyToken(user.twoFactorSecret, token);
      if (!verifyResult || verifyResult.delta !== 0) {
        return reply.status(401).send({ error: 'Invalid 2FA code' });
      }

      // 驗證成功，核發 24 小時憑證
      const finalToken = server.jwt.sign({ 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        venueId: user.venueId 
      }, { expiresIn: '24h' });

      reply.setCookie('adminToken', finalToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });

      return { user: { id: user.id, username: user.username, role: user.role, venueId: user.venueId } };
    } catch (e) {
      return reply.status(401).send({ error: 'Session expired or invalid' });
    }
  });

  // 登出 API
  server.post('/logout', async (_request, reply) => {
    reply.clearCookie('adminToken', { path: '/' });
    return { success: true };
  });

  // 產出 2FA 綁定 QR Code
  server.post('/2fa/generate', { preValidation: [server.authenticate] }, async (request, reply) => {
    const userContext = request.user as any;
    const user = await prisma.adminUser.findUnique({ where: { id: userContext.id } });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.isTwoFactorEnabled) {
      return reply.status(400).send({ error: '2FA is already enabled' });
    }

    const { secret, uri } = twofactor.generateSecret({ name: 'AutoPublisher', account: user.username });
    const qrCodeUrl = await QRCode.toDataURL(uri);

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

    const verifyResult = twofactor.verifyToken(user.twoFactorSecret, token);
    if (!verifyResult || verifyResult.delta !== 0) {
      return reply.status(400).send({ error: 'Invalid 2FA code' });
    }

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

  // 手動新增活動 (替代爬蟲)
  server.post('/events', { preValidation: [server.authenticate] }, async (request, reply) => {
    const user = request.user as any;
    if (!user.venueId) return reply.status(403).send({ error: 'Not associated with a venue' });

    const { name, startTime, unlockTime } = request.body as any;
    if (!name || !startTime || !unlockTime) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const newEvent = await prisma.event.create({
      data: {
        name,
        startTime: new Date(startTime),
        unlockTime: new Date(unlockTime),
        venueId: user.venueId,
        externalId: `manual_${Date.now()}`,
        externalMeta: { source: 'manual' }
      }
    });

    // ==========================================
    // [Feature] 排程喚醒 (QStash Scheduling)
    // 當建立活動時，預先排定未來的喚醒時間
    // ==========================================
    try {
      const publicUrl = process.env.PUBLIC_URL || 'https://auto-publisher.vercel.app';
      
      const unlockDate = new Date(unlockTime);
      const prewarmDate = new Date(unlockDate.getTime() - 30 * 1000); // 提前 30 秒

      // 檢查時間是否在未來
      if (prewarmDate.getTime() > Date.now() && process.env.QSTASH_TOKEN) {
        // 1. 預熱爬蟲 (Pre-warm Scraper)
        await qstash.publishJSON({
          url: `${publicUrl}/api/webhooks/prewarm`,
          body: { eventId: newEvent.id, eventName: newEvent.name },
          notBefore: Math.floor(prewarmDate.getTime() / 1000), // UNIX timestamp (seconds)
        });

        // 2. 準點推播 (Push Notifications)
        await qstash.publishJSON({
          url: `${publicUrl}/api/webhooks/push`,
          body: { eventId: newEvent.id },
          notBefore: Math.floor(unlockDate.getTime() / 1000),
        });
        
        server.log.info(`[QStash] Scheduled Webhooks for Event ${newEvent.id}`);
      } else {
        server.log.warn(`[QStash] Skipped scheduling: Time is in the past or QSTASH_TOKEN missing.`);
      }
    } catch (scheduleError) {
      server.log.error(scheduleError, '[QStash] Failed to schedule webhooks');
    }

    return newEvent;
  });

  // 刪除手動建立的活動
  server.delete('/events/:id', { preValidation: [server.authenticate] }, async (request, reply) => {
    const { id } = request.params as any;
    const userContext = request.user as any;
    
    // 確認使用者是否存在
    const user = await prisma.adminUser.findUnique({
      where: { id: userContext.id },
      include: { venue: true }
    });
    
    if (!user || !user.venueId) {
      return reply.status(403).send({ error: 'No venue associated' });
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return reply.status(404).send({ error: 'Event not found' });
    
    if (event.venueId !== user.venueId && user.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'Cannot delete event for another venue' });
    }

    await prisma.event.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // 取得目前場館的動態廣告
  server.get('/ads', { preValidation: [server.authenticate] }, async (request, reply) => {
    const user = request.user as any;
    if (!user.venueId && user.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'Not associated with a venue' });
    }

    const whereClause = user.role === 'SUPER_ADMIN' ? {} : { venueId: user.venueId };
    const ads = await prisma.advertisement.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    return ads;
  });

  // 新增動態廣告 (處理 multipart/form-data)
  server.post('/ads', { preValidation: [server.authenticate] }, async (request, reply) => {
    const user = request.user as any;
    if (!user.venueId) return reply.status(403).send({ error: 'Not associated with a venue' });

    const parts = request.parts();
    let title = '';
    let description = '';
    let linkUrl = '';
    let imageFilename = '';

    for await (const part of parts) {
      if (part.type === 'file') {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedMimes.includes(part.mimetype)) {
          return reply.status(400).send({ error: '不支援的檔案格式，請上傳 JPG, PNG, WEBP 或 GIF' });
        }
        
        // 使用 UUID 重新命名，防禦 Path Traversal 與 RCE
        const ext = path.extname(part.filename).toLowerCase();
        // 確保附檔名在白名單內 (防禦偽造 MIME)
        const safeExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        if (!safeExts.includes(ext)) {
          return reply.status(400).send({ error: '副檔名異常' });
        }

        imageFilename = crypto.randomUUID() + ext;
        const uploadDir = path.join(__dirname, '../../uploads/ads');
        const savePath = path.join(uploadDir, imageFilename);
        
        // 確保目錄存在 (防呆)
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        await pipeline(part.file, fs.createWriteStream(savePath));
      } else {
        if (part.fieldname === 'title') title = part.value as string;
        if (part.fieldname === 'description') description = part.value as string;
        if (part.fieldname === 'linkUrl') linkUrl = part.value as string;
      }
    }

    if (!title) {
      return reply.status(400).send({ error: '標題為必填欄位' });
    }

    // 驗證 URL 格式 (防禦 XSS via URL)，若有填寫才驗證
    if (linkUrl) {
      try {
        const urlObj = new URL(linkUrl);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          return reply.status(400).send({ error: '僅支援 HTTP 或 HTTPS 連結' });
        }
      } catch (e) {
        return reply.status(400).send({ error: '無效的連結格式' });
      }
    }

    const imageUrl = imageFilename ? `/uploads/ads/${imageFilename}` : null;

    const ad = await prisma.advertisement.create({
      data: {
        title,
        description,
        linkUrl,
        imageUrl,
        type: 'VENUE',
        venueId: user.venueId
      }
    });

    return ad;
  });

  // 刪除動態廣告 (需檢查權限)
  server.delete('/ads/:id', { preValidation: [server.authenticate] }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as { id: string };

    const ad = await prisma.advertisement.findUnique({ where: { id } });
    if (!ad) return reply.status(404).send({ error: 'Advertisement not found' });

    // IDOR 防禦：只能刪除自己的場館廣告，或由 SUPER_ADMIN 刪除
    if (ad.venueId !== user.venueId && user.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'Permission denied' });
    }

    // 實體刪除圖片檔案
    if (ad.imageUrl && ad.imageUrl.startsWith('/uploads/ads/')) {
      const filename = ad.imageUrl.replace('/uploads/ads/', '');
      const filepath = path.join(__dirname, '../../uploads/ads', filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    await prisma.advertisement.delete({ where: { id } });
    return { success: true };
  });

  // 新增常用座標記憶庫 (上限 5 筆)
  server.post('/saved-locations', { preValidation: [server.authenticate] }, async (request, reply) => {
    const userContext = request.user as any;
    const { name, lat, lng } = request.body as any;

    if (!name || lat === undefined || lng === undefined) {
      return reply.status(400).send({ error: 'Missing name, lat, or lng' });
    }

    const user = await prisma.adminUser.findUnique({ where: { id: userContext.id } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    let locations = ((user as any).savedLocations as any[]) || [];
    if (locations.length >= 5) {
      return reply.status(400).send({ error: '常用位置最多只能儲存 5 筆' });
    }

    locations.push({ name, lat: parseFloat(lat), lng: parseFloat(lng) });

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { savedLocations: locations }
    });

    return { success: true, savedLocations: locations };
  });

  // 刪除常用座標記憶庫
  server.delete('/saved-locations/:index', { preValidation: [server.authenticate] }, async (request, reply) => {
    const userContext = request.user as any;
    const { index } = request.params as { index: string };
    const idx = parseInt(index, 10);

    const user = await prisma.adminUser.findUnique({ where: { id: userContext.id } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    let locations = ((user as any).savedLocations as any[]) || [];
    if (idx < 0 || idx >= locations.length) {
      return reply.status(400).send({ error: '無效的索引' });
    }

    locations.splice(idx, 1);

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { savedLocations: locations }
    });

    return { success: true, savedLocations: locations };
  });
}
