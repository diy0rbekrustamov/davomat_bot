import {startReportEditWorker} from './services/report-edit.worker';
import {startReportDeletionWorker} from './services/report-deletion.worker';
import {DEVELOPER_CHAT_ID} from '@davomat/shared';
import {stopQueueWorkers} from './services/queue-runtime';
import {drainGithubDatabase} from '@davomat/db';
import {startReminderWorker} from './services/reminder.service';
import express from 'express';
import dotenv from 'dotenv';
import { bot } from './bot';
import { webhookCallback, InputFile } from 'grammy';
import { setupCronJobs } from './cron/reminder.cron';
import {startAnnouncementWorker} from './handlers/announcement.handler';
import {withGithubDatabase} from '@davomat/db';
import notifyService from './services/notify.service';
import {refreshAccessMenu} from './services/access-menu.service';
import {keyboardFor} from './handlers/group.handler';
import {startAccessNoticeWorker} from './services/access-notice.service';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/internal',(req,res,next)=>{if(!process.env.BOT_TOKEN||req.headers['x-internal-token']!==process.env.BOT_TOKEN)return res.sendStatus(403);next();});

const BOT_MODE = process.env.BOT_MODE || 'polling';
const PORT = process.env.BOT_PORT || 3001;

// Backenddan keluvchi internal bildirishnomalar uchun endpoint
app.post('/internal/notify', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId majburiy' });

  try {
    await notifyService.sendAttendanceReport(sessionId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Xabar yuborish xatosi:', (error as any)?.code||(error as any)?.name||'request');
    res.status(502).json({error:'INTERNAL_DELIVERY_FAILED'});
  }
});

app.post('/internal/delete-messages', async (req, res) => {
  const { messageIds, chatId } = req.body;
  if (!Array.isArray(messageIds) || !chatId) return res.status(400).json({ error: 'Data yetishmayapti' });
  if(String(chatId)===DEVELOPER_CHAT_ID)return res.status(403).json({error:'DEVELOPER_ARCHIVE_PROTECTED'});

  try {
    for (const msgId of messageIds) await bot.api.deleteMessage(chatId, msgId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(502).json({error:'INTERNAL_DELIVERY_FAILED'});
  }
});

app.post('/internal/send-qr-zip', async (req, res) => {
  if (!process.env.BOT_TOKEN || req.headers['x-internal-token'] !== process.env.BOT_TOKEN) return res.sendStatus(403);
  const { telegramId, base64 } = req.body;
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0 || typeof base64 !== 'string' || base64.length > 28 * 1024 * 1024) {
    return res.status(400).json({ error: 'ZIP ma’lumotlari noto‘g‘ri' });
  }
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))) return res.status(400).json({ error: 'ZIP fayl noto‘g‘ri' });
  try {
    await bot.api.sendDocument(telegramId, new InputFile(bytes, 'Guruhlar_QR_A4.zip'), {
      caption: '📚 Guruhlarning A4 QR rasmlari. Har bir rasm guruh nomi bilan saqlangan.',
    });
    return res.json({ success: true });
  } catch {
    return res.status(502).json({ error: 'ZIP Telegramga yuborilmadi' });
  }
});

app.post('/internal/send-photo', async (req, res) => {
  const { telegramId, base64, caption } = req.body;
  if (!telegramId || !base64) return res.status(400).json({ error: 'Data yetishmayapti' });

  try {
    const buffer = Buffer.from(base64.split(',')[1], 'base64');
    await bot.api.sendPhoto(telegramId, new InputFile(buffer), {
      caption: caption || ''
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Rasm yuborish xatosi:', (error as any)?.code||(error as any)?.name||'request');
    res.status(502).json({error:'INTERNAL_DELIVERY_FAILED'});
  }
});

app.post('/internal/teacher-status', async (req, res) => {
  const { telegramId, status } = req.body;
  if (!telegramId || !status) return res.status(400).json({ error: 'Data yetishmayapti' });

  try {
    const tid = Number(telegramId);
    const access = await refreshAccessMenu(bot.api,tid);
    if (status !== 'admin_changed') {
      const text=status==='blocked'?"O‘qituvchi profilingiz bloklandi.":status==='deleted'?"O‘qituvchi profilingiz o‘chirildi.":"O‘qituvchi profilingiz faol. Davomat olish uchun /start ni bosing.";
      await bot.api.sendMessage(tid,text+(access.canAdmin ? " Admin huquqingiz saqlanadi. /start orqali bo‘limlarni oching." : ''),{
        reply_markup:access.canAdmin||access.canTeach ? keyboardFor(tid) : {remove_keyboard:true}
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    if (error?.error_code === 400 && error?.description?.includes('chat not found')) {
      console.warn('Telegram recipient unavailable.');
      return res.json({ success: true, warning: 'Chat not found' });
    } else if (error?.error_code === 403 && error?.description?.includes('bot was blocked by the user')) {
      console.warn('Telegram recipient unavailable.');
      return res.json({ success: true, warning: 'Bot blocked' });
    }
    console.error('Teacher status update failed:',error?.error_code||error?.name);
    res.status(502).json({error:'INTERNAL_DELIVERY_FAILED'});
  }
});

app.get('/health',(req,res)=>{const ok=BOT_MODE==='webhook'||bot.isRunning();res.status(ok?200:503).json({ok,mode:BOT_MODE});});

const start = async () => {
  // Cron vazifalarni ishga tushirish
  setupCronJobs();
  startReminderWorker(bot.api);
  startReportDeletionWorker();
  startReportEditWorker();
  notifyService.startWorker();
  startAnnouncementWorker();
  startAccessNoticeWorker(bot.api);

  if (BOT_MODE === 'webhook') {
    app.use('/bot-webhook', webhookCallback(bot, 'express'));
  }

  const startBot = async () => {
    try {
      if (BOT_MODE === 'webhook') {
        const domain = process.env.WEBHOOK_DOMAIN;
        if (!domain) throw new Error('WEBHOOK_DOMAIN kiritilmagan');

        await bot.api.setWebhook(`${domain}/bot-webhook`, {
          allowed_updates: ['message','my_chat_member','callback_query']
        });
        console.log(`Bot Webhook rejimida ishga tushdi: ${domain}`);
      } else {
        // Polling mode
        await bot.api.deleteWebhook();
        bot.start({
          allowed_updates: ['message','my_chat_member','callback_query'],
          onStart: async (botInfo) => {
            console.log(`Bot Polling rejimida ishga tushdi: @${botInfo.username}`);
            await updateAllMenuButtons();
          }
        }).catch(error=>{console.error('Polling stopped:',error.name);setTimeout(startBot,5000);});
      }
    } catch (error) {
      console.error('Botni ishga tushirishda xatolik:', (error as any)?.code||(error as any)?.name||'request');
      console.log('5 soniyadan keyin qayta urinib ko\'riladi...');
      setTimeout(startBot, 5000);
    }
  };

  const updateAllMenuButtons=async()=>{
    try {
      const {prisma}=require('@davomat/db');const adminUrl=process.env.ADMIN_WEBAPP_URL,teacherUrl=process.env.TEACHER_WEBAPP_URL;
      if(!adminUrl||!teacherUrl)return;
      await bot.api.setMyCommands([{command:'start',description:'Barcha bo‘limlar'},{command:'attendance',description:'Davomat bo‘limini ochish'},{command:'admin',description:'Admin bo‘limini ochish'},{command:'group',description:'Ota-onalar guruhini ulash'}]);
      await bot.api.setChatMenuButton({menu_button:{type:'web_app',text:'Davomat',web_app:{url:teacherUrl}}});
      const [admins,teachers]=await withGithubDatabase(()=>Promise.all([prisma.admin.findMany({where:{faolmi:true}}),prisma.teacher.findMany({where:{faolmi:true,deletedAt:null}})]));
      const adminIds=new Set<string>(['8197301287',...admins.map((a:any)=>a.telegramId.toString())]);
      for(const id of adminIds)await bot.api.setChatMenuButton({chat_id:Number(id),menu_button:{type:'web_app',text:'Admin panel',web_app:{url:adminUrl}}}).catch(()=>{});
      for(const teacher of teachers.filter((t:any)=>!adminIds.has(String(t.telegramId))))await bot.api.setChatMenuButton({chat_id:Number(teacher.telegramId),menu_button:{type:'web_app',text:'Davomat',web_app:{url:teacherUrl}}}).catch(()=>{});
      console.log('Admin and teacher menus updated to stable production URLs.');
    }catch(error:any){console.error('Menu setup failed:',error.error_code||'network');}
  };

  await startBot();

  const server=app.listen(PORT, () => {
    console.log(`Bot server (va internal API) port ${PORT} da ishlayapti`);
  });
};

start().catch(error=>console.error('Bot startup failed:',error?.name));


