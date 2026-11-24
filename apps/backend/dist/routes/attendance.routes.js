"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendance_controller_1 = require("../controllers/attendance.controller");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
const controller = new attendance_controller_1.AttendanceController();
// --- O'qituvchi uchun yo'nalishlar ---
// Skan qilingan QR ni tekshirish
router.get('/scan/:qrToken', role_middleware_1.requireTeacher, controller.scanQr.bind(controller));
// O'qituvchining davomat tarixi
router.get('/teacher-sessions', role_middleware_1.requireTeacher, controller.getTeacherSessions.bind(controller));
router.get('/teacher-sessions/:id', role_middleware_1.requireTeacher, controller.getSessionById.bind(controller));
// Sessiyani boshlash
router.post('/sessions', role_middleware_1.requireTeacher, controller.startSession.bind(controller));
// Davomat belgilash
router.patch('/sessions/:id/records', role_middleware_1.requireTeacher, controller.record.bind(controller));
// Rasm yuklash
const multer_1 = __importDefault(require("multer"));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post('/sessions/:id/photos', role_middleware_1.requireTeacher, upload.array('photos', 5), controller.addPhotos.bind(controller));
// Yakunlash
router.post('/sessions/:id/complete', role_middleware_1.requireTeacher, controller.complete.bind(controller));
// --- Admin uchun yo'nalishlar ---
router.get('/today-status', role_middleware_1.requireAdmin, controller.getTodayStatus.bind(controller));
router.get('/sessions', role_middleware_1.requireAdmin, controller.getAllSessions.bind(controller));
router.get('/sessions/:id', role_middleware_1.requireAdmin, controller.getSessionById.bind(controller));
// Chala qolgan JARAYONDA sessiyalarni bekor qilish
router.patch('/sessions/:id/cancel', role_middleware_1.requireAdmin, controller.cancelSession.bind(controller));
// Xisobotni o'chirish (POST ishlatamiz chunki proxy DELETE da muammo qilyapti)
router.post('/sessions/:id/delete', role_middleware_1.requireAdmin, controller.deleteSession.bind(controller));
exports.default = router;
