"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REMINDER_SCHEDULE = exports.REMINDER_TIMEZONE = void 0;
exports.tashkentDayRange = tashkentDayRange;
exports.reminderText = reminderText;
exports.sendAttendanceReminders = sendAttendanceReminders;
const db_1 = require("@davomat/db");
const reminder_settings_service_1 = require("./reminder-settings.service");
exports.REMINDER_TIMEZONE = 'Asia/Tashkent';
exports.REMINDER_SCHEDULE = '20 8 * * *';
function tashkentDayRange(now) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: exports.REMINDER_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const part = (type) => parts.find(value => value.type === type).value;
    const start = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00+05:00`);
    return { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
function reminderText(name) {
    const safeName = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `🔔 <b>Eslatma!</b>\n\nHurmatli ${safeName}, bugun 8:30 da davomatni belgilash yodingizdan ko'tarilmasin..`;
}
async function sendAttendanceReminders(api, now = new Date()) {
    if (!await (0, reminder_settings_service_1.remindersEnabled)())
        return;
    const teachers = await db_1.prisma.teacher.findMany({ where: { faolmi: true, deletedAt: null } });
    const today = tashkentDayRange(now);
    let sent = 0;
    for (const teacher of teachers) {
        const sessions = await db_1.prisma.attendanceSession.count({ where: { teacherId: teacher.id, sana: today } });
        if (sessions > 0)
            continue;
        try {
            await api.sendMessage(Number(teacher.telegramId), reminderText(teacher.ismFamiliya), { parse_mode: 'HTML' });
            sent++;
        }
        catch {
            console.error('Davomat eslatmasi yetkazilmadi.');
        }
    }
    console.log(`Davomat eslatmasi: ${sent} ta xabar yuborildi.`);
}
