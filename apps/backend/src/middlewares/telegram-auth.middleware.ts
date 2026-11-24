import { Request, Response, NextFunction } from 'express';
import { validateTelegramInitData, TelegramUser } from '@davomat/shared';

// Express Request interfeysini kengaytiramiz
declare global {
  namespace Express {
    interface Request {
      telegramUser?: TelegramUser;
    }
  }
}

import jwt from 'jsonwebtoken';

const JWT_SECRET=process.env.JWT_SECRET;
if(!JWT_SECRET)throw new Error('JWT_SECRET serverda sozlanmagan.');

export const telegramAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ message: 'Avtorizatsiya tokeni topilmadi' });
  }

  // Agar token Bearer bilan boshlansa (JWT Token Windows App uchun)
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // JWT dan olingan userni req.telegramUser o'rniga mock qilamiz
      const telegramId=decoded.id==='superadmin'&&decoded.role==='SUPER_ADMIN'?8197301287:Number(decoded.telegramId);
      if(!Number.isSafeInteger(telegramId)||telegramId<=0)return res.status(401).json({message:'Sessiya egasi topilmadi'});
      req.telegramUser = {
        id: telegramId,
        first_name: decoded.name || 'Admin',
        username: decoded.id
      };
      
      return next();
    } catch (err) {
      return res.status(401).json({ message: 'Yaroqsiz yoki eskirgan JWT token' });
    }
  }

  // Telegram TMA avtorizatsiyasi (Web App uchun)
  let initData = authHeader.startsWith('tma ') ? authHeader.substring(4) : req.headers['x-telegram-init-data'];
  
  if (Array.isArray(initData)) initData = initData[0];

  if (!initData || typeof initData !== 'string') {
    return res.status(401).json({ message: 'Avtorizatsiya tokeni (TMA) topilmadi' });
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    console.error('BOT_TOKEN topilmadi');
    return res.status(500).json({ message: 'Server xatoligi' });
  }

  const user = validateTelegramInitData(initData, botToken);

  if (!user) {
    return res.status(403).json({ message: 'Yaroqsiz avtorizatsiya ma`lumotlari' });
  }

  req.telegramUser = user;
  next();
};
