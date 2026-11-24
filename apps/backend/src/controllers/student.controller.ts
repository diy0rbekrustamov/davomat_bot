import { Request, Response } from 'express';
import { StudentService } from '../services/student.service';
import { prisma } from '@davomat/db';
import { z } from 'zod';

const studentService = new StudentService();

const addStudentSchema = z.object({
  ismFamiliya: z.string().trim().min(1, 'Ism familiya majburiy').max(200, 'Ism familiya 200 belgidan oshmasin'),
  rasmFileId: z.string().optional(),
});

export class StudentController {

  private async checkAccess(req: Request, groupId: string) {
    const userRole = (req as any).userRole;
    if (userRole === 'teacher') {
      const dbTeacher = (req as any).dbTeacher;
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group || group.teacherId !== dbTeacher.id) {
        throw new Error('Sizda ushbu guruhga o`quvchi qo`shish huquqi yo`q');
      }
    }
  }

  async add(req: Request, res: Response) {
    const { id: groupId } = req.params;
    const data = addStudentSchema.parse(req.body);

    try {
      await this.checkAccess(req, groupId);
      const student = await studentService.addStudent({ ...data, groupId });
      const { githubService } = require('../services/github.service');
      await githubService.syncStudents(groupId);
      res.status(201).json(student);
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
  }

  async importExcel(req: Request, res: Response) {
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
    } catch (error: any) {
      if (error.errors) {
        return res.status(400).json({ 
          message: error.message, 
          errors: error.errors 
        });
      }
      res.status(400).json({ message: error.message });
    }
  }

  async update(req: Request, res: Response) {
    const parsed = addStudentSchema.pick({ ismFamiliya: true }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Ism familiyani tekshiring' });
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) return res.status(404).json({ message: "O'quvchi topilmadi" });
    try { await this.checkAccess(req, student.groupId); }
    catch { return res.status(403).json({ message: "Bu guruhni tahrirlashga ruxsat yo'q" }); }
    const group = await prisma.group.findUnique({ where: { id: student.groupId } });
    if (!group?.faolmi) return res.status(409).json({ message: 'Guruh faol emas' });
    const updated = await prisma.student.update({ where: { id: student.id }, data: parsed.data });
    const { githubService } = require('../services/github.service');
    await githubService.syncStudents(student.groupId);
    return res.json(updated);
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const student = await prisma.student.findUnique({ where: { id } });
      if (!student) throw new Error("O'quvchi topilmadi");
      await this.checkAccess(req, student.groupId);

      const deletedStudent = await studentService.deleteStudent(id);
      const { githubService } = require('../services/github.service');
      await githubService.syncStudents(deletedStudent.groupId);
      res.json({ message: 'O`quvchi o`chirildi' });
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
  }
}
