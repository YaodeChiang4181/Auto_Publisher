import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';

async function testLogin() {
  const user = await prisma.adminUser.findUnique({ where: { username: 'admin' } });
  if (!user) {
    console.log('User not found in DB!');
    return;
  }
  console.log('User found:', user.username);
  
  const isValid = await bcrypt.compare('123456', user.passwordHash);
  console.log('Password valid?:', isValid);
}

testLogin().finally(() => prisma.$disconnect());
