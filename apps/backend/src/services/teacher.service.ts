import { prisma, Teacher, afterGithubCommit } from '@davomat/db';
import { githubService } from './github.service';
import { byName } from './name-order';
import {HttpError} from '../http-error';
import {randomUUID} from 'crypto';
import {queueAccessNotice} from './access-notice.service';

interface CreateTeacherDto {
  telegramId: string | number | bigint;
  ismFamiliya: string;
  rasmFileId?: string;
  fanNomi: string;
  telefon?: string;
}

interface UpdateTeacherDto {
  ismFamiliya?: string;
  rasmFileId?: string;
  fanNomi?: string;
  telefon?: string;
}

export class TeacherService {
  async getTeacherByTelegramId(telegramId: string) {
    return prisma.teacher.findFirst({
      where: { telegramId: BigInt(telegramId) }
    });
  }

  async addTeacher(data: CreateTeacherDto): Promise<Teacher> {
    const existing = await prisma.teacher.findUnique({
      where: { telegramId: BigInt(data.telegramId) }
    });

    if (existing?.faolmi && !existing.deletedAt) throw new HttpError(409,'Bu Telegram ID tizimda allaqachon mavjud');
    if (data.rasmFileId && data.rasmFileId.startsWith('data:image/')) {
      const base64Data = data.rasmFileId.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `images/teachers/${randomUUID()}.png`;
      await githubService.pushFiles([{ path: filename, content: buffer, isBinary: true }], 'Oqituvchi rasmi yuklandi');
      const repoFullName = process.env.GITHUB_REPO?.trim() || 'provveb/database_davomat_byprovveb';
      data.rasmFileId = `https://raw.githubusercontent.com/${repoFullName}/main/${filename}`;
    }

    let teacher;
    let statusAction: 'unblocked' | 'new_teacher' = 'new_teacher';

    if (existing) {
      if (!existing.faolmi || existing.deletedAt) {
        teacher = await prisma.teacher.update({
          where: { id: existing.id },
          data: {
            faolmi: true,
            deletedAt: null,
            ismFamiliya: data.ismFamiliya,
            fanNomi: data.fanNomi,
            rasmFileId: data.rasmFileId,
            telefon: data.telefon
          }
        });
        statusAction = 'unblocked';
      } else {
        throw new Error('Bu Telegram ID tizimda allaqachon mavjud');
      }
    } else {
      teacher = await prisma.teacher.create({
        data: {
          ...data,
          telegramId: BigInt(data.telegramId)
        }
      });
    }

    if(existing)await prisma.group.updateMany({where:{teacherId:teacher.id},data:{sinfRahbariIsmi:teacher.ismFamiliya,sinfRahbariTelefon:teacher.telefon}});
    await githubService.syncTeachers();
    await queueAccessNotice(teacher.telegramId,statusAction);
    return teacher;
  }

  async getAllTeachers(): Promise<Teacher[]> {
    return byName(await prisma.teacher.findMany({where:{deletedAt:null}}), t=>t.ismFamiliya, t=>t.id);
  }

  async updateTeacher(id: string, data: UpdateTeacherDto & { faolmi?: boolean }): Promise<Teacher> {
    const oldTeacher = await prisma.teacher.findUnique({ where: { id } });
    if (!oldTeacher || oldTeacher.deletedAt) throw new HttpError(404,'O‘qituvchi topilmadi yoki olib tashlangan.');
    let oldImageKey: string | undefined;

    if (data.rasmFileId && data.rasmFileId.startsWith('data:image/')) {
      const base64Data = data.rasmFileId.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `images/teachers/${randomUUID()}.png`;
      await githubService.pushFiles([{ path: filename, content: buffer, isBinary: true }], 'Oqituvchi rasmi yangilandi');
      const repoFullName = process.env.GITHUB_REPO?.trim() || 'provveb/database_davomat_byprovveb';
      data.rasmFileId = `https://raw.githubusercontent.com/${repoFullName}/main/${filename}`;
      
      // Remove the old media only after the new database snapshot is accepted.
      if (oldTeacher.rasmFileId?.includes('images/teachers/')) {
        oldImageKey='images/teachers/'+oldTeacher.rasmFileId.split('images/teachers/')[1];
      }

    }

    const teacher = await prisma.$transaction(async tx=>{
      const updated=await tx.teacher.update({where:{id},data});
      if(data.ismFamiliya!==undefined || data.telefon!==undefined)await tx.group.updateMany({where:{teacherId:id},data:{sinfRahbariIsmi:updated.ismFamiliya,sinfRahbariTelefon:updated.telefon}});
      return updated;
    });
    
    // Rasm o'chirilishi tugagandan so'nggina ro'yxatni sinxron qilish
    await githubService.syncTeachers().catch(console.error);
    if(oldImageKey)afterGithubCommit(()=>githubService.deleteSingleFile(oldImageKey!));
    
    if (oldTeacher && data.faolmi !== undefined && oldTeacher.faolmi !== data.faolmi) {
      await queueAccessNotice(teacher.telegramId,data.faolmi ? 'unblocked' : 'blocked');
    }
    
    if(data.faolmi===undefined && (data.ismFamiliya!==undefined||data.fanNomi!==undefined||data.telefon!==undefined||data.rasmFileId!==undefined))await queueAccessNotice(teacher.telegramId,'teacher_updated');
    return teacher;
  }

  async deleteTeacher(id: string): Promise<Teacher> {
    const oldTeacher = await prisma.teacher.findUnique({where:{id}});
    if(!oldTeacher)throw new HttpError(404,'O‘qituvchi topilmadi.');
    if(oldTeacher.deletedAt)return oldTeacher;
    // Keep class links, photos and attendance history for audit and restoration.
    const teacher=await prisma.teacher.update({where:{id},data:{faolmi:false,deletedAt:new Date()}});
    await githubService.syncTeachers();
    await queueAccessNotice(teacher.telegramId,'deleted');
    return teacher;
  }
}
