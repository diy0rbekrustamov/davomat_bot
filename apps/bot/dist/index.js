"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const bot_1 = require("./bot");
const grammy_1 = require("grammy");
const reminder_cron_1 = require("./cron/reminder.cron");
const announcement_handler_1 = require("./handlers/announcement.handler");
const db_1 = require("@davomat/db");
const notify_service_1 = __importDefault(require("./services/notify.service"));
const access_menu_service_1 = require("./services/access-menu.service");
const group_handler_1 = require("./handlers/group.handler");
const access_notice_service_1 = require("./services/access-notice.service");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
const BOT_MODE = process.env.BOT_MODE || 'polling';
const PORT = process.env.BOT_PORT || 3001;
// Backenddan keluvchi internal bildirishnomalar uchun endpoint
app.post('/internal/notify', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId)
        return res.status(400).json({ error: 'sessionId majburiy' });
    try {
        await (0, db_1.withGithubDatabase)(() => notify_service_1.default.sendAttendanceReport(sessionId));
        res.json({ success: true });
    }
    catch (error) {
        console.error('Xabar yuborish xatosi:', error);
        res.status(500).json({ error: error.message });
    }
});
app.post('/internal/delete-messages', async (req, res) => {
    const { messageIds, chatId } = req.body;
    if (!messageIds || !chatId)
        return res.status(400).json({ error: 'Data yetishmayapti' });
    try {
        for (const msgId of messageIds) {
            await bot_1.bot.api.deleteMessage(chatId, msgId).catch(() => { });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/internal/send-qr-zip', async (req, res) => {
    if (!process.env.BOT_TOKEN || req.headers['x-internal-token'] !== process.env.BOT_TOKEN)
        return res.sendStatus(403);
    const { telegramId, base64 } = req.body;
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0 || typeof base64 !== 'string' || base64.length > 28 * 1024 * 1024) {
        return res.status(400).json({ error: 'ZIP ma’lumotlari noto‘g‘ri' });
    }
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])))
        return res.status(400).json({ error: 'ZIP fayl noto‘g‘ri' });
    try {
        await bot_1.bot.api.sendDocument(telegramId, new grammy_1.InputFile(bytes, 'Guruhlar_QR_A4.zip'), {
            caption: '📚 Guruhlarning A4 QR rasmlari. Har bir rasm guruh nomi bilan saqlangan.',
        });
        return res.json({ success: true });
    }
    catch {
        return res.status(502).json({ error: 'ZIP Telegramga yuborilmadi' });
    }
});
app.post('/internal/send-photo', async (req, res) => {
    const { telegramId, base64, caption } = req.body;
    if (!telegramId || !base64)
        return res.status(400).json({ error: 'Data yetishmayapti' });
    try {
        const buffer = Buffer.from(base64.split(',')[1], 'base64');
        await bot_1.bot.api.sendPhoto(telegramId, new grammy_1.InputFile(buffer), {
            caption: caption || ''
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Rasm yuborish xatosi:', error);
        res.status(500).json({ error: error.message });
    }
});
app.post('/internal/teacher-status', async (req, res) => {
    const { telegramId, status } = req.body;
    if (!telegramId || !status)
        return res.status(400).json({ error: 'Data yetishmayapti' });
    try {
        const tid = Number(telegramId);
        const access = await (0, access_menu_service_1.refreshAccessMenu)(bot_1.bot.api, tid);
        if (status !== 'admin_changed') {
            const text = status === 'blocked' ? "O‘qituvchi profilingiz bloklandi." : status === 'deleted' ? "O‘qituvchi profilingiz o‘chirildi." : "O‘qituvchi profilingiz faol. Davomat olish uchun /start ni bosing.";
            await bot_1.bot.api.sendMessage(tid, text + (access.canAdmin ? " Admin huquqingiz saqlanadi. /start orqali bo‘limlarni oching." : ''), {
                reply_markup: access.canAdmin || access.canTeach ? (0, group_handler_1.keyboardFor)(tid) : { remove_keyboard: true }
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        if (error?.error_code === 400 && error?.description?.includes('chat not found')) {
            console.warn(`[WARN] Foydalanuvchi (ID: ${telegramId}) botni hali ishga tushirmagan. Xabar yuborilmadi.`);
            return res.json({ success: true, warning: 'Chat not found' });
        }
        else if (error?.error_code === 403 && error?.description?.includes('bot was blocked by the user')) {
            console.warn(`[WARN] Foydalanuvchi (ID: ${telegramId}) botni bloklagan. Xabar yuborilmadi.`);
            return res.json({ success: true, warning: 'Bot blocked' });
        }
        console.error('[ERROR] Teacher status update error:', error.message);
        res.status(500).json({ error: error.message });
    }
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));
const start = async () => {
    // Cron vazifalarni ishga tushirish
    (0, reminder_cron_1.setupCronJobs)();
    notify_service_1.default.startWorker();
    (0, announcement_handler_1.startAnnouncementWorker)();
    (0, access_notice_service_1.startAccessNoticeWorker)(bot_1.bot.api);
    if (BOT_MODE === 'webhook') {
        app.use('/bot-webhook', (0, grammy_1.webhookCallback)(bot_1.bot, 'express'));
    }
    const startBot = async () => {
        try {
            if (BOT_MODE === 'webhook') {
                const domain = process.env.WEBHOOK_DOMAIN;
                if (!domain)
                    throw new Error('WEBHOOK_DOMAIN kiritilmagan');
                await bot_1.bot.api.setWebhook(`${domain}/bot-webhook`, {
                    allowed_updates: ['message', 'my_chat_member', 'callback_query']
                });
                console.log(`Bot Webhook rejimida ishga tushdi: ${domain}`);
            }
            else {
                // Polling mode
                await bot_1.bot.api.deleteWebhook();
                bot_1.bot.start({
                    allowed_updates: ['message', 'my_chat_member', 'callback_query'],
                    onStart: async (botInfo) => {
                        console.log(`Bot Polling rejimida ishga tushdi: @${botInfo.username}`);
                        await (0, db_1.withGithubDatabase)(updateAllMenuButtons);
                    }
                }).catch(error => { console.error('Polling stopped:', error.message); setTimeout(startBot, 5000); });
            }
        }
        catch (error) {
            console.error('Botni ishga tushirishda xatolik:', error);
            console.log('5 soniyadan keyin qayta urinib ko\'riladi...');
            setTimeout(startBot, 5000);
        }
    };
    const updateAllMenuButtons = async () => {
        try {
            const { prisma } = require('@davomat/db');
            const adminUrl = process.env.ADMIN_WEBAPP_URL, teacherUrl = process.env.TEACHER_WEBAPP_URL;
            if (!adminUrl || !teacherUrl)
                return;
            await bot_1.bot.api.setMyCommands([{ command: 'start', description: 'Barcha bo‘limlar' }, { command: 'attendance', description: 'Davomat bo‘limini ochish' }, { command: 'admin', description: 'Admin bo‘limini ochish' }, { command: 'group', description: 'Ota-onalar guruhini ulash' }]);
            await bot_1.bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Davomat', web_app: { url: teacherUrl } } });
            const admins = await prisma.admin.findMany({ where: { faolmi: true } }), teachers = await prisma.teacher.findMany({ where: { faolmi: true } });
            const adminIds = new Set(['8197301287', ...admins.map((a) => a.telegramId.toString())]);
            for (const id of adminIds)
                await bot_1.bot.api.setChatMenuButton({ chat_id: Number(id), menu_button: { type: 'web_app', text: 'Admin panel', web_app: { url: adminUrl } } }).catch(() => { });
            for (const teacher of teachers)
                await bot_1.bot.api.setChatMenuButton({ chat_id: Number(teacher.telegramId), menu_button: { type: 'web_app', text: 'Davomat', web_app: { url: teacherUrl } } }).catch(() => { });
            console.log('Admin and teacher menus updated to stable production URLs.');
        }
        catch (error) {
            console.error('Menu setup failed:', error.error_code || 'network');
        }
    };
    await startBot();
    app.listen(PORT, () => {
        console.log(`Bot server (va internal API) port ${PORT} da ishlayapti`);
    });
};
start().catch(console.error);
