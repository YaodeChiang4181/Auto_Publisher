import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const username = 'admin';
  const password = process.env.ADMIN_PASSWORD || '123456';
  
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.log('Admin user already exists!');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  
  // Create a default venue for the admin if none exists
  let venue = await prisma.venue.findFirst();
  if (!venue) {
    venue = await prisma.venue.create({
      data: {
        name: 'Default Demo Venue',
        geoLat: 25.033964,
        geoLng: 121.564468,
        geoRadius: 500,
        isActive: true
      }
    });
  }

  await prisma.adminUser.create({
    data: {
      username,
      passwordHash,
      name: 'System Admin',
      role: 'SUPER_ADMIN',
      venueId: venue.id
    }
  });

  console.log(`Created admin user with username: ${username} and password: ${password}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
