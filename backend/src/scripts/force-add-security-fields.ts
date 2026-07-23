import { prisma } from '../prisma';

async function main() {
  console.log('Forcing addition of security fields via Raw SQL...');
  
  try {
    // Add 2FA fields to AdminUser
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "AdminUser" 
      ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT,
      ADD COLUMN IF NOT EXISTS "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
    `);
    
    // Add geoVerifiedScans to EventScanStat
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "EventScanStat"
      ADD COLUMN IF NOT EXISTS "geoVerifiedScans" INTEGER NOT NULL DEFAULT 0;
    `);

    console.log('Security fields ensured in DB.');
  } catch (err) {
    console.error('Error altering table:', err);
  }
}

main().finally(() => prisma.$disconnect());
