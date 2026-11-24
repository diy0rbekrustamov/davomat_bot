import multer from 'multer';
import 'dotenv/config';
import 'express-async-errors'; // Async xatolarni tutish uchun
import express from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import {HttpError} from './http-error';
import {ZodError} from 'zod';
import crypto from 'crypto';
import {prisma,withGithubDatabase,storageHealth,storageStatus,drainGithubDatabase,githubPrimary} from '@davomat/db';
import { telegramAuthMiddleware } from './middlewares/telegram-auth.middleware';

// BigInt ni JSON.stringify da string qilish uchun patch
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

import authRoutes from './routes/auth.routes';

// Qr kodlarni external olish uchun statik fayl sifatida xizmat qilish
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/health',async(req,res)=>{try{if(!githubPrimary())await prisma.group.count();const status=await storageStatus();res.status(status.ok?200:503).json(status);}catch{res.status(503).json({ok:false,code:'STORAGE_HEALTH_UNAVAILABLE'});}});
app.get('/ready',async(req,res)=>{try{const storage=await storageStatus();let botOk=process.env.DISABLE_BOT==='1';if(!botOk){const r=await fetch('http://127.0.0.1:3001/health',{signal:AbortSignal.timeout(1500)});botOk=r.ok;await r.body?.cancel();}res.status(storage.ok&&botOk?200:503).json({ok:storage.ok&&botOk,storage:storage.storage,bot:process.env.DISABLE_BOT==='1'?'disabled':botOk?'running':'unavailable',code:storage.code});}catch{res.status(503).json({ok:false,code:'READINESS_FAILED'});}});
app.use('/api',(req,res,next)=>{if(req.path==='/auth/login')return next();return telegramAuthMiddleware(req,res,next);});
const photoUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:5}});
app.post('/api/attendance/sessions/:id/photos',photoUpload.array('photos',5));
app.post('/api/groups/:id/students/import',multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1}}).single('file'));
// Buffer the HTTP response until GitHub has accepted all database changes.
app.use('/api',async(req,res,next)=>{
 if(!githubPrimary())return next();
 const end=res.end.bind(res),write=res.write.bind(res);const chunks:Buffer[]=[];
 try{
  await withGithubDatabase(()=>new Promise<void>((resolve,reject)=>{
   (res as any).write=(chunk:any)=>{if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));return true;};
   (res as any).end=(chunk:any)=>{if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));if(res.statusCode>=400)reject(Object.assign(Error('HTTP response failed'),{httpResponse:true}));else resolve();return res;};
   next();
  }), {readOnly:req.method==='GET'||req.method==='HEAD',maxAgeMs:10000});
  (res as any).end=end;(res as any).write=write;
  if(res.locals.afterStorageCommit){const task=res.locals.afterStorageCommit;delete res.locals.afterStorageCommit;await task();}else end(Buffer.concat(chunks));
 }catch(error:any){(res as any).end=end;(res as any).write=write;if(error?.httpResponse){end(Buffer.concat(chunks));return;}res.removeHeader('Content-Length');res.removeHeader('Content-Encoding');console.error('DAVOMAT_DIAG',JSON.stringify({phase:'api-storage',code:error?.code||error?.name,operationId:error?.operationId}));const uncertain=['STORAGE_COMMIT_UNCONFIRMED','STORAGE_CONFLICT_REVIEW'].includes(error?.code);res.status(503).json({code:error?.code||'STORAGE_UNAVAILABLE',operationId:error?.operationId,message:uncertain?'Saqlash natijasi tekshirilmoqda. Amalni takrorlamang; holatni yangilang.':'O‘zgarish saqlanmadi. Holatni yangilang.'});}
});

// Windows App (yoki boshqa tashqi klientlar) uchun ochiq login tizimi
app.use('/api/auth', authRoutes);

// Barcha /api route'lari (yuqoridagi /api/auth dan tashqari) avtorizatsiya talab qiladi
// Middleware ichida JWT va Telegram TMA tokenlari qabul qilinadi
app.use('/api', routes);

app.post('/internal/sync-database', async (req,res)=>{
 const supplied=req.headers['x-internal-token'];const expected=process.env.BOT_TOKEN;
 if(typeof supplied!=='string'||!expected||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.sendStatus(403);
 if(!githubPrimary())githubService.scheduleDatabaseBackup();res.json({queued:!githubPrimary(),storage:githubPrimary()?'github':'local'});
});

// Global xatolik tutuvchi (Error Handler)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:',err.code||err.status||'request');
  if (err instanceof HttpError) return res.status(err.status).json({message:err.message});
  if (err instanceof ZodError) return res.status(400).json({message:err.issues.map(i=>i.message).join('; ')});
  if (err instanceof Error) {
    return res.status(500).json({ message: 'Serverda xatolik. Keyinroq urinib ko‘ring.' });
  }
  res.status(500).json({ message: 'Noma`lum server xatoligi' });
});

import { githubService } from './services/github.service';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  if(githubPrimary()){try{await storageHealth();}catch(error:any){console.error('DAVOMAT_DIAG',JSON.stringify({phase:'bootstrap-storage',code:error?.code||error?.name}));}}else{await githubService.pullDatabase();githubService.startPeriodicBackup();}
  const server=app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

bootstrap();
