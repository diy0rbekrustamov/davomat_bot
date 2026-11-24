"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueAccessNotice = queueAccessNotice;
const db_1 = require("@davomat/db");
async function queueAccessNotice(telegramId, status, details) {
    await db_1.prisma.notification.create({ data: { harakat: 'ACCESS_NOTICE_PENDING', tafsilot: JSON.stringify({ telegramId: String(telegramId), status, details, nextAt: 0, attempts: 0 }) } });
}
