"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teacher_controller_1 = require("../controllers/teacher.controller");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
const controller = new teacher_controller_1.TeacherController();
router.get('/me', role_middleware_1.requireTeacher, controller.getMe.bind(controller));
router.patch('/me/photo', role_middleware_1.requireTeacher, controller.updateMyPhoto.bind(controller));
// Teacherlar ham o'zini yoki boshqalarni listini ko'ra olsin dropdown uchun
router.get('/', role_middleware_1.requireAdminOrTeacher, controller.getAll.bind(controller));
router.use(role_middleware_1.requireAdmin);
router.post('/', controller.create.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));
exports.default = router;
