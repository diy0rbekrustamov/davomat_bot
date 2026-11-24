"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminOrTeacher = exports.requireTeacher = exports.requireAdmin = void 0;
const db_1 = require("@davomat/db");
const requireAdmin = async (req, res, next) => {
    const user = req.telegramUser;
    if (!user) {
        return res.status(401).json({ message: 'Avtorizatsiyadan o`tilmagan' });
    }
    const isSuperAdmin = user.id.toString() === '8197301287';
    if (isSuperAdmin) {
        return next();
    }
    try {
        const admin = await db_1.prisma.admin.findUnique({
            where: { telegramId: BigInt(user.id) },
        });
        if (!admin || !admin.faolmi) {
            return res.status(403).json({ message: 'Sizda admin huquqlari yo`q' });
        }
        next();
    }
    catch (error) {
        return res.status(500).json({ message: 'Server xatoligi' });
    }
};
exports.requireAdmin = requireAdmin;
const requireTeacher = async (req, res, next) => {
    const user = req.telegramUser;
    if (!user) {
        return res.status(401).json({ message: 'Avtorizatsiyadan o`tilmagan' });
    }
    try {
        const teacher = await db_1.prisma.teacher.findUnique({
            where: { telegramId: BigInt(user.id) },
        });
        if (!teacher || !teacher.faolmi || !!teacher.deletedAt) {
            return res.status(403).json({ message: 'Siz tizimda faol o`qituvchi emassiz' });
        }
        req.dbTeacher = teacher;
        req.userRole = 'teacher';
        next();
    }
    catch (error) {
        return res.status(500).json({ message: 'Server xatoligi' });
    }
};
exports.requireTeacher = requireTeacher;
const requireAdminOrTeacher = async (req, res, next) => {
    // The teacher Mini App always uses teacher permissions, even for dual-role users.
    if (req.headers['x-app-view'] === 'teacher')
        return (0, exports.requireTeacher)(req, res, next);
    const user = req.telegramUser;
    if (!user) {
        return res.status(401).json({ message: 'Avtorizatsiyadan o`tilmagan' });
    }
    const isSuperAdmin = user.id.toString() === '8197301287' || user.id.toString() === process.env.ADMIN_CHAT_ID;
    if (isSuperAdmin) {
        req.userRole = 'admin';
        return next();
    }
    try {
        const admin = await db_1.prisma.admin.findUnique({
            where: { telegramId: BigInt(user.id) },
        });
        if (admin && admin.faolmi) {
            req.userRole = 'admin';
            return next();
        }
        const teacher = await db_1.prisma.teacher.findUnique({
            where: { telegramId: BigInt(user.id) },
        });
        if (teacher && teacher.faolmi && !teacher.deletedAt) {
            req.userRole = 'teacher';
            req.dbTeacher = teacher;
            return next();
        }
        return res.status(403).json({ message: 'Ruxsat etilmagan' });
    }
    catch (error) {
        return res.status(500).json({ message: 'Server xatoligi' });
    }
};
exports.requireAdminOrTeacher = requireAdminOrTeacher;
