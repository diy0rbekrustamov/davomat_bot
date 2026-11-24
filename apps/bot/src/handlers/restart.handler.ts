import {Context} from 'grammy';
import {randomUUID} from 'node:crypto';
import {keyboardFor} from './group.handler';
import {RESTART_BUTTON,RESTART_CONFIRM,RESTART_CANCEL,RESTART_DEVELOPER,requestDavomatRestart} from '../services/restart-control.service';
let expiresAt=0,requesting=false;
export async function restartHandler(ctx:Context):Promise<boolean>{
 const text=ctx.message?.text;
 if(!text||![RESTART_BUTTON,RESTART_CONFIRM,RESTART_CANCEL,'/restart'].includes(text))return false;
 if(ctx.chat?.type!=='private'||ctx.from?.id!==RESTART_DEVELOPER||ctx.chat.id!==RESTART_DEVELOPER)return true;
 if(text===RESTART_CANCEL){expiresAt=0;await ctx.reply('Qayta ishga tushirish bekor qilindi.',{reply_markup:keyboardFor(RESTART_DEVELOPER)});return true;}
 if(text===RESTART_BUTTON||text==='/restart'){
  if(requesting){await ctx.reply('Qayta ishga tushirish so‘rovi allaqachon yuborilmoqda.');return true;}
  expiresAt=0;
  await ctx.reply('Faqat Davomat bot, backend va Mini App konteyneri qayta ishga tushadi. Sayt qisqa vaqt uzilishi mumkin. Tasdiqlaysizmi? (60 soniya)',{reply_markup:{keyboard:[[{text:RESTART_CONFIRM}],[{text:RESTART_CANCEL}]],resize_keyboard:true,one_time_keyboard:true}});expiresAt=Date.now()+60000;return true;
 }
 if(requesting||!expiresAt||Date.now()>expiresAt){expiresAt=0;await ctx.reply('Tasdiqlash muddati tugagan yoki so‘rov yuborilgan. Restart tugmasini qayta bosing.',{reply_markup:keyboardFor(RESTART_DEVELOPER)});return true;}
 expiresAt=0;requesting=true;
 try{await ctx.reply('🔄 Qayta ishga tushirish so‘rovi yuborilmoqda…',{reply_markup:keyboardFor(RESTART_DEVELOPER)});await requestDavomatRestart(randomUUID());await ctx.reply('✅ So‘rov qabul qilindi. Davomat qayta ishga tushgach, natija shu chatga keladi.').catch(()=>console.error('DAVOMAT_DIAG',JSON.stringify({code:'RESTART_ACCEPTED_REPLY_FAILED'})));}
 catch(error:any){console.error('DAVOMAT_DIAG',JSON.stringify({code:'RESTART_REQUEST_FAILED',cause:error?.code||error?.name}));await ctx.reply(error?.code==='RESTART_BUSY'?'Restart allaqachon bajarilmoqda yoki yaqinda bajarilgan. Bir oz kuting.':'Restart so‘rovi tasdiqlanmadi. Xizmat holatini tekshiring; takroriy bosmang.').catch(()=>{});}
 finally{requesting=false;}
 return true;
}
