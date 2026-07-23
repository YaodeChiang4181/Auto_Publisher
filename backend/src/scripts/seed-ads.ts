import { prisma } from '../prisma';

async function main() {
  console.log('Seeding ads...');

  // Get first venue for testing
  const venue = await prisma.venue.findFirst();
  if (!venue) {
    console.log('No venue found, skipping ads seed.');
    return;
  }

  // Create Central Ad
  await prisma.advertisement.create({
    data: {
      title: 'AutoPublisher B2B 升級方案',
      description: '立即升級專業版，享受無限場地管理。',
      linkUrl: 'https://autopublisher.dev/upgrade',
      type: 'CENTRAL',
      imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'
    }
  });

  // Create Venue Ad
  await prisma.advertisement.create({
    data: {
      title: '影城專屬：雙人爆米花套餐 7 折',
      description: '憑此畫面至一樓販賣部兌換。',
      linkUrl: 'https://venue.demo/popcorn-offer',
      type: 'VENUE',
      venueId: venue.id,
      imageUrl: 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'
    }
  });

  console.log('Ads seeded successfully!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
