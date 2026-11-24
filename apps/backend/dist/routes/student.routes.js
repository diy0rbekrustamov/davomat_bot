"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const student_controller_1 = require("../controllers/student.controller");
const role_middleware_1 = require("../middlewares/role.middleware");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const controller = new student_controller_1.StudentController();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.use(role_middleware_1.requireAdminOrTeacher);
router.post('/groups/:id/students', controller.add.bind(controller));
router.post('/groups/:id/students/import', upload.single('file'), controller.importExcel.bind(controller));
router.delete('/students/:id', controller.delete.bind(controller));
exports.default = router;
