"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentController = void 0;
const student_service_1 = require("../services/student.service");
const db_1 = require("@davomat/db");
const zod_1 = require("zod");
const studentService = new student_service_1.StudentService();
const addStudentSchema = zod_1.z.object({
    ismFamiliya: zod_1.z.string().min(1, 'Ism familiya majburiy'),
    rasmFileId: zod_1.z.string().optional(),
});
class StudentController {
    async checkAccess(req, groupId) {
        const userRole = req.userRole;
        if (userRole === 'teacher') {
            const dbTeacher = req.dbTeacher;
            const group = await db_1.prisma.group.findUnique({ where: { id: groupId } });
            if (!group || group.teacherId !== dbTeacher.id) {
                throw new Error('Sizda ushbu guruhga o`quvchi qo`shish huquqi yo`q');
            }
        }
    }
    async add(req, res) {
        const { id: groupId } = req.params;
        const data = addStudentSchema.parse(req.body);
        try {
            await this.checkAccess(req, groupId);
            const student = await studentService.addStudent({ ...data, groupId });
            const { githubService } = require('../services/github.service');
            await githubService.syncStudents(groupId);
            res.status(201).json(student);
        }
        catch (error) {
            res.status(403).json({ message: error.message });
        }
    }
    async importExcel(req, res) {
        const { id: groupId } = req.params;
        const replace = req.body.replace === 'true';
        if (!req.file) {
            return res.status(400).json({ message: 'Excel fayl yuklanmadi' });
        }
        try {
            await this.checkAccess(req, groupId);
            const result = await studentService.importFromExcel(groupId, req.file.buffer, replace);
            const { githubService } = require('../services/github.service');
            await githubService.syncStudents(groupId);
            res.json({ message: `${result.success} ta o'quvchi muvaffaqiyatli qo'shildi` });
        }
        catch (error) {
            if (error.errors) {
                return res.status(400).json({
                    message: error.message,
                    errors: error.errors
                });
            }
            res.status(400).json({ message: error.message });
        }
    }
    async delete(req, res) {
        const { id } = req.params;
        try {
            const student = await db_1.prisma.student.findUnique({ where: { id } });
            if (!student)
                throw new Error("O'quvchi topilmadi");
            await this.checkAccess(req, student.groupId);
            const deletedStudent = await studentService.deleteStudent(id);
            const { githubService } = require('../services/github.service');
            await githubService.syncStudents(deletedStudent.groupId);
            res.json({ message: 'O`quvchi o`chirildi' });
        }
        catch (error) {
            res.status(403).json({ message: error.message });
        }
    }
}
exports.StudentController = StudentController;
