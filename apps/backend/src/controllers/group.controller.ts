import {teacherGroupsEnabled,setTeacherGroupsEnabled} from '@davomat/shared';
import {HttpError} from '../http-error';
import {prisma} from '@davomat/db';
import { TeacherService } from '../services/teacher.service';
import {deferResponse} from '../deferred-response';
import { Request, Response } from 'express';
import { GroupService } from '../services/group.service';
import { z } from 'zod';
import { githubService } from '../services/github.service';

const groupService = new GroupService();

const createGroupSchema = z.object({
  nomi: z.string().trim().min(1, 'Guruh nomi majburiy').max(150),
  kurs: z.number().int().min(1).default(1),
  sinfRahbariIsmi: z.string().optional(),
  sinfRahbariTelefon: z.string().optional(),
  teacherId: z.string().optional(),
  telegramChatId: z.string().optional(),
  telegramChatIds: z.array(z.string().trim().regex(/^-\d+$/, 'Telegram guruh IDsi noto‘g‘ri')).optional(),
});

const updateGroupSchema = z.object({
  nomi: z.string().trim().min(1).max(150).optional(),
  kurs: z.number().int().min(1).optional(),
  sinfRahbariIsmi: z.string().optional(),
  sinfRahbariTelefon: z.string().optional(),
  teacherId: z.string().min(1).optional(),
  telegramChatId: z.string().nullable().optional(),
  telegramChatIds: z.array(z.string().trim().regex(/^-\d+$/, 'Telegram guruh IDsi noto‘g‘ri')).optional(),
});

export class GroupController {
  async teacherPolicy(req:Request,res:Response){res.json({enabled:await teacherGroupsEnabled(prisma)});}
  async setTeacherPolicy(req:Request,res:Response){const body=z.object({enabled:z.boolean()}).strict().parse(req.body);await setTeacherGroupsEnabled(prisma,body.enabled,String(req.telegramUser!.id));res.json({enabled:body.enabled});}
  async sendQrZip(req: Request, res: Response) {
    const telegramId = req.telegramUser?.id;
    if (!telegramId) return res.status(401).json({ message: 'Telegram ID topilmadi' });
    const { base64 } = req.body;
    if (typeof base64 !== 'string' || base64.length > 28 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      return res.status(400).json({ message: 'ZIP fayl noto‘g‘ri yoki hajmi 21 MB dan katta' });
    }
    if (!Buffer.from(base64.slice(0, 8), 'base64').subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))) {
      return res.status(400).json({ message: 'ZIP fayl noto‘g‘ri' });
    }
    deferResponse(res,async()=>{
    try {
      const response = await fetch('http://127.0.0.1:3001/internal/send-qr-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Token': process.env.BOT_TOKEN! },
        body: JSON.stringify({ telegramId, base64 }),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error('ZIP yuborilmadi. Botni /start orqali ochib, qayta urinib ko‘ring.');
      res.json({ message: 'Barcha guruhlarning A4 QR rasmlari ZIP faylda Telegramingizga yuborildi!' });
    } catch {
      res.status(502).json({ message: 'ZIP yuborilmadi. Botni /start orqali ochib, qayta urinib ko‘ring.' });
    }
    });
  }

  async create(req: Request, res: Response) {
    if((req as any).userRole==='teacher'&&!await teacherGroupsEnabled(prisma))throw new HttpError(403,'O‘qituvchilarga guruh qo‘shish va tahrirlash administrator tomonidan yopilgan.');
    if (req.body.teacherId === "") delete req.body.teacherId;
    if (req.body.telegramChatId === "") delete req.body.telegramChatId;
    const data = createGroupSchema.parse(req.body);
    const userRole = (req as any).userRole;
    const dbTeacher = (req as any).dbTeacher;

    // If teacher is creating the group, auto-assign themselves
    if (userRole === 'teacher' && dbTeacher) {
      data.teacherId = dbTeacher.id;
    }

    const group = await groupService.createGroup(data,userRole === 'teacher' ? dbTeacher.id : undefined);
    await githubService.syncGroupInfo(group.id);
    res.status(201).json(group);
  }

  async getPageData(req: Request, res: Response) {
    const teacher = (req as any).userRole === 'teacher' ? (req as any).dbTeacher : undefined;
    const [groups, teachers, chats] = await Promise.all([
      groupService.getAllGroups(teacher?.id),
      teacher ? Promise.resolve([teacher]) : new TeacherService().getAllTeachers(),
      groupService.getTelegramChats(teacher ? String(req.telegramUser!.id) : undefined),
    ]);
    res.json({ groups, teachers, chats, teacherGroupManagementEnabled:teacher?await teacherGroupsEnabled(prisma):true });
  }

  async getAll(req: Request, res: Response) {
    const userRole = (req as any).userRole;
    const dbTeacher = (req as any).dbTeacher;
    
    let teacherId;
    if (userRole === 'teacher' && dbTeacher) {
      teacherId = dbTeacher.id;
    }

    const groups = await groupService.getAllGroups(teacherId);
    res.json(groups);
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const userRole = (req as any).userRole;
    const dbTeacher = (req as any).dbTeacher;
    
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

  async update(req: Request, res: Response) {
    if((req as any).userRole==='teacher'&&!await teacherGroupsEnabled(prisma))throw new HttpError(403,'O‘qituvchilarga guruh qo‘shish va tahrirlash administrator tomonidan yopilgan.');
    const { id } = req.params;
    if (req.body.teacherId === "") delete req.body.teacherId;
    if (req.body.telegramChatId === "") req.body.telegramChatId = null;
    const data = updateGroupSchema.parse(req.body);
    const userRole = (req as any).userRole;
    const dbTeacher = (req as any).dbTeacher;
    
    let teacherId;
    if (userRole === 'teacher' && dbTeacher) {
      teacherId = dbTeacher.id;
    }

    const group = await groupService.updateGroup(id, data, teacherId);
    await githubService.syncGroupInfo(group.id);
    res.json(group);
  }

  async delete(req: Request, res: Response) {
    if((req as any).userRole==='teacher'&&!await teacherGroupsEnabled(prisma))throw new HttpError(403,'O‘qituvchilarga guruh qo‘shish va tahrirlash administrator tomonidan yopilgan.');
    const { id } = req.params;
    const userRole = (req as any).userRole;
    const dbTeacher = (req as any).dbTeacher;
    
    let teacherId;
    if (userRole === 'teacher' && dbTeacher) {
      teacherId = dbTeacher.id;
    }

    await groupService.archiveGroup(id,teacherId);
    await githubService.syncGroupInfo(id);
    res.json({message:'Guruh arxivlandi'});
  }

  async getTelegramChats(req: Request, res: Response) {
    const chats = await groupService.getTelegramChats((req as any).userRole === 'teacher' ? String(req.telegramUser!.id) : undefined);
    res.json(chats);
  }

  async sendQr(req: Request, res: Response) {
    const { base64, nomi } = req.body;
    const telegramId = (req as any).telegramUser?.id;
    
    if (!telegramId) return res.status(401).json({ message: 'Telegram ID topilmadi' });

    deferResponse(res,async()=>{
    try {
      const response = await fetch('http://localhost:3001/internal/send-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json','x-internal-token':process.env.BOT_TOKEN||'' },
        body: JSON.stringify({ telegramId, base64, caption: `QR Code: ${nomi}` }),signal:AbortSignal.timeout(25000)
      });
      if (!response.ok) throw new Error('Bot serverga yuborishda xatolik');
      res.json({ message: 'QR Code telegramingizga yuborildi!' });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
    });
  }
}
