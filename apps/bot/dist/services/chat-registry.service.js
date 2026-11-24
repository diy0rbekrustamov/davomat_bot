"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestDatabaseBackup = requestDatabaseBackup;
exports.canManageGroups = canManageGroups;
exports.isGroupAdmin = isGroupAdmin;
exports.registrationIds = registrationIds;
exports.rememberChat = rememberChat;
exports.migrateChat = migrateChat;
const db_1 = require("@davomat/db");
let backupTimer;
function requestDatabaseBackup() {
    if (process.env.GITHUB_PRIMARY === '1' || backupTimer)
        return;
    backupTimer = setTimeout(() => {
        backupTimer = undefined;
        void fetch('http://127.0.0.1:3000/internal/sync-database', {
            method: 'POST', headers: { 'x-internal-token': process.env.BOT_TOKEN || '' }, signal: AbortSignal.timeout(5000)
        }).then(r => { if (!r.ok)
            console.error('Database backup request failed:', r.status); }).catch(() => console.error('Database backup request unavailable; periodic backup will retry.'));
    }, 2000);
}
async function canManageGroups(id) {
    if (!id)
        return false;
    if (String(id) === '8197301287')
        return true;
    const admin = await db_1.prisma.admin.findUnique({ where: { telegramId: BigInt(id) } });
    if (admin?.faolmi)
        return true;
    return !!(await db_1.prisma.teacher.findUnique({ where: { telegramId: BigInt(id) } }))?.faolmi;
}
async function isGroupAdmin(id) { if (id === 8197301287)
    return true; return !!(await db_1.prisma.admin.findUnique({ where: { telegramId: BigInt(id) } }))?.faolmi; }
function registrationIds(raw) { try {
    const ids = JSON.parse(raw || '[]');
    return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [];
}
catch {
    return [];
} }
async function rememberChat(chat, active = true, addedBy) {
    if (chat.type !== 'group' && chat.type !== 'supergroup')
        return;
    const chatId = String(chat.id), title = chat.title || 'Nomsiz guruh';
    const existing = await db_1.prisma.telegramChat.findUnique({ where: { chatId } });
    const ids = registrationIds(existing?.addedByTelegramIds);
    if (active && addedBy && await canManageGroups(addedBy) && !ids.includes(String(addedBy)))
        ids.push(String(addedBy));
    const addedByTelegramIds = JSON.stringify(ids);
    if (existing?.title === title && existing.active === active && existing.addedByTelegramIds === addedByTelegramIds)
        return;
    await db_1.prisma.telegramChat.upsert({ where: { chatId }, create: { chatId, title, active, addedByTelegramIds }, update: { title, active, addedByTelegramIds } });
    requestDatabaseBackup();
}
async function migrateChat(oldId, newId, title) {
    await db_1.prisma.$transaction(async (tx) => {
        const old = await tx.telegramChat.findUnique({ where: { chatId: String(oldId) } }), current = await tx.telegramChat.findUnique({ where: { chatId: String(newId) } });
        const addedByTelegramIds = JSON.stringify([...new Set([...registrationIds(old?.addedByTelegramIds), ...registrationIds(current?.addedByTelegramIds)])]);
        await tx.telegramChat.upsert({ where: { chatId: String(newId) }, create: { chatId: String(newId), title, active: true, addedByTelegramIds }, update: { title, active: true, addedByTelegramIds } });
        await tx.telegramChat.updateMany({ where: { chatId: String(oldId) }, data: { active: false } });
        const groups = await tx.group.findMany();
        for (const group of groups) {
            let ids = [];
            try {
                const raw = JSON.parse(group.telegramChatIds);
                if (Array.isArray(raw))
                    ids = raw;
            }
            catch { }
            if (!ids.length && group.telegramChatId)
                ids = [group.telegramChatId];
            if (ids.includes(String(oldId))) {
                ids = [...new Set(ids.map(id => id === String(oldId) ? String(newId) : id))];
                await tx.group.update({ where: { id: group.id }, data: { telegramChatId: ids[0] || null, telegramChatIds: JSON.stringify(ids) } });
            }
        }
        const tasks = await tx.notification.findMany({ where: { harakat: 'ATTENDANCE_REPORT_PENDING' } });
        for (const task of tasks) {
            try {
                const state = JSON.parse(task.tafsilot || '{}');
                if (Array.isArray(state.parentDelivered) && state.parentDelivered.includes(String(oldId))) {
                    state.parentDelivered = state.parentDelivered.map((id) => id === String(oldId) ? String(newId) : id);
                    await tx.notification.update({ where: { id: task.id }, data: { tafsilot: JSON.stringify(state) } });
                }
            }
            catch { }
        }
    });
    requestDatabaseBackup();
}
