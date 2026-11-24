"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const db_1 = require("@davomat/db");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const access_notice_service_1 = require("../services/access-notice.service");
const createAdminSchema = zod_1.z.object({
    telegramId: zod_1.z.union([zod_1.z.string().trim().regex(/^[1-9]\d{0,15}$/), zod_1.z.number().int().positive().safe()]).refine(v => Number.isSafeInteger(Number(v)), 'Telegram ID noto‘g‘ri'),
    ismFamiliya: zod_1.z.string().min(1, 'Ism familiya majburiy'),
    lavozim: zod_1.z.string().optional(),
    username: zod_1.z.string().optional(),
    password: zod_1.z.string().optional()
});
class AdminController {
    async create(req, res) {
        try {
            const data = createAdminSchema.parse(req.body);
            const existing = await db_1.prisma.admin.findUnique({
                where: { telegramId: BigInt(data.telegramId) }
            });
            let hashedPassword = null;
            if (data.password) {
                hashedPassword = await bcryptjs_1.default.hash(data.password, 10);
            }
            if (existing) {
                if (!existing.faolmi) {
                    const restored = await db_1.prisma.admin.update({
                        where: { id: existing.id },
                        data: {
                            faolmi: true,
                            ismFamiliya: data.ismFamiliya,
                            lavozim: data.lavozim,
                            ...(data.username && { username: data.username }),
                            ...(hashedPassword && { password: hashedPassword })
                        }
                    });
                    await (0, access_notice_service_1.queueAccessNotice)(restored.telegramId, 'admin_restored');
                    return res.status(200).json({ ...restored, telegramId: restored.telegramId.toString() });
                }
                return res.status(400).json({ message: 'Bu Telegram ID allaqachon mavjud' });
            }
            const admin = await db_1.prisma.admin.create({
                data: {
                    telegramId: BigInt(data.telegramId),
                    ismFamiliya: data.ismFamiliya,
                    lavozim: data.lavozim,
                    username: data.username || null,
                    password: hashedPassword
                }
            });
            await (0, access_notice_service_1.queueAccessNotice)(admin.telegramId, 'admin_added');
            // BigInt ni string ga o'tkazamiz
            res.status(201).json({ ...admin, telegramId: admin.telegramId.toString() });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    async getAll(req, res) {
        const admins = await db_1.prisma.admin.findMany({
            where: { faolmi: true },
            orderBy: { ismFamiliya: 'asc' }
        });
        // Asosiy egani qo'shib qo'yamiz (sun'iy tarzda)
        const allAdmins = [
            { id: 'super', telegramId: '8197301287', ismFamiliya: 'Asosiy Egasi (Siz)', lavozim: 'Yaratuvchi', faolmi: true },
            ...admins.map((a) => ({ ...a, telegramId: a.telegramId.toString() }))
        ];
        res.json(allAdmins);
    }
    async delete(req, res) {
        const { id } = req.params;
        if (id === 'super') {
            return res.status(403).json({ message: 'Asosiy egani o\'chirib bo\'lmaydi' });
        }
        const existing = await db_1.prisma.admin.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ message: 'Admin topilmadi.' });
        if (!existing.faolmi)
            return res.json({ message: 'Admin huquqi allaqachon olib tashlangan.' });
        const removed = await db_1.prisma.admin.update({
            where: { id },
            data: { faolmi: false }
        });
        await (0, access_notice_service_1.queueAccessNotice)(removed.telegramId, 'admin_removed');
        res.json({ message: 'Admin o\'chirildi' });
    }
    async changeSuperPassword(req, res) {
        if (req.telegramUser?.id?.toString() !== '8197301287') {
            return res.status(403).json({ message: 'Sizda bu amalni bajarish huquqi yo\'q!' });
        }
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username va parol kiritilishi shart' });
        }
        const fs = require('fs');
        const path = require('path');
        const envPath = path.join(process.cwd(), '.env');
        let envData = '';
        if (fs.existsSync(envPath)) {
            envData = fs.readFileSync(envPath, 'utf8');
        }
        if (envData.includes('SUPERADMIN_USER=')) {
            envData = envData.replace(/SUPERADMIN_USER=.*/g, `SUPERADMIN_USER=${username}`);
        }
        else {
            envData += `\nSUPERADMIN_USER=${username}`;
        }
        if (envData.includes('SUPERADMIN_PASS=')) {
            envData = envData.replace(/SUPERADMIN_PASS=.*/g, `SUPERADMIN_PASS=${password}`);
        }
        else {
            envData += `\nSUPERADMIN_PASS=${password}`;
        }
        fs.writeFileSync(envPath, envData);
        process.env.SUPERADMIN_USER = username;
        process.env.SUPERADMIN_PASS = password;
        res.json({ message: 'Asosiy parol muvaffaqiyatli o\'zgartirildi' });
    }
}
exports.AdminController = AdminController;
