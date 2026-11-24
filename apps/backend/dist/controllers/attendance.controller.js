"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = void 0;
const attendance_service_1 = require("../services/attendance.service");
const zod_1 = require("zod");
const db_1 = require("@davomat/db");
const http_error_1 = require("../http-error");
const attendanceService = new attendance_service_1.AttendanceService();
class AttendanceController {
    async checkSessionAccess(req, editing = false) {
        const teacher = req.dbTeacher;
        const session = await db_1.prisma.attendanceSession.findUnique({ where: { id: req.params.id } });
        if (!session || !teacher || session.teacherId !== teacher.id)
            throw new http_error_1.HttpError(404, 'Sessiya topilmadi yoki sizga tegishli emas.');
        if (editing && session.holat !== 'JARAYONDA')
            throw new http_error_1.HttpError(400, 'Yakunlangan sessiyani tahrirlab bo‘lmaydi.');
        return session;
    }
    async scanQr(req, res) {
        const { qrToken } = req.params;
        const telegramId = req.telegramUser?.id;
        if (!telegramId)
            return res.status(401).json({ message: 'Avtorizatsiya xatosi' });
        try {
            const info = await attendanceService.getScanInfo(qrToken, telegramId);
            res.json(info);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    async startSession(req, res) {
        const { groupId, teacherId, customFanNomi, force } = req.body;
        try {
            const result = await attendanceService.startSession(groupId, req.dbTeacher.id, customFanNomi, force);
            if (result.warning) {
                return res.status(200).json(result); // Yoki 202, frontend shunga qarab ishlaydi
            }
            res.status(201).json(result.session);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    async record(req, res) {
        const { id: sessionId } = req.params;
        await this.checkSessionAccess(req, true);
        const records = zod_1.z.array(zod_1.z.object({ studentId: zod_1.z.string().min(1), holat: zod_1.z.enum(['BOR', 'YOQ']) })).max(2000).parse(req.body.records);
        await attendanceService.recordAttendance(sessionId, records);
        res.json({ message: 'Davomat saqlandi' });
    }
    async addPhotos(req, res) {
        await this.checkSessionAccess(req, true);
        const { id: sessionId } = req.params;
        try {
            if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
                return res.status(400).json({ message: 'Rasmlar topilmadi' });
            }
            if (process.env.GITHUB_PRIMARY === '1') {
                const service = require('../services/github.service').githubService;
                const paths = [];
                for (const file of req.files) {
                    const key = 'images/attendance/' + sessionId + '/' + require('crypto').randomUUID() + '.jpg';
                    await service.pushFiles([{ path: key, content: file.buffer, isBinary: true }], 'Davomat rasmi');
                    paths.push('https://raw.githubusercontent.com/' + (process.env.GITHUB_REPO || 'provveb/database_davomat_byprovveb') + '/main/' + key);
                }
                await attendanceService.addPhotos(sessionId, paths);
                return res.json({ message: 'Rasmlar GitHubga yuklandi' });
            }
            // Rasm bufferni local fayl tizimiga saqlash
            const fs = require('fs/promises');
            const path = require('path');
            const { v4: uuidv4 } = require('uuid');
            const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'photos');
            await fs.mkdir(UPLOADS_DIR, { recursive: true });
            const photoPaths = [];
            for (const file of req.files) {
                const fileName = `${uuidv4()}.jpg`;
                const filePath = path.join(UPLOADS_DIR, fileName);
                await fs.writeFile(filePath, file.buffer);
                photoPaths.push(filePath);
            }
            // addPhotos ga yo'llar arrayi beriladi
            await attendanceService.addPhotos(sessionId, photoPaths);
            res.json({ message: 'Rasmlar yuklandi' });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    async complete(req, res) {
        await this.checkSessionAccess(req);
        const { id: sessionId } = req.params;
        const session = await attendanceService.completeSession(sessionId);
        res.json(session);
    }
    async getTeacherSessions(req, res) {
        const telegramId = req.telegramUser?.id;
        const dateStr = req.query.date;
        if (!telegramId)
            return res.status(401).json({ message: 'Ruxsat yo`q' });
        try {
            const sessions = await attendanceService.getSessionsByTeacher(telegramId.toString(), dateStr);
            res.json(sessions);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    async getAllSessions(req, res) {
        const filters = req.query;
        const sessions = await attendanceService.getSessions(filters);
        res.json(sessions);
    }
    async getTodayStatus(req, res) {
        const dateStr = req.query.date;
        const status = await attendanceService.getTodayStatus(dateStr);
        res.json(status);
    }
    async getSessionById(req, res) {
        const { id } = req.params;
        if (req.userRole === 'teacher')
            await this.checkSessionAccess(req);
        const session = await attendanceService.getSessionById(id);
        if (!session)
            return res.status(404).json({ message: 'Sessiya topilmadi' });
        res.json(session);
    }
    async cancelSession(req, res) {
        const { id } = req.params;
        try {
            await attendanceService.cancelSession(id);
            res.json({ message: 'Sessiya bekor qilindi' });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    async deleteSession(req, res) {
        const { id } = req.params;
        try {
            await attendanceService.deleteSession(id);
            res.json({ message: 'Sessiya o`chirildi' });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}
exports.AttendanceController = AttendanceController;
