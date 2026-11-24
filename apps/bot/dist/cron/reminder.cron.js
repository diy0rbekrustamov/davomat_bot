"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = require("@davomat/db");
const bot_1 = require("../bot");
const reminder_service_1 = require("../services/reminder.service");
const setupCronJobs = () => {
    console.log(`Davomat eslatmasi: 08:20 (${reminder_service_1.REMINDER_TIMEZONE}).`);
    return node_cron_1.default.schedule(reminder_service_1.REMINDER_SCHEDULE, async () => {
        try {
            await (0, db_1.withGithubDatabase)(() => (0, reminder_service_1.sendAttendanceReminders)(bot_1.bot.api));
        }
        catch {
            console.error('Davomat eslatmasini yuborishda xatolik.');
        }
    }, { timezone: reminder_service_1.REMINDER_TIMEZONE });
};
exports.setupCronJobs = setupCronJobs;
