const client=require('@prisma/client');
const prisma=globalThis.davomatPrisma||new client.PrismaClient();
if(process.env.NODE_ENV!=='production')globalThis.davomatPrisma=prisma;
module.exports={...client,prisma,...require('./github-store.cjs')};
