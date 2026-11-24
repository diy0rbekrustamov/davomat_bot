import {leasedTask,taskIds,telegramCall,retryDelay,recipientUnavailable,queueError} from '../services/queue-runtime';
import {Context} from 'grammy';
import {prisma,withGithubDatabase} from '@davomat/db';
import {bot} from '../bot';
import {keyboardFor,STATUS_BUTTON} from './group.handler';
const OWNER=8197301287;
export const ANNOUNCE_BUTTON="📣 E'lon yuborish";
export const ownerKeyboard=keyboardFor(OWNER);
const draftId='owner-announcement-draft';
const allowed=(ctx:Context)=>ctx.chat?.type==='private'&&ctx.from?.id===OWNER;
async function recipients(){const [teachers,admins]=await Promise.all([prisma.teacher.findMany({where:{faolmi:true}}),prisma.admin.findMany({where:{faolmi:true}})]);return [...new Set([...teachers,...admins].map(x=>x.telegramId.toString()))];}
export async function beginAnnouncement(ctx:Context){if(!allowed(ctx))return;await prisma.notification.upsert({where:{id:draftId},create:{id:draftId,harakat:'ANNOUNCEMENT_DRAFT',tafsilot:'{}'},update:{harakat:'ANNOUNCEMENT_DRAFT',tafsilot:'{}'}});return ctx.reply('E’lon matni, rasm, video yoki hujjatni yuboring. /cancel bilan bekor qilishingiz mumkin.');}
export async function announcementMessage(ctx:Context,next:()=>Promise<void>){
 if(!allowed(ctx))return next();const task=await prisma.notification.findUnique({where:{id:draftId}});
 if(!task||!['ANNOUNCEMENT_DRAFT','ANNOUNCEMENT_PREVIEW'].includes(task.harakat))return next();
 const text=ctx.message?.text;
 if(text===STATUS_BUTTON||text==='📋 Ulangan guruhlar'||ctx.message?.chat_shared)return next();
 if(text==='/cancel'||text==='❌ Bekor qilish'){await prisma.notification.update({where:{id:draftId},data:{harakat:'ANNOUNCEMENT_CANCELLED'}});return ctx.reply('E’lon bekor qilindi.',{reply_markup:ownerKeyboard});}
 if(text==='✅ Hammaga yuborish'){
  if(task.harakat!=='ANNOUNCEMENT_PREVIEW')return ctx.reply('Avval e’lon matnini yuboring.');
  const data=JSON.parse(task.tafsilot||'{}');const ids=await recipients();
  const job='announcement:'+require('crypto').randomUUID();await prisma.notification.create({data:{id:job,harakat:'ANNOUNCEMENT_PENDING',tafsilot:JSON.stringify({...data,recipients:ids,delivered:[],failed:[],nextAt:0})}});
  await prisma.notification.update({where:{id:draftId},data:{harakat:'ANNOUNCEMENT_QUEUED'}});
  return ctx.reply(`E’lon ${ids.length} kishiga yuborish navbatiga qo‘yildi. Tugagach natija keladi.`,{reply_markup:ownerKeyboard});
 }
 if(text?.startsWith('/'))return next();
 if(!ctx.message||(!text&&!ctx.message.photo&&!ctx.message.video&&!ctx.message.document&&!ctx.message.animation&&!ctx.message.audio&&!ctx.message.voice))return ctx.reply('Matn, rasm, video yoki hujjat yuboring.');
 const data={chatId:ctx.chat!.id,messageId:ctx.message.message_id};await prisma.notification.update({where:{id:draftId},data:{harakat:'ANNOUNCEMENT_PREVIEW',tafsilot:JSON.stringify(data)}});
 const ids=await recipients();return ctx.reply(`Shu xabar ${ids.length} ta faol o‘qituvchi va adminga yuboriladi. Ikkala roldagi foydalanuvchi bir marta oladi. Tasdiqlaysizmi?`,{reply_markup:{keyboard:[[{text:'✅ Hammaga yuborish'}],[{text:'❌ Bekor qilish'}]],resize_keyboard:true}});
}

export async function processAnnouncement(id:string){await leasedTask(id,['ANNOUNCEMENT_PENDING','ANNOUNCEMENT_DONE_NOTICE'],async(d,save)=>{
 if(!Array.isArray(d.recipients)||!Number.isSafeInteger(d.messageId)||!d.chatId){await save(()=>{},'ANNOUNCEMENT_INVALID');return;}d.delivered ||= [];d.failed ||= [];
 const target=d._status==='ANNOUNCEMENT_PENDING'?d.recipients.find((x:string)=>!d.delivered.includes(x)&&!d.failed.includes(x)):undefined;
 let error:any;
 if(target!==undefined){try{await telegramCall(signal=>bot.api.copyMessage(target,d.chatId,d.messageId,{},signal));}catch(e){error=e;}
 if(error)await save(s=>{s.attempts=(s.attempts||0)+1;s.nextAt=Date.now()+retryDelay(error,s.attempts);s.lastError=error.error_code||'network';if(recipientUnavailable(error)){s.failed ||= [];s.failed.push(target);s.nextAt=0;}},error.error_code===400&&!recipientUnavailable(error)?'ANNOUNCEMENT_INVALID':undefined);
 else await save(s=>{s.delivered ||= [];if(!s.delivered.includes(target))s.delivered.push(target);s.nextAt=0;});return;}
 if(d._status==='ANNOUNCEMENT_PENDING'){await save(()=>{},'ANNOUNCEMENT_DONE_NOTICE');return;}
 try{await telegramCall(signal=>bot.api.sendMessage(OWNER,`📣 E’lon natijasi\nYetkazildi: ${d.delivered.length}\nYetkazilmadi: ${d.failed.length}`,{},signal));}catch(e){error=e;}
 if(error)await save(s=>{s.attempts=(s.attempts||0)+1;s.nextAt=Date.now()+retryDelay(error,s.attempts);});else await save(()=>{},'ANNOUNCEMENT_DELIVERED');
 });}
export function startAnnouncementWorker(){let running=false;const tick=async()=>{if(running)return;running=true;try{for(const task of await taskIds(['ANNOUNCEMENT_PENDING','ANNOUNCEMENT_DONE_NOTICE']))for(let n=0;n<5;n++)try{await processAnnouncement(task.id);}catch(e){queueError('announcement',e);break;}}catch(e){queueError('announcement-list',e);}finally{running=false;}};void tick();setInterval(()=>void tick(),15000).unref();}
