import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { requireAdmin } from '../middlewares/role.middleware';

const router = Router();
const controller = new AdminController();

router.use(requireAdmin);

router.post('/', controller.create.bind(controller));
router.get('/', controller.getAll.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

export default router;
