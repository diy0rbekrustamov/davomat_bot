"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupController = void 0;
const group_service_1 = require("../services/group.service");
const zod_1 = require("zod");
const github_service_1 = require("../services/github.service");
const groupService = new group_service_1.GroupService();
const createGroupSchema = zod_1.z.object({
    nomi: zod_1.z.string().trim().min(1, 'Guruh nomi majburiy').max(150),
    kurs: zod_1.z.number().int().min(1).default(1),
    sinfRahbariIsmi: zod_1.z.string().optional(),
    sinfRahbariTelefon: zod_1.z.string().optional(),
    teacherId: zod_1.z.string().optional(),
    telegramChatId: zod_1.z.string().optional(),
    telegramChatIds: zod_1.z.array(zod_1.z.string().trim().regex(/^-\d+$/, 'Telegram guruh IDsi noto‘g‘ri')).optional(),
});
const updateGroupSchema = zod_1.z.object({
    nomi: zod_1.z.string().trim().min(1).max(150).optional(),
    kurs: zod_1.z.number().int().min(1).optional(),
    sinfRahbariIsmi: zod_1.z.string().optional(),
    sinfRahbariTelefon: zod_1.z.string().optional(),
    teacherId: zod_1.z.string().min(1).optional(),
    telegramChatId: zod_1.z.string().nullable().optional(),
    telegramChatIds: zod_1.z.array(zod_1.z.string().trim().regex(/^-\d+$/, 'Telegram guruh IDsi noto‘g‘ri')).optional(),
});
class GroupController {
    async sendQrZip(req, res) {
        const telegramId = req.telegramUser?.id;
        if (!telegramId)
            return res.status(401).json({ message: 'Telegram ID topilmadi' });
        const { base64 } = req.body;
        if (typeof base64 !== 'string' || base64.length > 28 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
            return res.status(400).json({ message: 'ZIP fayl noto‘g‘ri yoki hajmi 21 MB dan katta' });
        }
        if (!Buffer.from(base64.slice(0, 8), 'base64').subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))) {
            return res.status(400).json({ message: 'ZIP fayl noto‘g‘ri' });
        }
        try {
            const response = await fetch('http://127.0.0.1:3001/internal/send-qr-zip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Internal-Token': process.env.BOT_TOKEN },
                body: JSON.stringify({ telegramId, base64 }),
                signal: AbortSignal.timeout(60000),
            });
            if (!response.ok)
                throw new Error('ZIP yuborilmadi. Botni /start orqali ochib, qayta urinib ko‘ring.');
            res.json({ message: 'Barcha guruhlarning A4 QR rasmlari ZIP faylda Telegramingizga yuborildi!' });
        }
        catch {
            res.status(502).json({ message: 'ZIP yuborilmadi. Botni /start orqali ochib, qayta urinib ko‘ring.' });
        }
    }
    async create(req, res) {
        if (req.body.teacherId === "")
            delete req.body.teacherId;
        if (req.body.telegramChatId === "")
            delete req.body.telegramChatId;
        const data = createGroupSchema.parse(req.body);
        const userRole = req.userRole;
        const dbTeacher = req.dbTeacher;
        // If teacher is creating the group, auto-assign themselves
        if (userRole === 'teacher' && dbTeacher) {
            data.teacherId = dbTeacher.id;
        }
        const group = await groupService.createGroup(data, userRole === 'teacher' ? dbTeacher.id : undefined);
        await github_service_1.githubService.syncGroupInfo(group.id);
        res.status(201).json(group);
    }
    async getAll(req, res) {
        const userRole = req.userRole;
        const dbTeacher = req.dbTeacher;
        let teacherId;
        if (userRole === 'teacher' && dbTeacher) {
            teacherId = dbTeacher.id;
        }
        const groups = await groupService.getAllGroups(teacherId);
        res.json(groups);
    }
    async getById(req, res) {
        const { id } = req.params;
        const userRole = req.userRole;
        const dbTeacher = req.dbTeacher;
        let teacherId;
        if (userRole === 'teacher' && dbTeacher) {
            teacherId = dbTeacher.id;
        }
        const group = await groupService.getGroupById(id, teacherId);
        if (!group) {
            return res.status(404).json({ message: 'Guruh topilmadi yoki sizga biriktirilmagan' });
        }
        res.json(group);
    }
    async update(req, res) {
        const { id } = req.params;
        if (req.body.teacherId === "")
            delete req.body.teacherId;
        if (req.body.telegramChatId === "")
            req.body.telegramChatId = null;
        const data = updateGroupSchema.parse(req.body);
        const userRole = req.userRole;
        const dbTeacher = req.dbTeacher;
        let teacherId;
        if (userRole === 'teacher' && dbTeacher) {
            teacherId = dbTeacher.id;
        }
        const group = await groupService.updateGroup(id, data, teacherId);
        await github_service_1.githubService.syncGroupInfo(group.id);
        res.json(group);
    }
    async delete(req, res) {
        const { id } = req.params;
        const userRole = req.userRole;
        const dbTeacher = req.dbTeacher;
        let teacherId;
        if (userRole === 'teacher' && dbTeacher) {
            teacherId = dbTeacher.id;
        }
        await groupService.archiveGroup(id, teacherId);
        await github_service_1.githubService.syncGroupInfo(id);
        res.json({ message: 'Guruh arxivlandi' });
    }
    async getTelegramChats(req, res) {
        const chats = await groupService.getTelegramChats(req.userRole === 'teacher' ? String(req.telegramUser.id) : undefined);
        res.json(chats);
    }
    async sendQr(req, res) {
        const { base64, nomi } = req.body;
        const telegramId = req.telegramUser?.id;
        if (!telegramId)
            return res.status(401).json({ message: 'Telegram ID topilmadi' });
        try {
            const response = await fetch('http://localhost:3001/internal/send-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId, base64, caption: `QR Code: ${nomi}` })
            });
            if (!response.ok)
                throw new Error('Bot serverga yuborishda xatolik');
            res.json({ message: 'QR Code telegramingizga yuborildi!' });
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
}
exports.GroupController = GroupController;
