import {requestReportDeletion} from './report-deletion.service';
import {attendanceSnapshot} from '@davomat/shared';
import { prisma, AttendanceSession,afterGithubCommit } from '@davomat/db';
import {HttpError} from '../http-error';

export const SessionStatus = {
  JARAYONDA: 'JARAYONDA',
  YAKUNLANDI: 'YAKUNLANDI',
  BEKOR_QILINDI: 'BEKOR_QILINDI'
};

export const AttendanceStatus = {
  BOR: 'BOR',
  YOQ: 'YOQ'
};

export class AttendanceService {
  /**
   * QR skan qilinganda guruh va o'qituvchini aniqlash
   */
  async getScanInfo(qrToken: string, telegramId: string | number) {
    const group = await prisma.group.findUnique({
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

    const teacher = await prisma.teacher.findUnique({
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
  async startSession(groupId: string, teacherId: string, customFanNomi?: string, force: boolean = false) {
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher?.faolmi) throw new Error('O`qituvchi topilmadi');
    const group=await prisma.group.findUnique({where:{id:groupId}});
    if(!group?.faolmi)throw new Error('Guruh topilmadi yoki arxivlangan');

    const darsFani = customFanNomi || teacher.fanNomi;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingSessions = await prisma.attendanceSession.findMany({
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

    const session = await prisma.attendanceSession.create({
      data: {
        groupId,
        teacherId,
        fanNomi: darsFani,
        darsRaqami,
        sana: new Date(),
        holat: SessionStatus.JARAYONDA
      }
    });

    return { warning: false, session };
  }

  /**
   * O'quvchilar davomatini belgilash
   */
  async recordAttendance(sessionId: string, records: { studentId: string, holat: string }[]) {
    const session=await prisma.attendanceSession.findUnique({where:{id:sessionId}});
    if(!session)throw new HttpError(404,'Sessiya topilmadi.');
    if(new Set(records.map(r=>r.studentId)).size!==records.length)throw new HttpError(400,'Takroriy o‘quvchi yozuvi.');
    const valid=await prisma.student.count({where:{id:{in:records.map(r=>r.studentId)},groupId:session.groupId}});
    if(valid!==records.length)throw new HttpError(400,'O‘quvchi ushbu guruhga tegishli emas.');
    await prisma.$transaction([prisma.attendanceRecord.deleteMany({where:{sessionId}}),prisma.attendanceRecord.createMany({data:records.map(r=>({sessionId,studentId:r.studentId,holat:r.holat}))})]);

  }

  /**
   * Rasmlarni saqlash
   */
  async addPhotos(sessionId: string, photoFileIds: string[]) {
    if (photoFileIds.length > 5) {
      throw new Error('Maksimal 5 ta rasm yuklash mumkin');
    }

    return prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { rasmlar: JSON.stringify(photoFileIds) }
    });
  }

  /**
   * Sessiyani yakunlash
   */
  async completeSession(sessionId: string) {
    const session = await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { 
        holat: SessionStatus.YAKUNLANDI,
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

    if(process.env.GITHUB_PRIMARY==='1'){
      await prisma.notification.upsert({where:{id:'attendance-report:'+session.id},create:{id:'attendance-report:'+session.id,harakat:'ATTENDANCE_REPORT_PENDING',tafsilot:JSON.stringify({sessionId:session.id,deliveryVersion:2,developerArchive:true,trackingVersion:1,messages:{},reportSnapshot:attendanceSnapshot(session),adminDone:false,parentsDone:false,attempts:0,nextAt:0})},update:{}});
    }else{
    // Bot Service (alohida process) ga HTTP orqali xabar yuborish
    try {
      const botInternalUrl = process.env.BOT_INTERNAL_URL || 'http://localhost:3001/internal/notify';
      await fetch(botInternalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json','x-internal-token':process.env.BOT_TOKEN||'' },
        body: JSON.stringify({ sessionId: session.id })
      });
    } catch (error) {
      console.error('Botga xabar yuborishda xatolik:', (error as any)?.code||(error as any)?.name||'request');
    }

    }
    // GitHub ga sinxronizatsiya
    try {
      const { githubService } = require('./github.service');
      await githubService.syncAttendance(session.id);
    } catch (error) {
      console.error('GitHub ga sinxron qilishda xatolik:', (error as any)?.code||(error as any)?.name||'request');
    }

    return session;
  }

  /**
   * Sessiyani va unga tegishli telegram xabarlarni o'chirish
   */
  async deleteSession(sessionId: string,actor: string) {
    return requestReportDeletion(sessionId,actor);
  }

  /**
   * O'qituvchining tarixini olish
   */
  async getSessionsByTeacher(telegramId: string, dateStr?: string) {
    const where: any = {
      teacher: { telegramId: BigInt(telegramId) },
      holat: 'YAKUNLANDI'
    };
    
    if (dateStr) {
      const start = new Date(dateStr);
      start.setHours(0,0,0,0);
      const end = new Date(dateStr);
      end.setHours(23,59,59,999);
      where.sana = {
        gte: start,
        lte: end
      };
    }

    return prisma.attendanceSession.findMany({
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
  async getSessions(filters: { groupId?: string, teacherId?: string, date?: string }) {
    const where: any = {};
    if (filters.groupId) where.groupId = filters.groupId;
    if (filters.teacherId) where.teacherId = filters.teacherId;
    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0,0,0,0);
      const end = new Date(filters.date);
      end.setHours(23,59,59,999);
      where.sana = { gte: start, lte: end };
    }

    return prisma.attendanceSession.findMany({
      where,
      include: {
        group: { select: { nomi: true, sinfRahbariIsmi: true } },
        teacher: { select: { ismFamiliya: true, fanNomi: true } }
      },
      orderBy: { boshlanganVaqt: 'desc' }
    });
  }

  async getTodayStatus(dateStr?: string) {
    const today = dateStr ? new Date(dateStr) : new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const groups = await prisma.group.findMany({
      where: { faolmi: true },
      orderBy: { nomi: 'asc' }
    });

    const sessions = await prisma.attendanceSession.findMany({
      where: {
        sana: { gte: today, lt: tomorrow },
        holat: SessionStatus.YAKUNLANDI
      },
      include: { teacher: true, records: true }
    });

    return groups.map((g: any) => {
      const groupSessions = sessions.filter((s: any) => s.groupId === g.id);
      return {
        ...g,
        hasSubmittedToday: groupSessions.length > 0,
        sessions: groupSessions
      };
    });
  }

  async getSessionById(id: string) {
    return prisma.attendanceSession.findUnique({
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
  async cancelSession(id: string) {
    const session = await prisma.attendanceSession.findUnique({ where: { id } });
    if (!session) throw new Error('Sessiya topilmadi');
    if (session.holat === SessionStatus.YAKUNLANDI) {
      throw new Error('Sessiya allaqachon yakunlangan, bekor qilib bo`lmaydi');
    }

    return prisma.attendanceSession.update({
      where: { id },
      data: { holat: SessionStatus.BEKOR_QILINDI }
    });
  }
}
