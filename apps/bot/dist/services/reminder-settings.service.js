"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REMINDER_ENABLE_BUTTON = exports.REMINDER_DISABLE_BUTTON = exports.REMINDER_SETTINGS_BUTTON = exports.DEVELOPER_ID = void 0;
exports.remindersEnabled = remindersEnabled;
exports.setRemindersEnabled = setRemindersEnabled;
const db_1 = require("@davomat/db");
exports.DEVELOPER_ID = 8197301287;
exports.REMINDER_SETTINGS_BUTTON = '🔔 Eslatma sozlamalari';
exports.REMINDER_DISABLE_BUTTON = '🔕 Eslatmalarni o‘chirish';
exports.REMINDER_ENABLE_BUTTON = '🔔 Eslatmalarni yoqish';
const SETTINGS_ID = 'attendance-reminder-settings';
async function remindersEnabled() {
    const settings = await db_1.prisma.notification.findUnique({ where: { id: SETTINGS_ID } });
    return settings?.tafsilot !== 'disabled';
}
async function setRemindersEnabled(enabled) {
    const data = { harakat: 'ATTENDANCE_REMINDER_SETTINGS', tafsilot: enabled ? 'enabled' : 'disabled' };
    await db_1.prisma.notification.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, ...data },
        update: data,
    });
}
