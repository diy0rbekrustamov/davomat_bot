import {deferTeacherPhoto} from '../services/media-upload.service';
import { Request, Response } from 'express';
import { TeacherService } from '../services/teacher.service';
import { z } from 'zod';

const teacherService = new TeacherService();

const createTeacherSchema = z.object({
  telegramId: z.union([z.string().trim().regex(/^[1-9]\d{0,15}$/), z.number().int().positive().safe()]).refine(v => Number.isSafeInteger(Number(v)), 'Telegram ID noto‘g‘ri'),
  ismFamiliya: z.string().trim().min(1, 'Ism familiya majburiy'),
  rasmFileId: z.string().optional(),
  fanNomi: z.string().trim().min(1, 'Fan nomi majburiy'),
  telefon: z.string().optional(),
});

const updateTeacherSchema = z.object({
  ismFamiliya: z.string().trim().min(1,'Ism familiya majburiy').optional(),
  rasmFileId: z.string().optional(),
  fanNomi: z.string().trim().min(1,'Fan nomi majburiy').optional(),
  telefon: z.string().optional(),
  faolmi: z.boolean().optional(),
});

export class TeacherController {
  async getMe(req: Request, res: Response) {
    const telegramId = (req as any).telegramUser?.id;
    if (!telegramId) return res.status(401).json({ message: 'Ruxsat yo`q' });
    try {
      const teacher = await teacherService.getTeacherByTelegramId(telegramId.toString());
      if (!teacher) return res.status(404).json({ message: 'O`qituvchi topilmadi' });
      res.json(teacher);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  }

  async updateMyPhoto(req: Request, res: Response) {
    const telegramId = (req as any).telegramUser?.id;
    if (!telegramId) return res.status(401).json({ message: 'Ruxsat yo`q' });
    try {
      const teacher = await teacherService.getTeacherByTelegramId(telegramId.toString());
      if (!teacher) return res.status(404).json({ message: 'O`qituvchi topilmadi' });
      
      const { rasmFileId } = req.body;
      if (!rasmFileId) return res.status(400).json({ message: 'Rasm yuborilmadi' });

      if(deferTeacherPhoto(req,res,{rasmFileId},data=>teacherService.updateTeacher(teacher.id,data)))return;
      const updated = await teacherService.updateTeacher(teacher.id, { rasmFileId });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  }
  async create(req: Request, res: Response) {
    try {
      const data = createTeacherSchema.parse(req.body);
      if(deferTeacherPhoto(req,res,data,d=>teacherService.addTeacher(d),201))return;
      const teacher = await teacherService.addTeacher(data);
      res.status(201).json(teacher);
    } catch (error: any) {
      res.status(error.status || 400).json({ message: error.issues?.map((i:any)=>i.message).join('; ') || error.message });
    }
  }

  async getAll(req: Request, res: Response) {
    const teachers = (req as any).userRole === 'teacher' ? [(req as any).dbTeacher] : await teacherService.getAllTeachers();
    res.json(teachers);
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const data = updateTeacherSchema.parse(req.body);
      if(deferTeacherPhoto(req,res,data,d=>teacherService.updateTeacher(id,d)))return;
      const teacher = await teacherService.updateTeacher(id, data);
      res.json(teacher);
    } catch (error: any) {
      res.status(error.status || 400).json({message: error.issues?.map((i:any)=>i.message).join('; ') || error.message});
    }
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    try {
      await teacherService.deleteTeacher(id);
      res.json({ message: 'O‘qituvchi olib tashlandi. Davomat tarixi va guruhlari saqlandi.' });
    } catch(error:any) { res.status(error.status || 400).json({message:error.message}); }
  }
}
