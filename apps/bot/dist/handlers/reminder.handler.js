"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderSettingsHandler = reminderSettingsHandler;
const group_handler_1 = require("./group.handler");
const reminder_settings_service_1 = require("../services/reminder-settings.service");
async function reminderSettingsHandler(ctx) {
    if (ctx.chat?.type !== 'private' || ctx.from?.id !== reminder_settings_service_1.DEVELOPER_ID)
        return;
    const text = ctx.message?.text;
    if (text === reminder_settings_service_1.REMINDER_DISABLE_BUTTON)
        await (0, reminder_settings_service_1.setRemindersEnabled)(false);
    if (text === reminder_settings_service_1.REMINDER_ENABLE_BUTTON)
        await (0, reminder_settings_service_1.setRemindersEnabled)(true);
    const enabled = await (0, reminder_settings_service_1.remindersEnabled)();
    return ctx.reply(enabled
        ? '🔔 Avtomatik eslatmalar yoqilgan. Har kuni Toshkent vaqti bilan 08:20 da davomat kiritmagan faol o‘qituvchilarga 08:30 dagi davomat eslatiladi.'
        : '🔕 Avtomatik eslatmalar barcha o‘qituvchilar uchun o‘chirildi. Qayta yoqmaguningizcha eslatma yuborilmaydi.', { reply_markup: (0, group_handler_1.keyboardFor)(reminder_settings_service_1.DEVELOPER_ID, enabled) });
}
