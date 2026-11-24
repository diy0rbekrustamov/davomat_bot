import { Request, Response, NextFunction } from 'express';
import { prisma } from '@davomat/db';

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).telegramUser;

  if (!user) {
    return res.status(401).json({ message: 'Avtorizatsiyadan o`tilmagan' });
  }

  const isSuperAdmin = user.id.toString() === '8197301287';
  if (isSuperAdmin) {
    return next();
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { telegramId: BigInt(user.id) },
    });

    if (!admin || !admin.faolmi) {
      return res.status(403).json({ message: 'Sizda admin huquqlari yo`q' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Server xatoligi' });
  }
};

export const requireTeacher = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).telegramUser;

  if (!user) {
    return res.status(401).json({ message: 'Avtorizatsiyadan o`tilmagan' });
  }

  try {
    const teacher = await prisma.teacher.findUnique({
      where: { telegramId: BigInt(user.id) },
    });

    if (!teacher || !teacher.faolmi || !!teacher.deletedAt) {
      return res.status(403).json({ message: 'Siz tizimda faol o`qituvchi emassiz' });
    }

    (req as any).dbTeacher=teacher;
    (req as any).userRole='teacher';
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Server xatoligi' });
  }
};

export const requireAdminOrTeacher = async (req: Request, res: Response, next: NextFunction) => {
  // The teacher Mini App always uses teacher permissions, even for dual-role users.
  if(req.headers['x-app-view']==='teacher')return requireTeacher(req,res,next);
  const user = (req as any).telegramUser;

  if (!user) {
    return res.status(401).json({ message: 'Avtorizatsiyadan o`tilmagan' });
  }

  const isSuperAdmin = user.id.toString() === '8197301287';
  if (isSuperAdmin) {
    (req as any).userRole = 'admin';
    return next();
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { telegramId: BigInt(user.id) },
    });

    if (admin && admin.faolmi) {
      (req as any).userRole = 'admin';
      return next();
    }

    const teacher = await prisma.teacher.findUnique({
      where: { telegramId: BigInt(user.id) },
    });

    if (teacher && teacher.faolmi && !teacher.deletedAt) {
      (req as any).userRole = 'teacher';
      (req as any).dbTeacher = teacher;
      return next();
    }

    return res.status(403).json({ message: 'Ruxsat etilmagan' });
  } catch (error) {
    return res.status(500).json({ message: 'Server xatoligi' });
  }
};
