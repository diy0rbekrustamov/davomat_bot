import { Context } from 'grammy';
import { keyboardFor } from './group.handler';
import {
  DEVELOPER_ID, REMINDER_DISABLE_BUTTON, REMINDER_ENABLE_BUTTON,
  remindersEnabled, setRemindersEnabled,
} from '../services/reminder-settings.service';

export async function reminderSettingsHandler(ctx: Context) {
  if (ctx.chat?.type !== 'private' || ctx.from?.id !== DEVELOPER_ID) return;
  const text = ctx.message?.text;
  if (text === REMINDER_DISABLE_BUTTON) await setRemindersEnabled(false);
  if (text === REMINDER_ENABLE_BUTTON) await setRemindersEnabled(true);
  const enabled = await remindersEnabled();
  return ctx.reply(enabled
    ? '🔔 Avtomatik eslatmalar yoqilgan. Har kuni Toshkent vaqti bilan 08:20 da davomat kiritmagan faol o‘qituvchilarga 08:30 dagi davomat eslatiladi.'
    : '🔕 Avtomatik eslatmalar barcha o‘qituvchilar uchun o‘chirildi. Qayta yoqmaguningizcha eslatma yuborilmaydi.',
    { reply_markup: keyboardFor(DEVELOPER_ID, enabled) });
}
