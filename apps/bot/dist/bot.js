"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const grammy_1 = require("grammy");
const dotenv_1 = __importDefault(require("dotenv"));
const start_handler_1 = require("./handlers/start.handler");
const db_1 = require("@davomat/db");
const chat_registry_service_1 = require("./services/chat-registry.service");
const group_handler_1 = require("./handlers/group.handler");
const group_handler_2 = require("./handlers/group.handler");
const owner_handler_1 = require("./handlers/owner.handler");
const announcement_handler_1 = require("./handlers/announcement.handler");
const reminder_handler_1 = require("./handlers/reminder.handler");
const reminder_settings_service_1 = require("./services/reminder-settings.service");
dotenv_1.default.config();
const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error('BOT_TOKEN .env faylda ko`rsatilmagan!');
}
exports.bot = new grammy_1.Bot(token);
exports.bot.use(async (ctx, next) => {
    const reply = ctx.reply.bind(ctx);
    const responses = [];
    if (process.env.GITHUB_PRIMARY === '1')
        ctx.reply = async (...args) => { responses.push(args); return { message_id: 0 }; };
    try {
        await (0, db_1.withGithubDatabase)(next);
        ctx.reply = reply;
        for (const args of responses)
            await reply(...args);
    }
    catch {
        ctx.reply = reply;
        if (ctx.chat?.type === 'private')
            await ctx.reply('GitHub bilan bog‘lanishda xatolik. Amal saqlangani tasdiqlanmadi; qayta urinib ko‘ring.');
    }
});
// Register group lifecycle before command handlers; never log private updates.
exports.bot.use(async (ctx, next) => {
    const chat = ctx.chat;
    if (chat && (chat.type === 'group' || chat.type === 'supergroup')) {
        const member = ctx.myChatMember?.new_chat_member;
        const active = member ? member.status !== 'left' && member.status !== 'kicked' && (member.status !== 'restricted' || member.is_member) : true;
        if (ctx.message?.migrate_to_chat_id)
            await (0, chat_registry_service_1.migrateChat)(chat.id, ctx.message.migrate_to_chat_id, chat.title);
        else if (ctx.message?.migrate_from_chat_id)
            await (0, chat_registry_service_1.migrateChat)(ctx.message.migrate_from_chat_id, chat.id, chat.title);
        else {
            const explicitRegistration = !!ctx.myChatMember || ctx.message?.new_chat_members?.some(m => m.id === ctx.me.id) || /^\/(start|group)(@\w+)?(?:\s|$)/.test(ctx.message?.text || '');
            await (0, chat_registry_service_1.rememberChat)(chat, active, explicitRegistration && active ? ctx.from?.id : undefined);
        }
    }
    await next();
});
exports.bot.command('announce', announcement_handler_1.beginAnnouncement);
exports.bot.hears(announcement_handler_1.ANNOUNCE_BUTTON, announcement_handler_1.beginAnnouncement);
exports.bot.command('status', owner_handler_1.systemStatusHandler);
exports.bot.hears(group_handler_2.STATUS_BUTTON, owner_handler_1.systemStatusHandler);
exports.bot.command('reminders', reminder_handler_1.reminderSettingsHandler);
exports.bot.hears([reminder_settings_service_1.REMINDER_SETTINGS_BUTTON, reminder_settings_service_1.REMINDER_DISABLE_BUTTON, reminder_settings_service_1.REMINDER_ENABLE_BUTTON], reminder_handler_1.reminderSettingsHandler);
exports.bot.on('message', announcement_handler_1.announcementMessage);
exports.bot.command('start', start_handler_1.startHandler);
exports.bot.command('attendance', start_handler_1.startHandler);
exports.bot.command('admin', start_handler_1.startHandler);
exports.bot.command('group', group_handler_1.groupHandler);
exports.bot.on('message:chat_shared', group_handler_1.sharedChatHandler);
exports.bot.hears('📋 Ulangan guruhlar', owner_handler_1.linkedGroupsHandler);
exports.bot.catch((err) => {
    console.error('Bot update failed:', err.error instanceof Error ? err.error.name : 'request');
});
