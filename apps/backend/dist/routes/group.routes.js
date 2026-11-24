"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const group_controller_1 = require("../controllers/group.controller");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
const controller = new group_controller_1.GroupController();
// O'qituvchilar va Adminlar guruhlarni boshqara oladi
router.use(role_middleware_1.requireAdminOrTeacher);
router.post('/', controller.create.bind(controller));
router.get('/', controller.getAll.bind(controller));
router.get('/telegram-chats', controller.getTelegramChats.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));
router.post('/send-qr', controller.sendQr.bind(controller));
router.post('/send-qr-zip', controller.sendQrZip.bind(controller));
exports.default = router;
