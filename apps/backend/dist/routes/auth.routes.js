"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("@davomat/db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET)
    throw new Error('JWT_SECRET serverda sozlanmagan.');
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username va parol kiritilishi shart' });
        }
        // Maxsus Super Admin tekshiruvi (.env dagi ma'lumotlar orqali yoki qattiq kodlangan)
        const SUPER_USER = process.env.SUPERADMIN_USER || 'admin';
        const SUPER_PASS = process.env.SUPERADMIN_PASS || 'admin123';
        if (username === SUPER_USER && password === SUPER_PASS) {
            const token = jsonwebtoken_1.default.sign({ id: 'superadmin', role: 'SUPER_ADMIN' }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ token, user: { id: 'superadmin', name: 'Asosiy Egasi', role: 'SUPER_ADMIN' } });
        }
        // Boshqa adminlarni bazadan izlaymiz
        const admin = await db_1.prisma.admin.findUnique({
            where: { username }
        });
        if (!admin || !admin.faolmi || !admin.password) {
            return res.status(401).json({ message: 'Login yoki parol noto`g`ri (yoki akkaunt faol emas)' });
        }
        const isValid = await bcryptjs_1.default.compare(password, admin.password);
        if (!isValid) {
            return res.status(401).json({ message: 'Login yoki parol noto`g`ri' });
        }
        const token = jsonwebtoken_1.default.sign({ id: admin.id, role: 'ADMIN', telegramId: admin.telegramId.toString() }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: admin.id, name: admin.ismFamiliya, role: 'ADMIN' } });
    }
    catch (error) {
        console.error('Login xatosi:', error);
        res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
    }
});
exports.default = router;
