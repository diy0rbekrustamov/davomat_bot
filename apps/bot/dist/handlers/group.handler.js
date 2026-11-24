"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATUS_BUTTON = exports.groupKeyboard = exports.GROUP_REQUEST_ID = void 0;
exports.keyboardFor = keyboardFor;
exports.groupHandler = groupHandler;
exports.sharedChatHandler = sharedChatHandler;
const chat_registry_service_1 = require("../services/chat-registry.service");
const reminder_settings_service_1 = require("../services/reminder-settings.service");
exports.GROUP_REQUEST_ID = 27001;
exports.groupKeyboard = { keyboard: [[{ text: "➕ Guruh qo'shish", request_chat: { request_id: exports.GROUP_REQUEST_ID, chat_is_channel: false, bot_is_member: true, request_title: true } }], [{ text: '📋 Ulangan guruhlar' }]], resize_keyboard: true };
exports.STATUS_BUTTON = '💻 Tizim Holati';
function keyboardFor(id, remindersEnabled) { return id === reminder_settings_service_1.DEVELOPER_ID ? { ...exports.groupKeyboard, keyboard: [[...exports.groupKeyboard.keyboard[0], ...exports.groupKeyboard.keyboard[1]], [{ text: exports.STATUS_BUTTON }, { text: "📣 E'lon yuborish" }], [{ text: remindersEnabled === undefined ? reminder_settings_service_1.REMINDER_SETTINGS_BUTTON : remindersEnabled ? reminder_settings_service_1.REMINDER_DISABLE_BUTTON : reminder_settings_service_1.REMINDER_ENABLE_BUTTON }]] } : exports.groupKeyboard; }
async function groupHandler(ctx) {
    if (ctx.chat?.type !== 'private')
        return;
    if (!await (0, chat_registry_service_1.canManageGroups)(ctx.from?.id))
        return ctx.reply("Guruh ulash faqat faol o'qituvchi va adminlar uchun.");
    return ctx.reply("Bot qo'shilgan ota-onalar guruhini pastdagi tugmadan tanlang. Siz qo'shgan guruh sizning ro'yxatingizga saqlanadi. Adminlar barcha guruhlarni ko'radi.", { reply_markup: keyboardFor(ctx.from?.id) });
}
async function sharedChatHandler(ctx) {
    if (ctx.chat?.type !== 'private' || !await (0, chat_registry_service_1.canManageGroups)(ctx.from?.id))
        return;
    const shared = ctx.message?.chat_shared;
    if (!shared || shared.request_id !== exports.GROUP_REQUEST_ID)
        return;
    try {
        const chat = await ctx.api.getChat(shared.chat_id);
        if (chat.type !== 'group' && chat.type !== 'supergroup')
            return ctx.reply('Ota-onalar guruhini tanlang.');
        const member = await ctx.api.getChatMember(chat.id, ctx.me.id);
        if (member.status === 'left' || member.status === 'kicked' || (member.status === 'restricted' && !member.is_member))
            return ctx.reply("Avval botni shu guruhga qo'shing, keyin qayta tanlang.");
        await (0, chat_registry_service_1.rememberChat)(chat, true, ctx.from?.id);
        return ctx.reply(`✅ ${chat.title} sizning ro'yxatingizga saqlandi.\nMini App'da Telegram ro'yxatini yangilang.`, { reply_markup: keyboardFor(ctx.from?.id) });
    }
    catch {
        return ctx.reply("Guruhga kirib bo'lmadi. Bot guruhda ekanini va xabar yozish huquqini tekshiring, keyin qayta tanlang.");
    }
}
