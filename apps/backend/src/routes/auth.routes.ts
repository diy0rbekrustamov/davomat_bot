import { Router } from 'express';
import { prisma } from '@davomat/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const attempts=new Map<string,{count:number;until:number}>();
router.use((req,res,next)=>{const key=String(req.ip)+':'+String(req.body?.username||'').slice(0,100);const current=attempts.get(key),now=Date.now();if(current&&current.until>now&&current.count>=10)return res.status(429).json({message:'Juda ko‘p kirish urinishi. 15 daqiqadan keyin qayta urinib ko‘ring.'});if(attempts.size>10000)for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);if(attempts.size>10000)attempts.delete(attempts.keys().next().value!);attempts.set(key,{count:current&&current.until>now?current.count+1:1,until:current&&current.until>now?current.until:now+900000});next();});
const JWT_SECRET=process.env.JWT_SECRET;
if(!JWT_SECRET)throw new Error('JWT_SECRET serverda sozlanmagan.');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (typeof username!=='string'||typeof password!=='string'||!username||!password||username.length>100||password.length>128) {
      return res.status(400).json({ message: 'Username va parol kiritilishi shart' });
    }

    // Maxsus Super Admin tekshiruvi (.env dagi ma'lumotlar orqali yoki qattiq kodlangan)
    const SUPER_USER = process.env.SUPERADMIN_USER;
    const SUPER_PASS = process.env.SUPERADMIN_PASS;

    if (SUPER_USER && SUPER_PASS && username === SUPER_USER && password === SUPER_PASS) {
      const token = jwt.sign({ id: 'superadmin', role: 'SUPER_ADMIN' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { id: 'superadmin', name: 'Asosiy Egasi', role: 'SUPER_ADMIN' } });
    }

    // Boshqa adminlarni bazadan izlaymiz
    const admin = await prisma.admin.findUnique({
      where: { username }
    });

    if (!admin || !admin.faolmi || !admin.password) {
      return res.status(401).json({ message: 'Login yoki parol noto`g`ri (yoki akkaunt faol emas)' });
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Login yoki parol noto`g`ri' });
    }

    const token = jwt.sign({ id: admin.id, role: 'ADMIN', telegramId: admin.telegramId.toString() }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ token, user: { id: admin.id, name: admin.ismFamiliya, role: 'ADMIN' } });

  } catch (error: any) {
    console.error('Login xatosi:', (error as any)?.code||(error as any)?.name||'request');
    res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
  }
});

export default router;
