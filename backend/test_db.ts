import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const characters = await prisma.eventCharacter.findMany();
  console.log('=== Event Characters ===');
  console.log(JSON.stringify(characters, null, 2));

  const sessions = await prisma.session.findMany({
    where: { lineUserId: { not: null } },
    orderBy: { verifiedAt: 'desc' },
    take: 5,
    include: { event: { select: { name: true } } }
  });
  console.log('\n=== Recent Sessions ===');
  console.log(JSON.stringify(sessions, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
