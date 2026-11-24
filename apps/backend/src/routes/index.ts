import { requireAdmin } from '../middlewares/role.middleware';
import { GroupService } from '../services/group.service';
import { TeacherService } from '../services/teacher.service';
import { AttendanceService } from '../services/attendance.service';
import { Router } from 'express';
import groupRoutes from './group.routes';
import studentRoutes from './student.routes';
import teacherRoutes from './teacher.routes';
import attendanceRoutes from './attendance.routes';

import adminRoutes from './admin.routes';

const router = Router();

router.get('/dashboard', requireAdmin, async (req, res) => {
  const [groups, teachers, statusList] = await Promise.all([
    new GroupService().getAllGroups(), new TeacherService().getAllTeachers(), new AttendanceService().getTodayStatus(),
  ]);
  res.json({ groups, teachers, statusList });
});
router.use('/groups', groupRoutes);
router.use('/teachers', teacherRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/admins', adminRoutes);

// Buni oxiriga qoyamiz, chunki '/' barcha pathlarni ushlab oladi va ichidagi requireAdmin middleware hammasiga ta'sir qiladi!
router.use('/', studentRoutes); 

export default router;
