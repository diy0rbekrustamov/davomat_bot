import {Context} from 'grammy';
import {prisma} from '@davomat/db';
import {teacherGroupsEnabled,setTeacherGroupsEnabled} from '@davomat/shared';
import {keyboardFor} from './group.handler';
export const GROUP_POLICY_BUTTON='🔐 O‘qituvchi guruh huquqlari';
export const GROUP_POLICY_LOCK='🔒 Guruh boshqaruvini yopish';
export const GROUP_POLICY_OPEN='🔓 Guruh boshqaruvini ochish';
export async function groupPolicyHandler(ctx:Context){if(ctx.chat?.type!=='private'||!ctx.from)return;const id=ctx.from.id;if(id!==8197301287){const admin=await prisma.admin.findUnique({where:{telegramId:BigInt(id)}});if(!admin?.faolmi)return;}
 if(ctx.message?.text===GROUP_POLICY_LOCK)await setTeacherGroupsEnabled(prisma,false,String(id));
 if(ctx.message?.text===GROUP_POLICY_OPEN)await setTeacherGroupsEnabled(prisma,true,String(id));
 const enabled=await teacherGroupsEnabled(prisma),keyboard=keyboardFor(id,undefined,true);
 return ctx.reply(enabled?'O‘qituvchilarga guruh qo‘shish va tahrirlash ochiq.':'O‘qituvchilarga guruh qo‘shish, tahrirlash va arxivlash yopilgan. Adminlar boshqarishi mumkin.',{reply_markup:{...keyboard,keyboard:[...keyboard.keyboard,[{text:enabled?GROUP_POLICY_LOCK:GROUP_POLICY_OPEN}]]}});
}
