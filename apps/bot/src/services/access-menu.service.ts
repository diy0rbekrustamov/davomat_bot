import {telegramCall} from './queue-runtime';
import {prisma,withGithubDatabase} from '@davomat/db';
export async function accessFor(telegramId:number) {
  return withGithubDatabase(async()=>{
    const [admin,teacher]=await Promise.all([
      prisma.admin.findUnique({where:{telegramId:BigInt(telegramId)}}),
      prisma.teacher.findUnique({where:{telegramId:BigInt(telegramId)}}),
    ]);
    return {canAdmin:telegramId===8197301287||!!admin?.faolmi,canTeach:!!teacher?.faolmi && !teacher?.deletedAt};
  });
}
export async function refreshAccessMenu(api:any,telegramId:number) {
  const access=await accessFor(telegramId);
  const menu=access.canAdmin?{type:'web_app',text:'Admin panel',web_app:{url:process.env.ADMIN_WEBAPP_URL||'https://davomat.provveb.uz'}}:
    access.canTeach?{type:'web_app',text:'Davomat',web_app:{url:process.env.TEACHER_WEBAPP_URL||'https://davomat.provveb.uz/teacher'}}:{type:'commands'};
  await telegramCall(signal=>api.setChatMenuButton({chat_id:telegramId,menu_button:menu},signal));
  return access;
}
