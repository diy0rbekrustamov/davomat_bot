const { PrismaClient } = require('@prisma/client');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs/promises');

const prisma = new PrismaClient();

async function regenerate() {
  const groups = await prisma.group.findMany();
  const dir = '/app/apps/backend/uploads/qr';
  await fs.mkdir(dir, { recursive: true });

  for (const group of groups) {
    if (group.qrToken) {
      const fileName = `${group.qrToken}.png`;
      const filePath = path.join(dir, fileName);
      try {
        await fs.access(filePath);
      } catch (e) {
        console.log(`Generating missing QR for ${group.nomi}...`);
        await QRCode.toFile(filePath, group.qrToken, {
          width: 500, margin: 2, color: { dark: '#000000', light: '#ffffff' }
        });
      }
    }
  }
  console.log('Done!');
  process.exit(0);
}
regenerate();
