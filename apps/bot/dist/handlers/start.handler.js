"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startHandler = void 0;
const grammy_1 = require("grammy");
const db_1 = require("@davomat/db");
const group_handler_1 = require("./group.handler");
const access_notice_service_1 = require("../services/access-notice.service");
const reminder_settings_service_1 = require("../services/reminder-settings.service");
const startHandler = async (ctx) => {
    if (ctx.chat?.type !== 'private' || !ctx.from?.id)
        return;
    const telegramId = ctx.from.id;
    const adminUrl = process.env.ADMIN_WEBAPP_URL || 'https://davomat.provveb.uz';
    const teacherUrl = process.env.TEACHER_WEBAPP_URL || 'https://davomat.provveb.uz/teacher';
    try {
        await (0, access_notice_service_1.resumeAccessNotices)(telegramId);
        // Administrative access and teaching access are independent capabilities.
        const [admin, teacher] = await Promise.all([
            db_1.prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } }),
            db_1.prisma.teacher.findUnique({ where: { telegramId: BigInt(telegramId) } }),
        ]);
        const canAdmin = telegramId === 8197301287 || !!admin?.faolmi;
        const canTeach = !!teacher?.faolmi && !teacher?.deletedAt;
        if (!canAdmin && !canTeach)
            return ctx.reply('Siz tizimda faol foydalanuvchi sifatida ro‘yxatdan o‘tmagansiz. Administratorga murojaat qiling.');
        const reminderState = telegramId === reminder_settings_service_1.DEVELOPER_ID ? await (0, reminder_settings_service_1.remindersEnabled)() : undefined;
        await ctx.reply("Ota-onalar guruhlarini ulash uchun Guruh qo'shish tugmasini bosing.", { reply_markup: (0, group_handler_1.keyboardFor)(telegramId, reminderState) });
        const keyboard = new grammy_1.InlineKeyboard();
        if (canAdmin)
            keyboard.webApp('👨‍💻 Admin Panelga kirish', adminUrl);
        if (canAdmin && canTeach)
            keyboard.row();
        if (canTeach)
            keyboard.webApp('📷 Davomatni belgilash', teacherUrl);
        const name = teacher?.faolmi ? teacher.ismFamiliya : admin?.ismFamiliya || 'Asosiy Egasi';
        return ctx.reply(`Assalomu alaykum, ${name}.\nKerakli bo‘limni tanlang:`, { reply_markup: keyboard });
    }
    catch {
        return ctx.reply('Tizim bilan bog‘lanishda xatolik yuz berdi. Qayta urinib ko‘ring.');
    }
};
exports.startHandler = startHandler;
