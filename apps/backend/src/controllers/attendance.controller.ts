import {editReport,correctionFor,retryReportEdit} from '../services/report-edit.service';
import {deletionList,deletionArchive,retryDeletion} from '../services/report-deletion.service';
import {DEVELOPER_CHAT_ID} from '@davomat/shared';
import {deferResponse} from '../deferred-response';
import {checkCurrentRole} from '../services/media-upload.service';
import {withGithubDatabase} from '@davomat/db';
import { Request, Response } from 'express';
import { AttendanceService } from '../services/attendance.service';
import { z } from 'zod';
import {prisma} from '@davomat/db';
import {HttpError} from '../http-error';

const attendanceService = new AttendanceService();

export class AttendanceController {
  private async checkSessionAccess(req:Request,editing=false){
    const teacher=(req as any).dbTeacher;
    const session=await prisma.attendanceSession.findUnique({where:{id:req.params.id}});
    if(!session||!teacher||session.teacherId!==teacher.id)throw new HttpError(404,'Sessiya topilmadi yoki sizga tegishli emas.');
    if(editing&&session.holat!=='JARAYONDA')throw new HttpError(400,'Yakunlangan sessiyani tahrirlab bo‘lmaydi.');
    return session;
  }

  async scanQr(req: Request, res: Response) {
    const { qrToken } = req.params;
    const telegramId = req.telegramUser?.id;

    if (!telegramId) return res.status(401).json({ message: 'Avtorizatsiya xatosi' });

    try {
      const info = await attendanceService.getScanInfo(qrToken, telegramId);
      res.json(info);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async startSession(req: Request, res: Response) {
    const { groupId, teacherId, customFanNomi, force } = req.body;
    try {
      const result = await attendanceService.startSession(groupId, (req as any).dbTeacher.id, customFanNomi, force);
      if (result.warning) {
        return res.status(200).json(result); // Yoki 202, frontend shunga qarab ishlaydi
      }
      res.status(201).json(result.session);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async record(req: Request, res: Response) {
    const { id: sessionId } = req.params;
    await this.checkSessionAccess(req,true);
    const records=z.array(z.object({studentId:z.string().min(1),holat:z.enum(['BOR','YOQ'])})).max(2000).parse(req.body.records);
    await attendanceService.recordAttendance(sessionId, records);
    res.json({ message: 'Davomat saqlandi' });
  }

  async addPhotos(req: Request, res: Response) {
    await this.checkSessionAccess(req,true);
    const { id: sessionId } = req.params;
    
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: 'Rasmlar topilmadi' });
      }

      if(process.env.GITHUB_PRIMARY==='1'){
        const service=require('../services/github.service').githubService;
        const uploadedFiles=req.files;
        deferResponse(res,async()=>{
        const paths:string[]=[];
        const files=uploadedFiles.map(file=>{const key='images/attendance/'+sessionId+'/'+require('crypto').randomUUID()+'.jpg';paths.push('https://raw.githubusercontent.com/'+(process.env.GITHUB_REPO||'provveb/database_davomat_byprovveb')+'/'+(process.env.GITHUB_BRANCH||'main')+'/'+key);return {path:key,content:file.buffer,isBinary:true};});
        await service.pushFiles(files,'Davomat rasmlari');
        await withGithubDatabase(async()=>{await checkCurrentRole(req);await this.checkSessionAccess(req,true);await attendanceService.addPhotos(sessionId,paths);});res.json({message:'Rasmlar GitHubga yuklandi'});
        });return;
      }
      // Rasm bufferni local fayl tizimiga saqlash
      const fs = require('fs/promises');
      const path = require('path');
      const { v4: uuidv4 } = require('uuid');

      const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'photos');
      await fs.mkdir(UPLOADS_DIR, { recursive: true });

      const photoPaths: string[] = [];

      for (const file of req.files) {
        const fileName = `${uuidv4()}.jpg`;
        const filePath = path.join(UPLOADS_DIR, fileName);
        await fs.writeFile(filePath, file.buffer);
        photoPaths.push(filePath);
      }

      // addPhotos ga yo'llar arrayi beriladi
      await attendanceService.addPhotos(sessionId, photoPaths);
      res.json({ message: 'Rasmlar yuklandi' });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async complete(req: Request, res: Response) {
    await this.checkSessionAccess(req);
    const { id: sessionId } = req.params;
    const session = await attendanceService.completeSession(sessionId);
    res.json(session);
  }

  async getTeacherSessions(req: Request, res: Response) {
    const telegramId = req.telegramUser?.id;
    const dateStr = req.query.date as string | undefined;
    if (!telegramId) return res.status(401).json({ message: 'Ruxsat yo`q' });
    try {
      const sessions = await attendanceService.getSessionsByTeacher(telegramId.toString(), dateStr);
      res.json(sessions);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  }

  async getAllSessions(req: Request, res: Response) {
    const filters = req.query;
    const sessions = await attendanceService.getSessions(filters);
    res.json(sessions);
  }

  async getTodayStatus(req: Request, res: Response) {
    const dateStr = req.query.date as string | undefined;
    const status = await attendanceService.getTodayStatus(dateStr);
    res.json(status);
  }

  async getSessionById(req: Request, res: Response) {
    const { id } = req.params;
    if((req as any).userRole==='teacher')await this.checkSessionAccess(req);
    const session = await attendanceService.getSessionById(id);
    if (!session) return res.status(404).json({ message: 'Sessiya topilmadi' });
    const source=await prisma.notification.findUnique({where:{id:'attendance-report:'+id}});
    const correction=await correctionFor(id);
    res.json({...session,editRevision:JSON.parse(source?.tafsilot||'{}').editRevision||correction?.revision||'',correction});
  }

  async editReport(req:Request,res:Response){const input=z.object({records:z.array(z.object({studentId:z.string().min(1),holat:z.enum(['BOR','YOQ'])})).min(1).max(2000),expectedRevision:z.string()}).strict().parse(req.body);res.json(await editReport(req.params.id,input.records,input.expectedRevision));}
  async retryEdit(req:Request,res:Response){res.json(await retryReportEdit(req.params.id));}

  async cancelSession(req: Request, res: Response) {
    const { id } = req.params;
    try {
      await attendanceService.cancelSession(id);
      res.json({ message: 'Sessiya bekor qilindi' });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async deleteSession(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const deletion=await attendanceService.deleteSession(id,String(req.telegramUser!.id));
      res.json({ message: 'Hisobot ro‘yxatdan olindi. Telegram nusxalarini o‘chirish navbatda; developer arxivi saqlanadi.',deletion });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async deletions(req:Request,res:Response){res.json(await deletionList());}
  async archive(req:Request,res:Response){if(String(req.telegramUser!.id)!==DEVELOPER_CHAT_ID)return res.status(403).json({message:'Arxiv faqat developer uchun.'});return res.json(await deletionArchive(req.params.id));}
  async retryDelete(req:Request,res:Response){res.json(await retryDeletion(req.params.id));}
}
