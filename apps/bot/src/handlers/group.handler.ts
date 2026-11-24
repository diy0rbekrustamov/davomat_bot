import {teacherGroupsEnabled} from '@davomat/shared';
import {prisma} from '@davomat/db';
import {RESTART_BUTTON} from '../services/restart-control.service';
import {Context} from 'grammy';
import {canManageGroups,rememberChat} from '../services/chat-registry.service';
import {DEVELOPER_ID,REMINDER_SETTINGS_BUTTON,REMINDER_DISABLE_BUTTON,REMINDER_ENABLE_BUTTON} from '../services/reminder-settings.service';
export const GROUP_REQUEST_ID=27001;
export const groupKeyboard={keyboard:[[{text:"➕ Guruh qo'shish",request_chat:{request_id:GROUP_REQUEST_ID,chat_is_channel:false,bot_is_member:true,request_title:true}}],[{text:'📋 Ulangan guruhlar'}]],resize_keyboard:true};
export const STATUS_BUTTON='💻 Tizim Holati';
export function keyboardFor(id?:number,remindersEnabled?:boolean,canAdmin=false,teacherGroups=true){const isOwner=id===DEVELOPER_ID;const base=teacherGroups||canAdmin||isOwner?groupKeyboard.keyboard:[groupKeyboard.keyboard[1]];const keyboard:any[][]=[...base.map(row=>[...row])];if(isOwner){keyboard.push([{text:STATUS_BUTTON},{text:"📣 E'lon yuborish"}],[{text:remindersEnabled===undefined?REMINDER_SETTINGS_BUTTON:remindersEnabled?REMINDER_DISABLE_BUTTON:REMINDER_ENABLE_BUTTON}],[{text:RESTART_BUTTON}]);}if(canAdmin||isOwner)keyboard.push([{text:"🔐 O‘qituvchi guruh huquqlari"}]);if(id) {const panels:any[]=[];if(canAdmin||isOwner)panels.push({text:'👨‍💻 Admin Panel',web_app:{url:process.env.ADMIN_WEBAPP_URL||'https://davomat.provveb.uz'}});if(!canAdmin&&!isOwner)panels.push({text:'📷 Davomat',web_app:{url:process.env.TEACHER_WEBAPP_URL||'https://davomat.provveb.uz/teacher'}});if(panels.length)keyboard.push(panels);}return {...groupKeyboard,keyboard};}
export async function groupHandler(ctx:Context) {
 if(ctx.chat?.type!=='private')return;
 if(ctx.from?.id!==8197301287&&!await prisma.admin.findUnique({where:{telegramId:BigInt(ctx.from!.id)}}).then(a=>a?.faolmi)&&!await teacherGroupsEnabled(prisma))return ctx.reply('O‘qituvchilarga guruh qo‘shish administrator tomonidan yopilgan.');
 if(!await canManageGroups(ctx.from?.id))return ctx.reply("Guruh ulash faqat faol o'qituvchi va adminlar uchun.");
 return ctx.reply("Bot qo'shilgan ota-onalar guruhini pastdagi tugmadan tanlang. Siz qo'shgan guruh sizning ro'yxatingizga saqlanadi. Adminlar barcha guruhlarni ko'radi.",{reply_markup:keyboardFor(ctx.from?.id,undefined,!!(ctx.from?.id===8197301287||await prisma.admin.findUnique({where:{telegramId:BigInt(ctx.from!.id)}}).then(a=>a?.faolmi)),await teacherGroupsEnabled(prisma))});
}
export async function sharedChatHandler(ctx:Context) {
 if(ctx.chat?.type!=='private'||!await canManageGroups(ctx.from?.id))return;
 if(ctx.from?.id!==8197301287&&!await prisma.admin.findUnique({where:{telegramId:BigInt(ctx.from!.id)}}).then(a=>a?.faolmi)&&!await teacherGroupsEnabled(prisma))return ctx.reply('O‘qituvchilarga guruh qo‘shish administrator tomonidan yopilgan.');
 const shared=ctx.message?.chat_shared;if(!shared||shared.request_id!==GROUP_REQUEST_ID)return;
 try{
  const chat=(ctx as any).auditChat;
  if(chat.type!=='group'&&chat.type!=='supergroup')return ctx.reply('Ota-onalar guruhini tanlang.');
  const member=(ctx as any).auditMember;
  if(member.status==='left'||member.status==='kicked'||(member.status==='restricted'&&!member.is_member))return ctx.reply("Avval botni shu guruhga qo'shing, keyin qayta tanlang.");
  await rememberChat(chat,true,ctx.from?.id);
  return ctx.reply(`✅ ${chat.title} sizning ro'yxatingizga saqlandi.\nMini App'da Telegram ro'yxatini yangilang.`,{reply_markup:keyboardFor(ctx.from?.id,undefined,!!(ctx.from?.id===8197301287||await prisma.admin.findUnique({where:{telegramId:BigInt(ctx.from!.id)}}).then(a=>a?.faolmi)),await teacherGroupsEnabled(prisma))});
 }catch{ return ctx.reply("Guruhga kirib bo'lmadi. Bot guruhda ekanini va xabar yozish huquqini tekshiring, keyin qayta tanlang."); }
}
