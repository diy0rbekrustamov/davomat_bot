"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherController = void 0;
const teacher_service_1 = require("../services/teacher.service");
const zod_1 = require("zod");
const teacherService = new teacher_service_1.TeacherService();
const createTeacherSchema = zod_1.z.object({
    telegramId: zod_1.z.union([zod_1.z.string().trim().regex(/^[1-9]\d{0,15}$/), zod_1.z.number().int().positive().safe()]).refine(v => Number.isSafeInteger(Number(v)), 'Telegram ID noto‘g‘ri'),
    ismFamiliya: zod_1.z.string().trim().min(1, 'Ism familiya majburiy'),
    rasmFileId: zod_1.z.string().optional(),
    fanNomi: zod_1.z.string().trim().min(1, 'Fan nomi majburiy'),
    telefon: zod_1.z.string().optional(),
});
const updateTeacherSchema = zod_1.z.object({
    ismFamiliya: zod_1.z.string().trim().min(1, 'Ism familiya majburiy').optional(),
    rasmFileId: zod_1.z.string().optional(),
    fanNomi: zod_1.z.string().trim().min(1, 'Fan nomi majburiy').optional(),
    telefon: zod_1.z.string().optional(),
    faolmi: zod_1.z.boolean().optional(),
});
class TeacherController {
    async getMe(req, res) {
        const telegramId = req.telegramUser?.id;
        if (!telegramId)
            return res.status(401).json({ message: 'Ruxsat yo`q' });
        try {
            const teacher = await teacherService.getTeacherByTelegramId(telegramId.toString());
            if (!teacher)
                return res.status(404).json({ message: 'O`qituvchi topilmadi' });
            res.json(teacher);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    async updateMyPhoto(req, res) {
        const telegramId = req.telegramUser?.id;
        if (!telegramId)
            return res.status(401).json({ message: 'Ruxsat yo`q' });
        try {
            const teacher = await teacherService.getTeacherByTelegramId(telegramId.toString());
            if (!teacher)
                return res.status(404).json({ message: 'O`qituvchi topilmadi' });
            const { rasmFileId } = req.body;
            if (!rasmFileId)
                return res.status(400).json({ message: 'Rasm yuborilmadi' });
            const updated = await teacherService.updateTeacher(teacher.id, { rasmFileId });
            res.json(updated);
        }
        catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
    async create(req, res) {
        try {
            const data = createTeacherSchema.parse(req.body);
            const teacher = await teacherService.addTeacher(data);
            res.status(201).json(teacher);
        }
        catch (error) {
            res.status(error.status || 400).json({ message: error.issues?.map((i) => i.message).join('; ') || error.message });
        }
    }
    async getAll(req, res) {
        const teachers = req.userRole === 'teacher' ? [req.dbTeacher] : await teacherService.getAllTeachers();
        res.json(teachers);
    }
    async update(req, res) {
        const { id } = req.params;
        try {
            const data = updateTeacherSchema.parse(req.body);
            const teacher = await teacherService.updateTeacher(id, data);
            res.json(teacher);
        }
        catch (error) {
            res.status(error.status || 400).json({ message: error.issues?.map((i) => i.message).join('; ') || error.message });
        }
    }
    async delete(req, res) {
        const { id } = req.params;
        try {
            await teacherService.deleteTeacher(id);
            res.json({ message: 'O‘qituvchi olib tashlandi. Davomat tarixi va guruhlari saqlandi.' });
        }
        catch (error) {
            res.status(error.status || 400).json({ message: error.message });
        }
    }
}
exports.TeacherController = TeacherController;
