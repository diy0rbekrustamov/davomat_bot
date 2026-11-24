import { Router } from 'express';
import { GroupController } from '../controllers/group.controller';
import { requireAdmin,requireAdminOrTeacher } from '../middlewares/role.middleware';

const router = Router();
const controller = new GroupController();

// O'qituvchilar va Adminlar guruhlarni boshqara oladi
router.use(requireAdminOrTeacher);

router.get('/teacher-management',requireAdmin,controller.teacherPolicy.bind(controller));
router.patch('/teacher-management',requireAdmin,controller.setTeacherPolicy.bind(controller));
router.post('/', controller.create.bind(controller));
router.get('/', controller.getAll.bind(controller));
router.get('/telegram-chats', controller.getTelegramChats.bind(controller));
router.get('/page-data', controller.getPageData.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));
router.post('/send-qr', controller.sendQr.bind(controller));
router.post('/send-qr-zip', controller.sendQrZip.bind(controller));

export default router;
