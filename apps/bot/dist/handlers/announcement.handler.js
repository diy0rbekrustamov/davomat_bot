"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerKeyboard = exports.ANNOUNCE_BUTTON = void 0;
exports.beginAnnouncement = beginAnnouncement;
exports.announcementMessage = announcementMessage;
exports.startAnnouncementWorker = startAnnouncementWorker;
const db_1 = require("@davomat/db");
const bot_1 = require("../bot");
const group_handler_1 = require("./group.handler");
const OWNER = 8197301287;
exports.ANNOUNCE_BUTTON = "📣 E'lon yuborish";
exports.ownerKeyboard = (0, group_handler_1.keyboardFor)(OWNER);
const draftId = 'owner-announcement-draft';
const allowed = (ctx) => ctx.chat?.type === 'private' && ctx.from?.id === OWNER;
async function recipients() { const [teachers, admins] = await Promise.all([db_1.prisma.teacher.findMany({ where: { faolmi: true } }), db_1.prisma.admin.findMany({ where: { faolmi: true } })]); return [...new Set([...teachers, ...admins].map(x => x.telegramId.toString()))]; }
async function beginAnnouncement(ctx) { if (!allowed(ctx))
    return; await db_1.prisma.notification.upsert({ where: { id: draftId }, create: { id: draftId, harakat: 'ANNOUNCEMENT_DRAFT', tafsilot: '{}' }, update: { harakat: 'ANNOUNCEMENT_DRAFT', tafsilot: '{}' } }); return ctx.reply('E’lon matni, rasm, video yoki hujjatni yuboring. /cancel bilan bekor qilishingiz mumkin.'); }
async function announcementMessage(ctx, next) {
    if (!allowed(ctx))
        return next();
    const task = await db_1.prisma.notification.findUnique({ where: { id: draftId } });
    if (!task || !['ANNOUNCEMENT_DRAFT', 'ANNOUNCEMENT_PREVIEW'].includes(task.harakat))
        return next();
    const text = ctx.message?.text;
    if (text === group_handler_1.STATUS_BUTTON || text === '📋 Ulangan guruhlar' || ctx.message?.chat_shared)
        return next();
    if (text === '/cancel' || text === '❌ Bekor qilish') {
        await db_1.prisma.notification.update({ where: { id: draftId }, data: { harakat: 'ANNOUNCEMENT_CANCELLED' } });
        return ctx.reply('E’lon bekor qilindi.', { reply_markup: exports.ownerKeyboard });
    }
    if (text === '✅ Hammaga yuborish') {
        if (task.harakat !== 'ANNOUNCEMENT_PREVIEW')
            return ctx.reply('Avval e’lon matnini yuboring.');
        const data = JSON.parse(task.tafsilot || '{}');
        const ids = await recipients();
        const job = 'announcement:' + require('crypto').randomUUID();
        await db_1.prisma.notification.create({ data: { id: job, harakat: 'ANNOUNCEMENT_PENDING', tafsilot: JSON.stringify({ ...data, recipients: ids, delivered: [], failed: [], nextAt: 0 }) } });
        await db_1.prisma.notification.update({ where: { id: draftId }, data: { harakat: 'ANNOUNCEMENT_QUEUED' } });
        return ctx.reply(`E’lon ${ids.length} kishiga yuborish navbatiga qo‘yildi. Tugagach natija keladi.`, { reply_markup: exports.ownerKeyboard });
    }
    if (text?.startsWith('/'))
        return next();
    if (!ctx.message || (!text && !ctx.message.photo && !ctx.message.video && !ctx.message.document && !ctx.message.animation && !ctx.message.audio && !ctx.message.voice))
        return ctx.reply('Matn, rasm, video yoki hujjat yuboring.');
    const data = { chatId: ctx.chat.id, messageId: ctx.message.message_id };
    await db_1.prisma.notification.update({ where: { id: draftId }, data: { harakat: 'ANNOUNCEMENT_PREVIEW', tafsilot: JSON.stringify(data) } });
    const ids = await recipients();
    return ctx.reply(`Shu xabar ${ids.length} ta faol o‘qituvchi va adminga yuboriladi. Ikkala roldagi foydalanuvchi bir marta oladi. Tasdiqlaysizmi?`, { reply_markup: { keyboard: [[{ text: '✅ Hammaga yuborish' }], [{ text: '❌ Bekor qilish' }]], resize_keyboard: true } });
}
let running = false;
function startAnnouncementWorker() {
    const tick = async () => {
        if (running)
            return;
        running = true;
        try {
            await (0, db_1.withGithubDatabase)(async () => {
                const tasks = await db_1.prisma.notification.findMany({ where: { harakat: { in: ['ANNOUNCEMENT_PENDING', 'ANNOUNCEMENT_DONE_NOTICE'] } }, orderBy: { vaqt: 'asc' } });
                for (const task of tasks) {
                    const data = JSON.parse(task.tafsilot || '{}');
                    if (data.nextAt > Date.now())
                        continue;
                    if (task.harakat === 'ANNOUNCEMENT_PENDING') {
                        for (const id of data.recipients) {
                            if (data.delivered.includes(id) || data.failed.includes(id))
                                continue;
                            try {
                                await bot_1.bot.api.copyMessage(id, data.chatId, data.messageId);
                                data.delivered.push(id);
                            }
                            catch (error) {
                                if (error.error_code === 403 || error.error_code === 400) {
                                    data.failed.push(id);
                                }
                                else {
                                    data.nextAt = Date.now() + Math.max(30000, (error.parameters?.retry_after || 0) * 1000);
                                    break;
                                }
                            }
                            await db_1.prisma.notification.update({ where: { id: task.id }, data: { tafsilot: JSON.stringify(data) } });
                            await new Promise(r => setTimeout(r, 70));
                        }
                        const complete = data.delivered.length + data.failed.length === data.recipients.length;
                        await db_1.prisma.notification.update({ where: { id: task.id }, data: { harakat: complete ? 'ANNOUNCEMENT_DONE_NOTICE' : 'ANNOUNCEMENT_PENDING', tafsilot: JSON.stringify(data) } });
                        if (!complete)
                            continue;
                    }
                    await bot_1.bot.api.sendMessage(OWNER, `📣 E’lon natijasi\nYetkazildi: ${data.delivered.length}\nYetkazilmadi: ${data.failed.length}\nBotni bloklagan yoki ishga tushirmagan foydalanuvchilarga yuborib bo‘lmaydi.`);
                    await db_1.prisma.notification.update({ where: { id: task.id }, data: { harakat: 'ANNOUNCEMENT_DELIVERED' } });
                }
            });
        }
        catch {
            console.error('Announcement worker will retry.');
        }
        finally {
            running = false;
        }
    };
    void tick();
    setInterval(() => void tick(), 15000).unref();
}
