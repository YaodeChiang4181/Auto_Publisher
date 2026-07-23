import { prisma } from '../prisma';

async function main() {
  console.log('Forcing creation of Advertisement and TrendingResult tables via Raw SQL...');
  
  try {
    // Advertisement Table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Advertisement" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "imageUrl" TEXT,
          "linkUrl" TEXT NOT NULL,
          "type" TEXT NOT NULL DEFAULT 'CENTRAL',
          "venueId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      
          CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
      );
    `);
    
    // TrendingResult Table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TrendingResult" (
          "id" TEXT NOT NULL,
          "eventId" TEXT NOT NULL,
          "platform" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "snippet" TEXT NOT NULL,
          "url" TEXT NOT NULL,
          "imageUrl" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      
          CONSTRAINT "TrendingResult_pkey" PRIMARY KEY ("id")
      );
    `);

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Advertisement" ADD CONSTRAINT "Advertisement_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (!e.message.includes('already exists')) console.error('Foreign key error Advertisement:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "TrendingResult" ADD CONSTRAINT "TrendingResult_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (!e.message.includes('already exists')) console.error('Foreign key error TrendingResult:', e.message);
    }
    
    console.log('Tables Advertisement and TrendingResult ensured.');
  } catch (err) {
    console.error('Error creating table:', err);
  }
}

main().finally(() => prisma.$disconnect());
