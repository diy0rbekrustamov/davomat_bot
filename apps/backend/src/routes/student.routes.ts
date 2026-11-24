import { Router } from 'express';
import { StudentController } from '../controllers/student.controller';
import { requireAdminOrTeacher } from '../middlewares/role.middleware';
import multer from 'multer';

const router = Router();
const controller = new StudentController();

const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAdminOrTeacher);

router.post('/groups/:id/students', controller.add.bind(controller));
router.post('/groups/:id/students/import', controller.importExcel.bind(controller));
router.patch('/students/:id', controller.update.bind(controller));
router.delete('/students/:id', controller.delete.bind(controller));

export default router;
