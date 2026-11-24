"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentService = void 0;
const db_1 = require("@davomat/db");
const xlsx = __importStar(require("xlsx"));
class StudentService {
    async addStudent(data) {
        const group = await db_1.prisma.group.findUnique({ where: { id: data.groupId } });
        if (!group || !group.faolmi) {
            throw new Error('Guruh topilmadi yoki faol emas');
        }
        return db_1.prisma.student.create({ data });
    }
    async deleteStudent(id) {
        return db_1.prisma.student.delete({ where: { id } });
    }
    /**
     * Excel faylni parse qilib o'quvchilarni guruhga qo'shadi.
     * "Ism Familiya" ustuni mavjud bo'lishi kerak.
     */
    async importFromExcel(groupId, fileBuffer, replace = false) {
        const group = await db_1.prisma.group.findUnique({ where: { id: groupId } });
        if (!group || !group.faolmi) {
            throw new Error('Guruh topilmadi yoki faol emas');
        }
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // JSON ga o'girish, 1-qatorni sarlavha (header) sifatida oladi
        const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
        if (rows.length === 0) {
            throw new Error('Fayl bo`sh');
        }
        // Ustun nomini topamiz ("Ism Familiya", har xil case'larni inobatga olib)
        const headerRow = Object.keys(rows[0]);
        const nameColumn = headerRow.find(h => h.trim().toLowerCase() === 'ism familiya');
        if (!nameColumn) {
            throw new Error('Excel faylda "Ism Familiya" nomli ustun topilmadi');
        }
        const errors = [];
        const validStudents = [];
        // Validatsiya
        rows.forEach((row, index) => {
            const ism = row[nameColumn]?.toString().trim();
            const rowNum = index + 2; // Excelda header bilan 1-qator band, ma'lumot 2-qatordan boshlanadi
            if (!ism) {
                errors.push(`${rowNum}-qator: Ism Familiya bo'sh`);
            }
            else {
                validStudents.push(ism);
            }
        });
        if (errors.length > 0) {
            throw { message: 'Excel validatsiya xatosi', errors };
        }
        await db_1.prisma.$transaction(async (tx) => {
            if (replace)
                await tx.student.deleteMany({ where: { groupId } });
            await tx.student.createMany({ data: validStudents.map(ismFamiliya => ({ groupId, ismFamiliya })) });
        });
        return { success: validStudents.length, errors: [] };
    }
}
exports.StudentService = StudentService;
