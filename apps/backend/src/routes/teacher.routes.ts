import { Router } from 'express';
import { TeacherController } from '../controllers/teacher.controller';
import { requireAdmin, requireTeacher, requireAdminOrTeacher } from '../middlewares/role.middleware';

const router = Router();
const controller = new TeacherController();

router.get('/me', requireTeacher, controller.getMe.bind(controller));
router.patch('/me/photo', requireTeacher, controller.updateMyPhoto.bind(controller));

// Teacherlar ham o'zini yoki boshqalarni listini ko'ra olsin dropdown uchun
router.get('/', requireAdminOrTeacher, controller.getAll.bind(controller));

router.use(requireAdmin);

router.post('/', controller.create.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

export default router;
