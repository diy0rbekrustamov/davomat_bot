"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("@davomat/db");
const bot_1 = require("../bot");
const grammy_1 = require("grammy");
const report_format_1 = require("./report-format");
const chat_registry_service_1 = require("./chat-registry.service");
class NotifyService {
    working = new Set();
    async sendAttendanceReport(sessionId) {
        const id = 'attendance-report:' + sessionId;
        await db_1.prisma.notification.upsert({ where: { id }, create: { id, harakat: 'ATTENDANCE_REPORT_PENDING', tafsilot: JSON.stringify({ sessionId, adminDone: false, parentsDone: false, attempts: 0, nextAt: 0 }) }, update: {} });
        await this.deliver(id);
    }
    async send(chatId, text, photos, admin = false) {
        const ids = [];
        const url = process.env.ADMIN_WEBAPP_URL;
        const markup = admin && url ? { inline_keyboard: [[{ text: '📊 Hisobotlar', ...(chatId.startsWith('-') ? { url: url.replace(/\/$/, '') + '/history' } : { web_app: { url: url.replace(/\/$/, '') + '/history' } }) }]] } : undefined;
        for (const [index, chunk] of (0, report_format_1.textChunks)(text).entries()) {
            const message = await bot_1.bot.api.sendMessage(chatId, chunk, { ...(index === 0 && markup ? { reply_markup: markup } : {}) });
            ids.push(message.message_id);
        }
        if (photos.length === 1)
            ids.push((await bot_1.bot.api.sendPhoto(chatId, photos[0].startsWith('https://') ? photos[0] : new grammy_1.InputFile(photos[0]))).message_id);
        else if (photos.length > 1) {
            const media = photos.slice(0, 10).map(p => ({ type: 'photo', media: p.startsWith('https://') ? p : new grammy_1.InputFile(p) }));
            ids.push(...(await bot_1.bot.api.sendMediaGroup(chatId, media)).map(m => m.message_id));
        }
        return ids;
    }
    async deliver(id) {
        if (this.working.has(id))
            return;
        this.working.add(id);
        try {
            const task = await db_1.prisma.notification.findUnique({ where: { id } });
            if (!task || task.harakat !== 'ATTENDANCE_REPORT_PENDING')
                return;
            const state = JSON.parse(task.tafsilot || '{}');
            if (state.nextAt > Date.now())
                return;
            const session = await db_1.prisma.attendanceSession.findUnique({ where: { id: state.sessionId }, include: { group: true, teacher: true, records: { include: { student: true } } } });
            if (!session) {
                await db_1.prisma.notification.update({ where: { id }, data: { harakat: 'ATTENDANCE_REPORT_CANCELLED' } });
                return;
            }
            let photos = [];
            try {
                photos = JSON.parse(session.rasmlar || '[]');
            }
            catch { }
            const save = () => db_1.prisma.notification.update({ where: { id }, data: { tafsilot: JSON.stringify(state) } });
            const failures = [];
            if (!state.adminDone) {
                try {
                    if (process.env.ADMIN_CHAT_ID) {
                        const ids = await this.send(process.env.ADMIN_CHAT_ID, (0, report_format_1.attendanceText)(session), photos, true);
                        await db_1.prisma.attendanceSession.update({ where: { id: session.id }, data: { telegramMessageIds: JSON.stringify(ids) } });
                    }
                    state.adminDone = true;
                    await save();
                }
                catch (error) {
                    failures.push(error);
                }
            }
            if (!state.parentsDone) {
                let targets = [];
                try {
                    const raw = JSON.parse(session.group.telegramChatIds);
                    if (Array.isArray(raw))
                        targets = raw.filter((id) => typeof id === 'string');
                }
                catch { }
                if (!targets.length && session.group.telegramChatId)
                    targets = [session.group.telegramChatId];
                targets = [...new Set(targets)];
                state.parentDelivered ||= [];
                for (const chatId of targets) {
                    if (state.parentDelivered.includes(chatId))
                        continue;
                    try {
                        await this.send(chatId, (0, report_format_1.attendanceText)(session, true), photos);
                        state.parentDelivered.push(chatId);
                        await save();
                    }
                    catch (error) {
                        failures.push(error);
                    }
                }
                state.parentsDone = targets.every(chatId => state.parentDelivered.includes(chatId));
                await save();
            }
            if (state.adminDone && state.parentsDone) {
                await db_1.prisma.notification.update({ where: { id }, data: { harakat: 'ATTENDANCE_REPORT_DELIVERED', tafsilot: JSON.stringify(state) } });
                (0, chat_registry_service_1.requestDatabaseBackup)();
            }
            else {
                state.attempts++;
                state.nextAt = Date.now() + Math.max(...failures.map(error => (error.parameters?.retry_after || 0) * 1000), Math.min(3600000, 30000 * 2 ** Math.min(state.attempts - 1, 7)));
                state.lastError = String(failures[0]?.error_code || 'network');
                await save();
                (0, chat_registry_service_1.requestDatabaseBackup)();
                console.error('Attendance delivery queued for retry:', state.lastError);
            }
        }
        finally {
            this.working.delete(id);
        }
    }
    startWorker() { let running = false; const tick = async () => { if (running)
        return; running = true; try {
        await (0, db_1.withGithubDatabase)(async () => { const tasks = await db_1.prisma.notification.findMany({ where: { harakat: 'ATTENDANCE_REPORT_PENDING' }, orderBy: { vaqt: 'asc' } }); for (const task of tasks)
            await this.deliver(task.id); });
    }
    catch {
        console.error('Attendance delivery queue unavailable; will retry.');
    }
    finally {
        running = false;
    } }; void tick(); setInterval(() => void tick(), 15000).unref(); }
}
exports.default = new NotifyService();
