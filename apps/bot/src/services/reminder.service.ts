import { Api } from 'grammy';
import { prisma,withGithubDatabase } from '@davomat/db';
import {leasedTask,taskIds,telegramCall,retryDelay,recipientUnavailable,queueError} from './queue-runtime';
import { remindersEnabled } from './reminder-settings.service';

export const REMINDER_TIMEZONE = 'Asia/Tashkent';
export const REMINDER_SCHEDULE = '20 8 * * *';

export function tashkentDayRange(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REMINDER_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  const start = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00+05:00`);
  return { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function reminderText(name: string): string {
  const safeName = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `🔔 <b>Eslatma!</b>\n\nHurmatli ${safeName}, bugun 8:30 da davomatni belgilash yodingizdan ko'tarilmasin..`;
}

export async function sendAttendanceReminders(api:Pick<Api,'sendMessage'>,now=new Date()):Promise<void>{await withGithubDatabase(async()=>{if(!await remindersEnabled())return;const teachers=await prisma.teacher.findMany({where:{faolmi:true,deletedAt:null}}),today=tashkentDayRange(now);for(const teacher of teachers){if(await prisma.attendanceSession.count({where:{teacherId:teacher.id,sana:today}}))continue;const id='reminder:'+today.gte.toISOString().slice(0,10)+':'+teacher.id;await prisma.notification.upsert({where:{id},create:{id,harakat:'REMINDER_PENDING',tafsilot:JSON.stringify({telegramId:teacher.telegramId.toString(),text:reminderText(teacher.ismFamiliya),day:today.gte.toISOString(),nextAt:0})},update:{}});}});}
export async function deliverReminders(api:any,now=new Date()){for(const task of await taskIds(['REMINDER_PENDING']))try{await leasedTask(task.id,['REMINDER_PENDING'],async(d,save)=>{const current=await withGithubDatabase(()=>remindersEnabled());const day=tashkentDayRange(now);if(!current||d.day!==day.gte.toISOString()||now.getTime()>day.gte.getTime()+(8*60+30)*60000){await save(()=>{},'REMINDER_EXPIRED');return;}let error:any;try{await telegramCall(signal=>api.sendMessage(d.telegramId,d.text,{parse_mode:'HTML'},signal));}catch(e){error=e;}if(error)await save(s=>{s.attempts=(s.attempts||0)+1;s.nextAt=Date.now()+retryDelay(error,s.attempts);},recipientUnavailable(error)?'REMINDER_UNDELIVERABLE':undefined);else await save(()=>{},'REMINDER_DELIVERED');});}catch(e){queueError('reminder',e);}}
export function startReminderWorker(api:any){let running=false;const tick=async()=>{if(running)return;running=true;try{await deliverReminders(api);}catch(e){queueError('reminder-list',e);}finally{running=false;}};void tick();setInterval(()=>void tick(),15000).unref();}