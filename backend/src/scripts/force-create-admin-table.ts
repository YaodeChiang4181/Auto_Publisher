import { prisma } from '../prisma';

async function main() {
  console.log('Forcing creation of AdminUser table via Raw SQL...');
  
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AdminUser" (
          "id" TEXT NOT NULL,
          "username" TEXT NOT NULL,
          "passwordHash" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'VENUE_MANAGER',
          "venueId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
      
          CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
      );
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_username_key" ON "AdminUser"("username");
    `);

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        console.error('Foreign key error:', e.message);
      }
    }
    
    console.log('Table AdminUser ensured.');
  } catch (err) {
    console.error('Error creating table:', err);
  }
}

main().finally(() => prisma.$disconnect());
