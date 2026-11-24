import cron from 'node-cron';
import { withGithubDatabase } from '@davomat/db';
import { bot } from '../bot';
import { sendAttendanceReminders, startReminderWorker, REMINDER_SCHEDULE, REMINDER_TIMEZONE } from '../services/reminder.service';

export const setupCronJobs = () => {

  console.log(`Davomat eslatmasi: 08:20 (${REMINDER_TIMEZONE}).`);
  return cron.schedule(REMINDER_SCHEDULE, async () => {
    try {
      await sendAttendanceReminders(bot.api);
    } catch {
      console.error('Davomat eslatmasini yuborishda xatolik.');
    }
  }, { timezone: REMINDER_TIMEZONE });
};
