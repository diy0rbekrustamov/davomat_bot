import { Request, Response } from 'express';
import { prisma } from '@davomat/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import {queueAccessNotice} from '../services/access-notice.service';

const createAdminSchema = z.object({
  telegramId: z.union([z.string().trim().regex(/^[1-9]\d{0,15}$/), z.number().int().positive().safe()]).refine(v => Number.isSafeInteger(Number(v)), 'Telegram ID noto‘g‘ri'),
  ismFamiliya: z.string().min(1, 'Ism familiya majburiy'),
  lavozim: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional()
});

export class AdminController {
  async create(req: Request, res: Response) {
    try {
      const data = createAdminSchema.parse(req.body);
      const existing = await prisma.admin.findUnique({
        where: { telegramId: BigInt(data.telegramId) }
      });

      let hashedPassword = null;
      if (data.password) {
        hashedPassword = await bcrypt.hash(data.password, 10);
      }

      if (existing) {
        if (!existing.faolmi) {
          const restored = await prisma.admin.update({
            where: { id: existing.id },
            data: {
              faolmi: true,
              ismFamiliya: data.ismFamiliya,
              lavozim: data.lavozim,
              ...(data.username && { username: data.username }),
              ...(hashedPassword && { password: hashedPassword })
            }
          });
          await queueAccessNotice(restored.telegramId,'admin_restored');
          return res.status(200).json({ ...restored, telegramId: restored.telegramId.toString() });
        }
        return res.status(400).json({ message: 'Bu Telegram ID allaqachon mavjud' });
      }

      const admin = await prisma.admin.create({
        data: {
          telegramId: BigInt(data.telegramId),
          ismFamiliya: data.ismFamiliya,
          lavozim: data.lavozim,
          username: data.username || null,
          password: hashedPassword
        }
      });

      await queueAccessNotice(admin.telegramId,'admin_added');
      // BigInt ni string ga o'tkazamiz
      res.status(201).json({ ...admin, telegramId: admin.telegramId.toString() });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getAll(req: Request, res: Response) {
    const admins = await prisma.admin.findMany({
      where: { faolmi: true },
      orderBy: { ismFamiliya: 'asc' }
    });
    
    // Asosiy egani qo'shib qo'yamiz (sun'iy tarzda)
    const allAdmins = [
      { id: 'super', telegramId: '8197301287', ismFamiliya: 'Asosiy Egasi (Siz)', lavozim: 'Yaratuvchi', faolmi: true },
      ...admins.map((a: any) => ({ ...a, telegramId: a.telegramId.toString() }))
    ];

    res.json(allAdmins);
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    
    if (id === 'super') {
      return res.status(403).json({ message: 'Asosiy egani o\'chirib bo\'lmaydi' });
    }

    const existing=await prisma.admin.findUnique({where:{id}});
    if(!existing)return res.status(404).json({message:'Admin topilmadi.'});
    if(!existing.faolmi)return res.json({message:'Admin huquqi allaqachon olib tashlangan.'});
    const removed = await prisma.admin.update({
      where: { id },
      data: { faolmi: false }
    });
    await queueAccessNotice(removed.telegramId,'admin_removed');
    res.json({ message: 'Admin o\'chirildi' });
  }

  async changeSuperPassword(req: Request, res: Response) {
    if ((req as any).telegramUser?.id?.toString() !== '8197301287') {
      return res.status(403).json({ message: 'Sizda bu amalni bajarish huquqi yo\'q!' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username va parol kiritilishi shart' });
    }

    const fs = require('fs');
    const path = require('path');
    
    const envPath = path.join(process.cwd(), '.env');
    let envData = '';
    if (fs.existsSync(envPath)) {
      envData = fs.readFileSync(envPath, 'utf8');
    }

    if (envData.includes('SUPERADMIN_USER=')) {
      envData = envData.replace(/SUPERADMIN_USER=.*/g, `SUPERADMIN_USER=${username}`);
    } else {
      envData += `\nSUPERADMIN_USER=${username}`;
    }

    if (envData.includes('SUPERADMIN_PASS=')) {
      envData = envData.replace(/SUPERADMIN_PASS=.*/g, `SUPERADMIN_PASS=${password}`);
    } else {
      envData += `\nSUPERADMIN_PASS=${password}`;
    }

    fs.writeFileSync(envPath, envData);
    
    process.env.SUPERADMIN_USER = username;
    process.env.SUPERADMIN_PASS = password;

    res.json({ message: 'Asosiy parol muvaffaqiyatli o\'zgartirildi' });
  }
}
