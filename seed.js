const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.admin.upsert({
  where: { telegramId: 8197301287n },
  update: {},
  create: {
    telegramId: 8197301287n,
    ismFamiliya: 'Asosiy Admin',
    lavozim: 'Tizim administratori'
  }
}).then(() => console.log('Admin yaratildi')).catch(console.error).finally(() => prisma.$disconnect());
