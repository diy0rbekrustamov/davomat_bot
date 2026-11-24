"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const group_routes_1 = __importDefault(require("./group.routes"));
const student_routes_1 = __importDefault(require("./student.routes"));
const teacher_routes_1 = __importDefault(require("./teacher.routes"));
const attendance_routes_1 = __importDefault(require("./attendance.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const router = (0, express_1.Router)();
router.use('/groups', group_routes_1.default);
router.use('/teachers', teacher_routes_1.default);
router.use('/attendance', attendance_routes_1.default);
router.use('/admins', admin_routes_1.default);
// Buni oxiriga qoyamiz, chunki '/' barcha pathlarni ushlab oladi va ichidagi requireAdmin middleware hammasiga ta'sir qiladi!
router.use('/', student_routes_1.default);
exports.default = router;
