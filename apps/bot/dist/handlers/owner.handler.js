"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemStatusHandler = systemStatusHandler;
exports.linkedGroupsHandler = linkedGroupsHandler;
const perf_hooks_1 = require("perf_hooks");
const diagnostics_service_1 = require("../services/diagnostics.service");
const db_1 = require("@davomat/db");
const group_handler_1 = require("./group.handler");
const chat_registry_service_1 = require("../services/chat-registry.service");
async function systemStatusHandler(ctx) {
    if (ctx.chat?.type !== 'private' || ctx.from?.id !== 8197301287)
        return;
    const start = perf_hooks_1.performance.now();
    await db_1.prisma.$queryRawUnsafe('SELECT 1');
    const dbMs = (perf_hooks_1.performance.now() - start).toFixed(1);
    const [admins, teachers, groups, students, chats, sessions, records, notices, announcements, info] = await Promise.all([
        db_1.prisma.admin.count({ where: { faolmi: true } }), db_1.prisma.teacher.count({ where: { faolmi: true, deletedAt: null } }),
        db_1.prisma.group.count({ where: { faolmi: true } }), db_1.prisma.student.count(), db_1.prisma.telegramChat.count({ where: { active: true } }),
        db_1.prisma.attendanceSession.count(), db_1.prisma.attendanceRecord.count(),
        db_1.prisma.notification.count({ where: { harakat: { in: ['ACCESS_NOTICE_PENDING', 'ACCESS_NOTICE_WAITING_START', 'ATTENDANCE_REPORT_PENDING'] } } }),
        db_1.prisma.notification.count({ where: { harakat: { in: ['ANNOUNCEMENT_PENDING', 'ANNOUNCEMENT_DONE_NOTICE'] } } }),
        (0, diagnostics_service_1.runtimeDiagnostics)()
    ]);
    const h = diagnostics_service_1.escapeHtml;
    const text = `⚡️ <b>TIZIMNING TO'LIQ DIAGNOSTIKASI</b> ⚡️

🖥 <b>SERVER RESURSLARI</b>
• ⚙️ <b>OS:</b> ${h(info.os)}
• 🧠 <b>CPU:</b> ${h(info.cpu)}
• 📉 <b>CPU Yuklamasi:</b> ${info.load}; load 1/5/15 min: ${info.loadavg}
• 🔋 <b>RAM:</b> ${info.ram}
• 💾 <b>ROM (Disk):</b> ${info.disk}
• ⏱ <b>Uptime:</b> ${info.uptime}

🛠 <b>Dastur (Node.js) Holati</b>
• 🟢 <b>Status:</b> ✅ ONLINE — ${process.version}
• 📦 <b>Xotira (Heap):</b> ${info.heap}
• 🗂 <b>Xotira (RSS):</b> ${info.rss}
• ⚡️ <b>Ping:</b> ${info.api.ms} ms (ichki API)
• ⏱ <b>Bot Uptime:</b> ${info.nodeUptime}

💾 <b>MA'LUMOTLAR BAZASI (SQLite)</b>
• 🟢 <b>Holati:</b> ✅ ONLINE
• ⚡️ <b>Javob tezligi:</b> ${dbMs} ms (SELECT 1)
• 👨‍💼 <b>Adminlar:</b> ${admins} faol
• 👨‍🏫 <b>O'qituvchilar:</b> ${teachers} faol
• 📚 <b>Guruhlar:</b> ${groups} faol
• 🎓 <b>O'quvchilar:</b> ${students}
• 📊 <b>Davomatlar:</b> ${sessions} sessiya / ${records} yozuv
• 👥 <b>Ulangan guruhlar:</b> ${chats}
• 📨 <b>Xabar / e’lon navbati:</b> ${notices} / ${announcements}
• ☁️ <b>Saqlash:</b> ${process.env.GITHUB_PRIMARY === '1' ? 'GitHub → vaqtinchalik RAM; joriy o‘qish muvaffaqiyatli' : 'mahalliy sinov rejimi'}

🌐 <b>TARMOQ VA WEB</b>
• 🔗 <b>API Ulanishi:</b> ${info.api.ok ? '✅ Faol' : '⚠️ Xatolik'}
• 🌍 <b>Domen:</b> ${info.web.ok ? '✅' : '⚠️'} davomat.provveb.uz (${info.web.ms} ms)
• 🛡 <b>SSL Sertifikat:</b> ${info.ssl.ok ? `✅ Faol (HTTPS), ${info.ssl.days} kun qoldi` : '⚠️ Tasdiqlanmadi'}

${info.issues.length === 0 ? '✅ Tekshirilgan xizmatlar ishlayapti; diagnostikada xatolik aniqlanmadi.' : '⚠️ Aniqlangan holatlar: ' + h(info.issues.join('; '))}
🕒 ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`;
    return ctx.reply(text, { parse_mode: 'HTML', reply_markup: (0, group_handler_1.keyboardFor)(ctx.from.id) });
}
async function linkedGroupsHandler(ctx) {
    if (ctx.chat?.type !== 'private' || !await (0, chat_registry_service_1.canManageGroups)(ctx.from?.id))
        return;
    const all = await db_1.prisma.telegramChat.findMany({ where: { active: true } }), admin = await (0, chat_registry_service_1.isGroupAdmin)(ctx.from.id);
    const groups = (admin ? all : all.filter(c => (0, chat_registry_service_1.registrationIds)(c.addedByTelegramIds).includes(String(ctx.from.id))))
        .sort((a, b) => a.title.localeCompare(b.title, 'uz', { numeric: true }));
    let page = `📋 ${admin ? 'Barcha ulangan' : 'Siz qo‘shgan'} ota-onalar guruhlari: ${groups.length} ta.\n`;
    for (let i = 0; i < groups.length; i++) {
        const line = `\n${i + 1}. ${groups[i].title.slice(0, 255)} — ${groups[i].chatId}`;
        if (page.length + line.length > 3500) {
            await ctx.reply(page);
            page = '📋 Ro‘yxat davomi:\n';
        }
        page += line;
    }
    return ctx.reply(page + (groups.length ? '' : '\nHozircha ulangan guruh yo‘q.'), { reply_markup: (0, group_handler_1.keyboardFor)(ctx.from?.id) });
}
