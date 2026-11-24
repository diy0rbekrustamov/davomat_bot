const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); async function main() { await prisma.attendanceSession.deleteMany({}); console.log('Ochdi'); } main();  
