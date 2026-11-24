"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessFor = accessFor;
exports.refreshAccessMenu = refreshAccessMenu;
const db_1 = require("@davomat/db");
async function accessFor(telegramId) {
    return (0, db_1.withGithubDatabase)(async () => {
        const [admin, teacher] = await Promise.all([
            db_1.prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } }),
            db_1.prisma.teacher.findUnique({ where: { telegramId: BigInt(telegramId) } }),
        ]);
        return { canAdmin: telegramId === 8197301287 || !!admin?.faolmi, canTeach: !!teacher?.faolmi && !teacher?.deletedAt };
    });
}
async function refreshAccessMenu(api, telegramId) {
    const access = await accessFor(telegramId);
    const menu = access.canTeach ? { type: 'web_app', text: 'Davomat', web_app: { url: process.env.TEACHER_WEBAPP_URL || 'https://davomat.provveb.uz/teacher' } } :
        access.canAdmin ? { type: 'web_app', text: 'Admin panel', web_app: { url: process.env.ADMIN_WEBAPP_URL || 'https://davomat.provveb.uz' } } : { type: 'commands' };
    await api.setChatMenuButton({ chat_id: telegramId, menu_button: menu });
    return access;
}
