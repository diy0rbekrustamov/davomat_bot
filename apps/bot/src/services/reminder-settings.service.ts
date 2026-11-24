import { prisma } from '@davomat/db';

export const DEVELOPER_ID = 8197301287;
export const REMINDER_SETTINGS_BUTTON = '🔔 Eslatma sozlamalari';
export const REMINDER_DISABLE_BUTTON = '🔕 Eslatmalarni o‘chirish';
export const REMINDER_ENABLE_BUTTON = '🔔 Eslatmalarni yoqish';
const SETTINGS_ID = 'attendance-reminder-settings';

export async function remindersEnabled(): Promise<boolean> {
  const settings = await prisma.notification.findUnique({ where: { id: SETTINGS_ID } });
  return settings?.tafsilot !== 'disabled';
}

export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  const data = { harakat: 'ATTENDANCE_REMINDER_SETTINGS', tafsilot: enabled ? 'enabled' : 'disabled' };
  await prisma.notification.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });
}
