"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = exports.AttendanceStatus = exports.SessionStatus = void 0;
const db_1 = require("@davomat/db");
const http_error_1 = require("../http-error");
exports.SessionStatus = {
    JARAYONDA: 'JARAYONDA',
    YAKUNLANDI: 'YAKUNLANDI',
    BEKOR_QILINDI: 'BEKOR_QILINDI'
};
exports.AttendanceStatus = {
    BOR: 'BOR',
    YOQ: 'YOQ'
};
class AttendanceService {
    /**
     * QR skan qilinganda guruh va o'qituvchini aniqlash
     */
    async getScanInfo(qrToken, telegramId) {
        const group = await db_1.prisma.group.findUnique({
            where: { qrToken },
            include: {
                students: {
                    orderBy: { ismFamiliya: 'asc' }
                }
            }
        });
        if (!group || !group.faolmi) {
            throw new Error('Guruh topilmadi yoki arxivlangan');
        }
        const teacher = await db_1.prisma.teacher.findUnique({
            where: { telegramId: BigInt(telegramId) }
        });
        if (!teacher || !teacher.faolmi) {
            throw new Error('Siz tizimda ro`yxatdan o`tmagansiz');
        }
        return { group, teacher };
    }
    /**
     * Yangi sessiya boshlash
     */
    async startSession(groupId, teacherId, customFanNomi, force = false) {
        const teacher = await db_1.prisma.teacher.findUnique({ where: { id: teacherId } });
        if (!teacher?.faolmi)
            throw new Error('O`qituvchi topilmadi');
        const group = await db_1.prisma.group.findUnique({ where: { id: groupId } });
        if (!group?.faolmi)
            throw new Error('Guruh topilmadi yoki arxivlangan');
        const darsFani = customFanNomi || teacher.fanNomi;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingSessions = await db_1.prisma.attendanceSession.findMany({
            where: {
                groupId,
                teacherId,
                fanNomi: darsFani,
                sana: {
                    gte: today
                }
            },
            orderBy: { boshlanganVaqt: 'asc' }
        });
        if (existingSessions.length > 0 && !force) {
            return {
                warning: true,
                message: 'Bu fan bo`yicha bugun allaqachon davomat belgilangan. Yana bir marta davom ettirasizmi?',
                existingSessions
            };
        }
        const darsRaqami = existingSessions.length + 1;
        const session = await db_1.prisma.attendanceSession.create({
            data: {
                groupId,
                teacherId,
                fanNomi: darsFani,
                darsRaqami,
                sana: new Date(),
                holat: exports.SessionStatus.JARAYONDA
            }
        });
        return { warning: false, session };
    }
    /**
     * O'quvchilar davomatini belgilash
     */
    async recordAttendance(sessionId, records) {
        const session = await db_1.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
        if (!session)
            throw new http_error_1.HttpError(404, 'Sessiya topilmadi.');
        if (new Set(records.map(r => r.studentId)).size !== records.length)
            throw new http_error_1.HttpError(400, 'Takroriy o‘quvchi yozuvi.');
        const valid = await db_1.prisma.student.count({ where: { id: { in: records.map(r => r.studentId) }, groupId: session.groupId } });
        if (valid !== records.length)
            throw new http_error_1.HttpError(400, 'O‘quvchi ushbu guruhga tegishli emas.');
        await db_1.prisma.$transaction([db_1.prisma.attendanceRecord.deleteMany({ where: { sessionId } }), db_1.prisma.attendanceRecord.createMany({ data: records.map(r => ({ sessionId, studentId: r.studentId, holat: r.holat })) })]);
    }
    /**
     * Rasmlarni saqlash
     */
    async addPhotos(sessionId, photoFileIds) {
        if (photoFileIds.length > 5) {
            throw new Error('Maksimal 5 ta rasm yuklash mumkin');
        }
        return db_1.prisma.attendanceSession.update({
            where: { id: sessionId },
            data: { rasmlar: JSON.stringify(photoFileIds) }
        });
    }
    /**
     * Sessiyani yakunlash
     */
    async completeSession(sessionId) {
        const session = await db_1.prisma.attendanceSession.update({
            where: { id: sessionId },
            data: {
                holat: exports.SessionStatus.YAKUNLANDI,
                yakunlanganVaqt: new Date()
            },
            include: {
                group: true,
                teacher: true,
                records: {
                    include: { student: true }
                }
            }
        });
        if (process.env.GITHUB_PRIMARY === '1') {
            await db_1.prisma.notification.upsert({ where: { id: 'attendance-report:' + session.id }, create: { id: 'attendance-report:' + session.id, harakat: 'ATTENDANCE_REPORT_PENDING', tafsilot: JSON.stringify({ sessionId: session.id, adminDone: false, parentsDone: false, attempts: 0, nextAt: 0 }) }, update: {} });
        }
        else {
            // Bot Service (alohida process) ga HTTP orqali xabar yuborish
            try {
                const botInternalUrl = process.env.BOT_INTERNAL_URL || 'http://localhost:3001/internal/notify';
                await fetch(botInternalUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: session.id })
                });
            }
            catch (error) {
                console.error('Botga xabar yuborishda xatolik:', error);
            }
        }
        // GitHub ga sinxronizatsiya
        try {
            const { githubService } = require('./github.service');
            await githubService.syncAttendance(session.id);
        }
        catch (error) {
            console.error('GitHub ga sinxron qilishda xatolik:', error);
        }
        return session;
    }
    /**
     * Sessiyani va unga tegishli telegram xabarlarni o'chirish
     */
    async deleteSession(sessionId) {
        const session = await db_1.prisma.attendanceSession.findUnique({
            where: { id: sessionId }
        });
        if (!session) {
            throw new Error("Sessiya topilmadi");
        }
        // Telegramdan o'chirish
        if (session.telegramMessageIds) {
            try {
                const messageIds = JSON.parse(session.telegramMessageIds);
                const chatId = process.env.ADMIN_CHAT_ID;
                if (messageIds.length > 0 && chatId) {
                    const botInternalUrl = (process.env.BOT_INTERNAL_URL || 'http://localhost:3001/internal/notify').replace('/notify', '/delete-messages');
                    await fetch(botInternalUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messageIds, chatId })
                    });
                }
            }
            catch (e) {
                console.error("Xabarlarni o'chirishda xatolik:", e);
            }
        }
        // GitHub'dan papkani o'chirish
        try {
            const { githubService } = require('./github.service');
            const groupInfo = await db_1.prisma.group.findUnique({ where: { id: session.groupId } });
            if (groupInfo) {
                const sanaFolder = session.sana.toISOString().split('T')[0];
                const basePath = groupInfo.kurs + '-kurs/' + groupInfo.nomi + '/' + sanaFolder;
                await githubService.deleteSessionFiles(basePath);
            }
        }
        catch (e) {
            console.error("GitHubdan fayllarni o'chirishda xatolik:", e);
        }
        // Bazadan o'chirish (Cascade bo'lgani uchun rekordlar ham o'chadi)
        await db_1.prisma.attendanceSession.delete({
            where: { id: sessionId }
        });
        return { success: true };
    }
    /**
     * O'qituvchining tarixini olish
     */
    async getSessionsByTeacher(telegramId, dateStr) {
        const where = {
            teacher: { telegramId: BigInt(telegramId) },
            holat: 'YAKUNLANDI'
        };
        if (dateStr) {
            const start = new Date(dateStr);
            start.setHours(0, 0, 0, 0);
            const end = new Date(dateStr);
            end.setHours(23, 59, 59, 999);
            where.sana = {
                gte: start,
                lte: end
            };
        }
        return db_1.prisma.attendanceSession.findMany({
            where,
            include: {
                group: true,
                teacher: true,
            },
            orderBy: { sana: 'desc' },
            take: dateStr ? undefined : 50 // agar kun tanlangan bo'lsa limitni olib tashlash ham mumkin
        });
    }
    /**
     * Barcha sessiyalarni filtrlash bilan olish (Admin uchun)
     */
    async getSessions(filters) {
        const where = {};
        if (filters.groupId)
            where.groupId = filters.groupId;
        if (filters.teacherId)
            where.teacherId = filters.teacherId;
        if (filters.date) {
            const start = new Date(filters.date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(filters.date);
            end.setHours(23, 59, 59, 999);
            where.sana = { gte: start, lte: end };
        }
        return db_1.prisma.attendanceSession.findMany({
            where,
            include: {
                group: { select: { nomi: true, sinfRahbariIsmi: true } },
                teacher: { select: { ismFamiliya: true, fanNomi: true } }
            },
            orderBy: { boshlanganVaqt: 'desc' }
        });
    }
    async getTodayStatus(dateStr) {
        const today = dateStr ? new Date(dateStr) : new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const groups = await db_1.prisma.group.findMany({
            where: { faolmi: true },
            orderBy: { nomi: 'asc' }
        });
        const sessions = await db_1.prisma.attendanceSession.findMany({
            where: {
                sana: { gte: today, lt: tomorrow },
                holat: exports.SessionStatus.YAKUNLANDI
            },
            include: { teacher: true, records: true }
        });
        return groups.map((g) => {
            const groupSessions = sessions.filter((s) => s.groupId === g.id);
            return {
                ...g,
                hasSubmittedToday: groupSessions.length > 0,
                sessions: groupSessions
            };
        });
    }
    async getSessionById(id) {
        return db_1.prisma.attendanceSession.findUnique({
            where: { id },
            include: {
                group: true,
                teacher: true,
                records: {
                    include: { student: true }
                }
            }
        });
    }
    /**
     * Chala qolgan sessiyani bekor qilish (Admin uchun)
     */
    async cancelSession(id) {
        const session = await db_1.prisma.attendanceSession.findUnique({ where: { id } });
        if (!session)
            throw new Error('Sessiya topilmadi');
        if (session.holat === exports.SessionStatus.YAKUNLANDI) {
            throw new Error('Sessiya allaqachon yakunlangan, bekor qilib bo`lmaydi');
        }
        return db_1.prisma.attendanceSession.update({
            where: { id },
            data: { holat: exports.SessionStatus.BEKOR_QILINDI }
        });
    }
}
exports.AttendanceService = AttendanceService;
