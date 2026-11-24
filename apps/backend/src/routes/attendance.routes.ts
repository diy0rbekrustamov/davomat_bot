import { Router } from 'express';
import { AttendanceController } from '../controllers/attendance.controller';
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware';

const router = Router();
const controller = new AttendanceController();

// --- O'qituvchi uchun yo'nalishlar ---

// Skan qilingan QR ni tekshirish
router.get('/scan/:qrToken', requireTeacher, controller.scanQr.bind(controller));

// O'qituvchining davomat tarixi
router.get('/teacher-sessions', requireTeacher, controller.getTeacherSessions.bind(controller));
router.get('/teacher-sessions/:id', requireTeacher, controller.getSessionById.bind(controller));

// Sessiyani boshlash
router.post('/sessions', requireTeacher, controller.startSession.bind(controller));

// Davomat belgilash
router.patch('/sessions/:id/records', requireTeacher, controller.record.bind(controller));

// Rasm yuklash
import multer from 'multer';


router.post('/sessions/:id/photos', requireTeacher, controller.addPhotos.bind(controller));

// Yakunlash
router.post('/sessions/:id/complete', requireTeacher, controller.complete.bind(controller));


// --- Admin uchun yo'nalishlar ---
const developerOnly=(req:any,res:any,next:any)=>String(req.telegramUser?.id)==='8197301287'?next():res.status(403).json({message:'Davomatni faqat developer tahrirlaydi.'});
router.patch('/sessions/:id/developer-edit',developerOnly,controller.editReport.bind(controller));
router.post('/sessions/:id/edit-retry',developerOnly,controller.retryEdit.bind(controller));
router.get('/deletions', requireAdmin, controller.deletions.bind(controller));
router.get('/deletions/:id/archive', requireAdmin, controller.archive.bind(controller));
router.post('/deletions/:id/retry', requireAdmin, controller.retryDelete.bind(controller));
router.get('/today-status', requireAdmin, controller.getTodayStatus.bind(controller));
router.get('/sessions', requireAdmin, controller.getAllSessions.bind(controller));
router.get('/sessions/:id', requireAdmin, controller.getSessionById.bind(controller));
// Chala qolgan JARAYONDA sessiyalarni bekor qilish
router.patch('/sessions/:id/cancel', requireAdmin, controller.cancelSession.bind(controller));

// Xisobotni o'chirish (POST ishlatamiz chunki proxy DELETE da muammo qilyapti)
router.post('/sessions/:id/delete', requireAdmin, controller.deleteSession.bind(controller));

export default router;
