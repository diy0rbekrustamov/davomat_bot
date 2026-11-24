import {teacherGroupsEnabled} from '@davomat/shared';
import { Context, InlineKeyboard } from 'grammy';
import { prisma } from '@davomat/db';
import { keyboardFor } from './group.handler';
import {resumeAccessNotices} from '../services/access-notice.service';
import {DEVELOPER_ID,remindersEnabled} from '../services/reminder-settings.service';
export const startHandler = async (ctx: Context) => {
  if (ctx.chat?.type !== 'private' || !ctx.from?.id) return;
  const telegramId = ctx.from.id;
  const adminUrl = process.env.ADMIN_WEBAPP_URL || 'https://davomat.provveb.uz';
  const teacherUrl = process.env.TEACHER_WEBAPP_URL || 'https://davomat.provveb.uz/teacher';
  try {
    await resumeAccessNotices(telegramId);
    // Administrative access and teaching access are independent capabilities.
    const [admin, teacher] = await Promise.all([
      prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } }),
      prisma.teacher.findUnique({ where: { telegramId: BigInt(telegramId) } }),
    ]);
    const canAdmin = telegramId === 8197301287 || !!admin?.faolmi;
    const canTeach = !!teacher?.faolmi && !teacher?.deletedAt;
    if (!canAdmin && !canTeach) return ctx.reply('Siz tizimda faol foydalanuvchi sifatida ro‘yxatdan o‘tmagansiz. Administratorga murojaat qiling.');
    const reminderState = telegramId === DEVELOPER_ID ? await remindersEnabled() : undefined;
    await ctx.reply("Ota-onalar guruhlarini ulash uchun Guruh qo'shish tugmasini bosing.", { reply_markup: keyboardFor(telegramId, reminderState,canAdmin,await teacherGroupsEnabled(prisma)) });
    const keyboard = new InlineKeyboard();
    if (canAdmin) keyboard.webApp('👨‍💻 Admin Panelga kirish', adminUrl);
    if (canAdmin && canTeach) keyboard.row();
    if (canTeach) keyboard.webApp('📷 Davomatni belgilash', teacherUrl);
    const name = teacher?.faolmi ? teacher.ismFamiliya : admin?.ismFamiliya || 'Asosiy Egasi';
    return ctx.reply(`Assalomu alaykum, ${name}.\nKerakli bo‘limni tanlang:`, { reply_markup: keyboard });
  } catch {
    return ctx.reply('Tizim bilan bog‘lanishda xatolik yuz berdi. Qayta urinib ko‘ring.');
  }
};
