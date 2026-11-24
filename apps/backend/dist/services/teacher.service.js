"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherService = void 0;
const db_1 = require("@davomat/db");
const github_service_1 = require("./github.service");
const name_order_1 = require("./name-order");
const http_error_1 = require("../http-error");
const crypto_1 = require("crypto");
const access_notice_service_1 = require("./access-notice.service");
class TeacherService {
    async getTeacherByTelegramId(telegramId) {
        return db_1.prisma.teacher.findFirst({
            where: { telegramId: BigInt(telegramId) }
        });
    }
    async addTeacher(data) {
        const existing = await db_1.prisma.teacher.findUnique({
            where: { telegramId: BigInt(data.telegramId) }
        });
        if (existing?.faolmi && !existing.deletedAt)
            throw new http_error_1.HttpError(409, 'Bu Telegram ID tizimda allaqachon mavjud');
        if (data.rasmFileId && data.rasmFileId.startsWith('data:image/')) {
            const base64Data = data.rasmFileId.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const filename = `images/teachers/${(0, crypto_1.randomUUID)()}.png`;
            await github_service_1.githubService.pushFiles([{ path: filename, content: buffer, isBinary: true }], 'Oqituvchi rasmi yuklandi');
            const repoFullName = process.env.GITHUB_REPO?.trim() || 'provveb/database_davomat_byprovveb';
            data.rasmFileId = `https://raw.githubusercontent.com/${repoFullName}/main/${filename}`;
        }
        let teacher;
        let statusAction = 'new_teacher';
        if (existing) {
            if (!existing.faolmi || existing.deletedAt) {
                teacher = await db_1.prisma.teacher.update({
                    where: { id: existing.id },
                    data: {
                        faolmi: true,
                        deletedAt: null,
                        ismFamiliya: data.ismFamiliya,
                        fanNomi: data.fanNomi,
                        rasmFileId: data.rasmFileId,
                        telefon: data.telefon
                    }
                });
                statusAction = 'unblocked';
            }
            else {
                throw new Error('Bu Telegram ID tizimda allaqachon mavjud');
            }
        }
        else {
            teacher = await db_1.prisma.teacher.create({
                data: {
                    ...data,
                    telegramId: BigInt(data.telegramId)
                }
            });
        }
        if (existing)
            await db_1.prisma.group.updateMany({ where: { teacherId: teacher.id }, data: { sinfRahbariIsmi: teacher.ismFamiliya, sinfRahbariTelefon: teacher.telefon } });
        await github_service_1.githubService.syncTeachers();
        await (0, access_notice_service_1.queueAccessNotice)(teacher.telegramId, statusAction);
        return teacher;
    }
    async getAllTeachers() {
        return (0, name_order_1.byName)(await db_1.prisma.teacher.findMany({ where: { deletedAt: null } }), t => t.ismFamiliya, t => t.id);
    }
    async updateTeacher(id, data) {
        const oldTeacher = await db_1.prisma.teacher.findUnique({ where: { id } });
        if (!oldTeacher || oldTeacher.deletedAt)
            throw new http_error_1.HttpError(404, 'O‘qituvchi topilmadi yoki olib tashlangan.');
        let oldImageKey;
        if (data.rasmFileId && data.rasmFileId.startsWith('data:image/')) {
            const base64Data = data.rasmFileId.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const filename = `images/teachers/${(0, crypto_1.randomUUID)()}.png`;
            await github_service_1.githubService.pushFiles([{ path: filename, content: buffer, isBinary: true }], 'Oqituvchi rasmi yangilandi');
            const repoFullName = process.env.GITHUB_REPO?.trim() || 'provveb/database_davomat_byprovveb';
            data.rasmFileId = `https://raw.githubusercontent.com/${repoFullName}/main/${filename}`;
            // Remove the old media only after the new database snapshot is accepted.
            if (oldTeacher.rasmFileId?.includes('images/teachers/')) {
                oldImageKey = 'images/teachers/' + oldTeacher.rasmFileId.split('images/teachers/')[1];
            }
        }
        const teacher = await db_1.prisma.$transaction(async (tx) => {
            const updated = await tx.teacher.update({ where: { id }, data });
            if (data.ismFamiliya !== undefined || data.telefon !== undefined)
                await tx.group.updateMany({ where: { teacherId: id }, data: { sinfRahbariIsmi: updated.ismFamiliya, sinfRahbariTelefon: updated.telefon } });
            return updated;
        });
        // Rasm o'chirilishi tugagandan so'nggina ro'yxatni sinxron qilish
        await github_service_1.githubService.syncTeachers().catch(console.error);
        if (oldImageKey)
            (0, db_1.afterGithubCommit)(() => github_service_1.githubService.deleteSingleFile(oldImageKey));
        if (oldTeacher && data.faolmi !== undefined && oldTeacher.faolmi !== data.faolmi) {
            await (0, access_notice_service_1.queueAccessNotice)(teacher.telegramId, data.faolmi ? 'unblocked' : 'blocked');
        }
        if (data.faolmi === undefined && (data.ismFamiliya !== undefined || data.fanNomi !== undefined || data.telefon !== undefined || data.rasmFileId !== undefined))
            await (0, access_notice_service_1.queueAccessNotice)(teacher.telegramId, 'teacher_updated');
        return teacher;
    }
    async deleteTeacher(id) {
        const oldTeacher = await db_1.prisma.teacher.findUnique({ where: { id } });
        if (!oldTeacher)
            throw new http_error_1.HttpError(404, 'O‘qituvchi topilmadi.');
        if (oldTeacher.deletedAt)
            return oldTeacher;
        // Keep class links, photos and attendance history for audit and restoration.
        const teacher = await db_1.prisma.teacher.update({ where: { id }, data: { faolmi: false, deletedAt: new Date() } });
        await github_service_1.githubService.syncTeachers();
        await (0, access_notice_service_1.queueAccessNotice)(teacher.telegramId, 'deleted');
        return teacher;
    }
}
exports.TeacherService = TeacherService;
