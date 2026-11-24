import {groupPolicyHandler,GROUP_POLICY_BUTTON,GROUP_POLICY_LOCK,GROUP_POLICY_OPEN} from './handlers/group-policy.handler';
import {restartHandler} from './handlers/restart.handler';
import {telegramCall} from './services/queue-runtime';
import {runtimeDiagnostics} from './services/diagnostics.service';
import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { startHandler } from './handlers/start.handler';
import { prisma,withGithubDatabase } from '@davomat/db';
import {rememberChat,migrateChat,canManageGroups,isGroupAdmin,registrationIds} from './services/chat-registry.service';
import {groupHandler,sharedChatHandler} from './handlers/group.handler';
import {STATUS_BUTTON} from './handlers/group.handler';
import {systemStatusHandler,linkedGroupsHandler} from './handlers/owner.handler';

import {beginAnnouncement,announcementMessage,ANNOUNCE_BUTTON} from './handlers/announcement.handler';
import {reminderSettingsHandler} from './handlers/reminder.handler';
import {REMINDER_SETTINGS_BUTTON,REMINDER_DISABLE_BUTTON,REMINDER_ENABLE_BUTTON} from './services/reminder-settings.service';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error('BOT_TOKEN .env faylda ko`rsatilmagan!');
}

export const bot = new Bot(token);

// Recovery controls deliberately run before any database middleware.
bot.use(async(ctx,next)=>{if(!await restartHandler(ctx))await next();});

bot.use(async(ctx,next)=>{
 const reply=ctx.reply.bind(ctx),responses:any[][]=[];
 try{if(ctx.message?.chat_shared){(ctx as any).auditChat=await telegramCall(signal=>ctx.api.getChat(ctx.message!.chat_shared!.chat_id,signal));(ctx as any).auditMember=await telegramCall(signal=>ctx.api.getChatMember((ctx as any).auditChat.id,ctx.me.id,signal));}
 if(ctx.chat?.type==='private'&&ctx.from?.id===8197301287&&(ctx.message?.text==='/status'||ctx.message?.text===STATUS_BUTTON))(ctx as any).auditDiagnostics=await runtimeDiagnostics();
 }catch(e:any){console.error('DAVOMAT_DIAG',JSON.stringify({phase:'telegram-preflight',code:e?.error_code||e?.name}));await reply('Telegram bilan aloqa uzildi. Keyinroq qayta oching.');return;}
 if(process.env.GITHUB_PRIMARY==='1')(ctx as any).reply=async(...args:any[])=>{responses.push(args);return {message_id:0};};
 try{await withGithubDatabase(next);}
 catch(error:any){console.error('DAVOMAT_DIAG',JSON.stringify({phase:'storage-or-handler',name:error?.name,code:error?.code,status:error?.remoteStatus,operationId:error?.operationId}));(ctx as any).reply=reply;if(ctx.chat?.type==='private'){const uncertain=['STORAGE_COMMIT_UNCONFIRMED','STORAGE_CONFLICT_REVIEW'].includes(error?.code);await reply(uncertain?'Saqlash natijasi tekshirilmoqda. Amalni takrorlamang; Mini App orqali holatni yangilang.':'Amal saqlanmadi. Holatni yangilab, keyin qayta urinib ko‘ring.').catch(()=>{});}return;}
 finally{(ctx as any).reply=reply;}
 for(const args of responses)try{await (reply as any)(...args);}catch(error:any){console.error('DAVOMAT_DIAG',JSON.stringify({phase:'reply-after-commit',code:error?.error_code||error?.name}));}
});

// Register group lifecycle before command handlers; never log private updates.
bot.use(async (ctx, next) => {
  const chat = ctx.chat;
  if (chat && (chat.type === 'group' || chat.type === 'supergroup')) {
    const member=ctx.myChatMember?.new_chat_member;
    const active=member?member.status!=='left'&&member.status!=='kicked'&&(member.status!=='restricted'||member.is_member):true;
    if(ctx.message?.migrate_to_chat_id)await migrateChat(chat.id,ctx.message.migrate_to_chat_id,chat.title);
    else if(ctx.message?.migrate_from_chat_id)await migrateChat(ctx.message.migrate_from_chat_id,chat.id,chat.title);
    else {
      const explicitRegistration=!!ctx.myChatMember||ctx.message?.new_chat_members?.some(m=>m.id===ctx.me.id)||/^\/(start|group)(@\w+)?(?:\s|$)/.test(ctx.message?.text||'');
      await rememberChat(chat,active,explicitRegistration&&active?ctx.from?.id:undefined);
    }
  }
  await next();
});

bot.hears([GROUP_POLICY_BUTTON,GROUP_POLICY_LOCK,GROUP_POLICY_OPEN],groupPolicyHandler);
bot.command('announce',beginAnnouncement);
bot.hears(ANNOUNCE_BUTTON,beginAnnouncement);
bot.command('status',systemStatusHandler);
bot.hears(STATUS_BUTTON,systemStatusHandler);
bot.command('reminders',reminderSettingsHandler);
bot.hears([REMINDER_SETTINGS_BUTTON,REMINDER_DISABLE_BUTTON,REMINDER_ENABLE_BUTTON],reminderSettingsHandler);
bot.on('message',announcementMessage);
bot.command('panel',startHandler);
bot.hears(['Admin panel','Admin Panel','👨‍💻 Admin Panel','Davomat','📷 Davomat'],startHandler);
bot.command('start',startHandler);
bot.command('attendance',startHandler);
bot.command('admin',startHandler);
bot.command('group',groupHandler);
bot.on('message:chat_shared',sharedChatHandler);
bot.hears('📋 Ulangan guruhlar',linkedGroupsHandler);

bot.catch((err) => {
  console.error('Bot update failed:',err.error instanceof Error?err.error.name:'request');
});
