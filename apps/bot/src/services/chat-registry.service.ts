import {prisma} from '@davomat/db';

let backupTimer:ReturnType<typeof setTimeout>|undefined;
export function requestDatabaseBackup() {
 if(process.env.GITHUB_PRIMARY==='1'||backupTimer)return;
 backupTimer=setTimeout(()=>{backupTimer=undefined;void fetch('http://127.0.0.1:3000/internal/sync-database',{
  method:'POST',headers:{'x-internal-token':process.env.BOT_TOKEN||''},signal:AbortSignal.timeout(5000)
 }).then(r=>{if(!r.ok)console.error('Database backup request failed:',r.status);}).catch(()=>console.error('Database backup request unavailable; periodic backup will retry.'));},2000);
}
export async function canManageGroups(id?:number) {
 if(!id)return false;
 if(String(id)==='8197301287')return true;
 const admin=await prisma.admin.findUnique({where:{telegramId:BigInt(id)}});
 if(admin?.faolmi)return true;
 return !!(await prisma.teacher.findUnique({where:{telegramId:BigInt(id)}}))?.faolmi;
}
export async function isGroupAdmin(id:number){if(id===8197301287)return true;return !!(await prisma.admin.findUnique({where:{telegramId:BigInt(id)}}))?.faolmi;}
export function registrationIds(raw?:string):string[]{try{const ids=JSON.parse(raw||'[]');return Array.isArray(ids)?ids.filter(id=>typeof id==='string'):[];}catch{return [];}}
export async function rememberChat(chat:{id:number;title?:string;type:string},active=true,addedBy?:number) {
 if(chat.type!=='group'&&chat.type!=='supergroup')return;
 const chatId=String(chat.id),title=chat.title||'Nomsiz guruh';
 const existing=await prisma.telegramChat.findUnique({where:{chatId}});
 const ids=registrationIds(existing?.addedByTelegramIds);
 if(active&&addedBy&&await canManageGroups(addedBy)&&!ids.includes(String(addedBy)))ids.push(String(addedBy));
 const addedByTelegramIds=JSON.stringify(ids);
 if(existing?.title===title&&existing.active===active&&existing.addedByTelegramIds===addedByTelegramIds)return;
 await prisma.telegramChat.upsert({where:{chatId},create:{chatId,title,active,addedByTelegramIds},update:{title,active,addedByTelegramIds}});
 requestDatabaseBackup();
}
export async function migrateChat(oldId:number,newId:number,title:string) {
 await prisma.$transaction(async tx=>{
  const old=await tx.telegramChat.findUnique({where:{chatId:String(oldId)}}),current=await tx.telegramChat.findUnique({where:{chatId:String(newId)}});
  const addedByTelegramIds=JSON.stringify([...new Set([...registrationIds(old?.addedByTelegramIds),...registrationIds(current?.addedByTelegramIds)])]);
  await tx.telegramChat.upsert({where:{chatId:String(newId)},create:{chatId:String(newId),title,active:true,addedByTelegramIds},update:{title,active:true,addedByTelegramIds}});
  await tx.telegramChat.updateMany({where:{chatId:String(oldId)},data:{active:false}});
  const groups=await tx.group.findMany();
  for(const group of groups){let ids:string[]=[];try{const raw=JSON.parse(group.telegramChatIds);if(Array.isArray(raw))ids=raw;}catch{}
   if(!ids.length&&group.telegramChatId)ids=[group.telegramChatId];
   if(ids.includes(String(oldId))){ids=[...new Set(ids.map(id=>id===String(oldId)?String(newId):id))];await tx.group.update({where:{id:group.id},data:{telegramChatId:ids[0]||null,telegramChatIds:JSON.stringify(ids)}});}
  }
  const tasks=await tx.notification.findMany({where:{harakat:'ATTENDANCE_REPORT_PENDING'}});
  for(const task of tasks){try{const state=JSON.parse(task.tafsilot||'{}');if(Array.isArray(state.parentDelivered)&&state.parentDelivered.includes(String(oldId))){state.parentDelivered=state.parentDelivered.map((id:string)=>id===String(oldId)?String(newId):id);await tx.notification.update({where:{id:task.id},data:{tafsilot:JSON.stringify(state)}});}}catch{}}
 });
 requestDatabaseBackup();
}
