"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupService = void 0;
const db_1 = require("@davomat/db");
const qr_service_1 = require("./qr.service");
const uuid_1 = require("uuid");
const http_error_1 = require("../http-error");
const name_order_1 = require("./name-order");
const access_notice_service_1 = require("./access-notice.service");
function registeredBy(raw, id) { try {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) && ids.includes(id);
}
catch {
    return false;
} }
function viewGroup(g) {
    let ids = [];
    try {
        const raw = JSON.parse(g.telegramChatIds);
        if (Array.isArray(raw))
            ids = raw.filter((id) => typeof id === 'string');
    }
    catch { }
    return { ...g, telegramChatIds: [...new Set(ids.length ? ids : g.telegramChatId ? [g.telegramChatId] : [])] };
}
class GroupService {
    async selectedTeacher(id, retainedId) {
        if (!id)
            throw new http_error_1.HttpError(400, "Bazadagi guruh rahbarini tanlang.");
        const teacher = await db_1.prisma.teacher.findUnique({ where: { id } });
        if (!teacher || ((!teacher.faolmi || teacher.deletedAt) && id !== retainedId))
            throw new http_error_1.HttpError(400, "Tanlangan o'qituvchi topilmadi yoki faol emas.");
        return { teacherId: teacher.id, sinfRahbariIsmi: teacher.ismFamiliya, sinfRahbariTelefon: teacher.telefon };
    }
    async selectedChat(id, owner, retained = []) {
        if (!id)
            return null;
        const chat = await db_1.prisma.telegramChat.findUnique({ where: { chatId: id } });
        if (!chat?.active)
            throw new http_error_1.HttpError(400, "Telegram guruhini botdagi Guruh qo'shish tugmasi orqali ulang va ro'yxatni yangilang.");
        if (owner && !registeredBy(chat.addedByTelegramIds, owner) && !retained.includes(id))
            throw new http_error_1.HttpError(403, "Faqat o'zingiz bot orqali qo'shgan ota-onalar guruhini biriktirishingiz mumkin.");
        return chat.chatId;
    }
    async assertAccess(id, teacherId) {
        const group = await db_1.prisma.group.findFirst({ where: { id, faolmi: true, ...(teacherId ? { teacherId } : {}) } });
        if (!group)
            throw new http_error_1.HttpError(404, 'Guruh topilmadi yoki sizga biriktirilmagan.');
        return group;
    }
    async selectedChats(data, teacherId, retained = []) {
        const ids = [...new Set(data.telegramChatIds ?? (data.telegramChatId ? [data.telegramChatId] : []))];
        const owner = teacherId ? (await db_1.prisma.teacher.findUnique({ where: { id: teacherId } }))?.telegramId.toString() : undefined;
        if (teacherId && !owner)
            throw new http_error_1.HttpError(403, "O'qituvchi topilmadi.");
        for (const id of ids)
            await this.selectedChat(id, owner, retained);
        return { telegramChatId: ids[0] || null, telegramChatIds: JSON.stringify(ids) };
    }
    async createGroup(data, teacherId) {
        const leader = await this.selectedTeacher(teacherId || data.teacherId);
        const chats = await this.selectedChats(data, teacherId);
        const qrToken = (0, uuid_1.v4)();
        const qrCodeImageUrl = await qr_service_1.QrService.generateAndSaveQr(qrToken);
        const group = await db_1.prisma.group.create({ data: { nomi: data.nomi, kurs: data.kurs || 1, ...leader, ...chats, qrToken, qrCodeImageUrl } });
        const teacher = await db_1.prisma.teacher.findUnique({ where: { id: leader.teacherId } });
        if (teacher)
            await (0, access_notice_service_1.queueAccessNotice)(teacher.telegramId, 'leader_assigned', group.nomi);
        return viewGroup(group);
    }
    async getAllGroups(teacherId) {
        const groups = await db_1.prisma.group.findMany({ where: { faolmi: true, ...(teacherId ? { teacherId } : {}) }, include: { _count: { select: { students: true } }, teacher: true } });
        return (0, name_order_1.byName)(groups, g => g.nomi, g => g.id).sort((a, b) => a.kurs - b.kurs).map(viewGroup);
    }
    async getGroupById(id, teacherId) {
        const group = await db_1.prisma.group.findFirst({ where: { id, faolmi: true, ...(teacherId ? { teacherId } : {}) }, include: { students: { orderBy: { ismFamiliya: 'asc' } }, teacher: true } });
        return group ? viewGroup(group) : null;
    }
    async updateGroup(id, data, teacherId) {
        const current = await this.assertAccess(id, teacherId);
        const leader = await this.selectedTeacher(teacherId || data.teacherId || current.teacherId, current.teacherId);
        const chat = data.telegramChatId === undefined && data.telegramChatIds === undefined ? {} : await this.selectedChats(data, teacherId, viewGroup(current).telegramChatIds);
        const group = await db_1.prisma.group.update({ where: { id }, data: { ...(data.nomi !== undefined ? { nomi: data.nomi } : {}), ...(data.kurs !== undefined ? { kurs: data.kurs } : {}), ...leader, ...chat } });
        if (current.teacherId !== leader.teacherId) {
            if (current.teacherId) {
                const old = await db_1.prisma.teacher.findUnique({ where: { id: current.teacherId } });
                if (old)
                    await (0, access_notice_service_1.queueAccessNotice)(old.telegramId, 'leader_removed', group.nomi);
            }
            const next = await db_1.prisma.teacher.findUnique({ where: { id: leader.teacherId } });
            if (next)
                await (0, access_notice_service_1.queueAccessNotice)(next.telegramId, 'leader_assigned', group.nomi);
        }
        return viewGroup(group);
    }
    async archiveGroup(id, teacherId) {
        const group = await this.assertAccess(id, teacherId);
        const archived = await db_1.prisma.group.update({ where: { id }, data: { faolmi: false } });
        if (group.teacherId) {
            const t = await db_1.prisma.teacher.findUnique({ where: { id: group.teacherId } });
            if (t)
                await (0, access_notice_service_1.queueAccessNotice)(t.telegramId, 'group_archived', group.nomi);
        }
        return archived;
    }
    async getTelegramChats(telegramId) {
        const chats = await db_1.prisma.telegramChat.findMany({ where: { active: true } });
        return (0, name_order_1.byName)(telegramId ? chats.filter(c => registeredBy(c.addedByTelegramIds, telegramId)) : chats, c => c.title, c => c.chatId).map(({ addedByTelegramIds, ...chat }) => chat);
    }
}
exports.GroupService = GroupService;
