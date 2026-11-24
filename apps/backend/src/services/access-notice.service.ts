import {prisma} from '@davomat/db';
export async function queueAccessNotice(telegramId:bigint,status:string,details?:string) {
  await prisma.notification.create({data:{harakat:'ACCESS_NOTICE_PENDING',tafsilot:JSON.stringify({telegramId:String(telegramId),status,details,nextAt:0,attempts:0})}});
}
