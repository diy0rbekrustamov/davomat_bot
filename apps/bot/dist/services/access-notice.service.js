"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeAccessNotices = resumeAccessNotices;
exports.deliverAccessNotices = deliverAccessNotices;
exports.startAccessNoticeWorker = startAccessNoticeWorker;
const db_1 = require("@davomat/db");
const access_menu_service_1 = require("./access-menu.service");
const labels = {
    new_teacher: '✅ Siz o‘qituvchi sifatida qo‘shildingiz.',
    blocked: '⛔ O‘qituvchi profilingiz bloklandi. Davomat olish vaqtincha cheklangan.',
    unblocked: '✅ O‘qituvchi profilingiz qayta faollashtirildi.',
    deleted: '📁 O‘qituvchi profilingiz olib tashlandi. Davomat tarixi va guruhlaringiz saqlangan.',
    teacher_updated: '✏️ O‘qituvchi profilingiz yangilandi.',
    admin_added: '🛡 Sizga admin huquqi berildi.',
    admin_restored: '✅ Admin huquqingiz qayta faollashtirildi.',
    admin_removed: '📁 Admin huquqingiz olib tashlandi.',
    leader_assigned: '👥 Siz guruh rahbari etib biriktirildingiz.',
    leader_removed: '👥 Ushbu guruh rahbarligi sizdan olib tashlandi.',
    group_archived: '📁 Siz rahbar bo‘lgan guruh arxivlandi.',
};
async function resumeAccessNotices(telegramId) {
    const tasks = await db_1.prisma.notification.findMany({ where: { harakat: 'ACCESS_NOTICE_WAITING_START' } });
    for (const t of tasks) {
        const d = JSON.parse(t.tafsilot || '{}');
        if (d.telegramId === String(telegramId))
            await db_1.prisma.notification.update({ where: { id: t.id }, data: { harakat: 'ACCESS_NOTICE_PENDING', tafsilot: JSON.stringify({ ...d, nextAt: 0 }) } });
    }
}
async function deliverAccessNotices(api) {
    return (0, db_1.withGithubDatabase)(async () => {
        const tasks = await db_1.prisma.notification.findMany({ where: { harakat: 'ACCESS_NOTICE_PENDING' }, orderBy: [{ vaqt: 'asc' }, { id: 'asc' }] });
        for (const task of tasks) {
            const d = JSON.parse(task.tafsilot || '{}');
            if (d.nextAt > Date.now())
                continue;
            try {
                const access = await (0, access_menu_service_1.refreshAccessMenu)(api, Number(d.telegramId));
                const buttons = [];
                if (access.canAdmin)
                    buttons.push([{ text: '👨‍💻 Admin Panel', web_app: { url: process.env.ADMIN_WEBAPP_URL || 'https://davomat.provveb.uz' } }]);
                if (access.canTeach)
                    buttons.push([{ text: '📷 Davomat', web_app: { url: process.env.TEACHER_WEBAPP_URL || 'https://davomat.provveb.uz/teacher' } }]);
                const current = [access.canAdmin ? 'Admin' : null, access.canTeach ? 'O‘qituvchi' : null].filter(Boolean).join(' + ') || 'Faol rol yo‘q';
                await api.sendMessage(d.telegramId, `${labels[d.status] || 'Profil huquqlaringiz yangilandi.'}${d.details ? '\n' + d.details : ''}\n\nJoriy faol rollar: ${current}.\nBo‘limlarni ochish uchun /start.`, { reply_markup: buttons.length ? { inline_keyboard: buttons } : { remove_keyboard: true } });
                await db_1.prisma.notification.update({ where: { id: task.id }, data: { harakat: 'ACCESS_NOTICE_DELIVERED', tafsilot: JSON.stringify({ ...d, deliveredAt: new Date().toISOString() }) } });
            }
            catch (error) {
                const waiting = error.error_code === 403 || (error.error_code === 400 && /chat not found|user.*not found/i.test(error.description || ''));
                d.attempts = (d.attempts || 0) + 1;
                d.nextAt = Date.now() + Math.max(30000, (error.parameters?.retry_after || 0) * 1000);
                d.lastError = error.error_code || 'network';
                await db_1.prisma.notification.update({ where: { id: task.id }, data: { harakat: waiting ? 'ACCESS_NOTICE_WAITING_START' : 'ACCESS_NOTICE_PENDING', tafsilot: JSON.stringify(d) } });
            }
        }
    });
}
function startAccessNoticeWorker(api) { let running = false; const tick = async () => { if (running)
    return; running = true; try {
    await deliverAccessNotices(api);
}
catch {
    console.error('Access notification queue will retry.');
}
finally {
    running = false;
} }; void tick(); setInterval(() => void tick(), 15000).unref(); }
