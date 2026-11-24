import {prisma, Group} from '@davomat/db';
import {QrService} from './qr.service';
import {v4 as uuidv4} from 'uuid';
import {HttpError} from '../http-error';
import {byName} from './name-order';
import {queueAccessNotice} from './access-notice.service';
interface GroupInput {nomi?:string;kurs?:number;teacherId?:string|null;telegramChatId?:string|null;telegramChatIds?:string[];}
function registeredBy(raw:string,id:string){try{const ids=JSON.parse(raw);return Array.isArray(ids)&&ids.includes(id);}catch{return false;}}
function viewGroup<T extends {telegramChatId:string|null;telegramChatIds:string}>(g:T) {
 let ids:string[]=[];try{const raw=JSON.parse(g.telegramChatIds);if(Array.isArray(raw))ids=raw.filter((id:unknown)=>typeof id==='string');}catch{}
 return {...g,telegramChatIds:[...new Set(ids.length?ids:g.telegramChatId?[g.telegramChatId]:[])]};
}
export class GroupService {
 private async selectedTeacher(id?:string|null,retainedId?:string|null) {
  if(!id)throw new HttpError(400,"Bazadagi guruh rahbarini tanlang.");
  const teacher=await prisma.teacher.findUnique({where:{id}});
  if(!teacher || ((!teacher.faolmi || teacher.deletedAt) && id!==retainedId))throw new HttpError(400,"Tanlangan o'qituvchi topilmadi yoki faol emas.");
  return {teacherId:teacher.id,sinfRahbariIsmi:teacher.ismFamiliya,sinfRahbariTelefon:teacher.telefon};
 }
 private async selectedChat(id?:string|null,owner?:string,retained:string[]=[]) {
  if(!id)return null;
  const chat=await prisma.telegramChat.findUnique({where:{chatId:id}});
  if(!chat?.active)throw new HttpError(400,"Telegram guruhini botdagi Guruh qo'shish tugmasi orqali ulang va ro'yxatni yangilang.");
  if(owner&&!registeredBy(chat.addedByTelegramIds,owner)&&!retained.includes(id))throw new HttpError(403,"Faqat o'zingiz bot orqali qo'shgan ota-onalar guruhini biriktirishingiz mumkin.");
  return chat.chatId;
 }
 async assertAccess(id:string,teacherId?:string) {
  const group=await prisma.group.findFirst({where:{id,faolmi:true,...(teacherId?{teacherId}:{})}});
  if(!group)throw new HttpError(404,'Guruh topilmadi yoki sizga biriktirilmagan.');
  return group;
 }
 private async selectedChats(data:GroupInput,teacherId?:string,retained:string[]=[]) {
  const ids=[...new Set(data.telegramChatIds ?? (data.telegramChatId?[data.telegramChatId]:[]))];
  const owner=teacherId?(await prisma.teacher.findUnique({where:{id:teacherId}}))?.telegramId.toString():undefined;
  if(teacherId&&!owner)throw new HttpError(403,"O'qituvchi topilmadi.");
  for(const id of ids)await this.selectedChat(id,owner,retained);
  return {telegramChatId:ids[0]||null,telegramChatIds:JSON.stringify(ids)};
 }
 async createGroup(data:GroupInput,teacherId?:string) {
  const leader=await this.selectedTeacher(teacherId||data.teacherId);
  const chats=await this.selectedChats(data,teacherId);
  const qrToken=uuidv4();const qrCodeImageUrl=await QrService.generateAndSaveQr(qrToken);
  const group=await prisma.group.create({data:{nomi:data.nomi!,kurs:data.kurs||1,...leader,...chats,qrToken,qrCodeImageUrl}});
  const teacher=await prisma.teacher.findUnique({where:{id:leader.teacherId}});
  if(teacher)await queueAccessNotice(teacher.telegramId,'leader_assigned',group.nomi);
  return viewGroup(group);
 }
 async getAllGroups(teacherId?:string) {
  const groups=await prisma.group.findMany({where:{faolmi:true,...(teacherId?{teacherId}:{})},include:{_count:{select:{students:true}},teacher:true}});
  return byName(groups,g=>g.nomi,g=>g.id).sort((a,b)=>a.kurs-b.kurs).map(viewGroup);
 }
 async getGroupById(id:string,teacherId?:string) {
  const group=await prisma.group.findFirst({where:{id,faolmi:true,...(teacherId?{teacherId}:{})},include:{students:{orderBy:{ismFamiliya:'asc'}},teacher:true}});
  return group?viewGroup(group):null;
 }
 async updateGroup(id:string,data:GroupInput,teacherId?:string) {
  const current=await this.assertAccess(id,teacherId);
  const leader=await this.selectedTeacher(teacherId||data.teacherId||current.teacherId,current.teacherId);
  const chat=data.telegramChatId===undefined&&data.telegramChatIds===undefined?{}:await this.selectedChats(data,teacherId,viewGroup(current).telegramChatIds);
  const group=await prisma.group.update({where:{id},data:{...(data.nomi!==undefined?{nomi:data.nomi}:{}),...(data.kurs!==undefined?{kurs:data.kurs}:{}),...leader,...chat}});
  if(current.teacherId!==leader.teacherId){
    if(current.teacherId){const old=await prisma.teacher.findUnique({where:{id:current.teacherId}});if(old)await queueAccessNotice(old.telegramId,'leader_removed',group.nomi);}
    const next=await prisma.teacher.findUnique({where:{id:leader.teacherId}});if(next)await queueAccessNotice(next.telegramId,'leader_assigned',group.nomi);
  }
  return viewGroup(group);
 }
 async archiveGroup(id:string,teacherId?:string):Promise<Group> {
  const group=await this.assertAccess(id,teacherId);const archived=await prisma.group.update({where:{id},data:{faolmi:false}});
  if(group.teacherId){const t=await prisma.teacher.findUnique({where:{id:group.teacherId}});if(t)await queueAccessNotice(t.telegramId,'group_archived',group.nomi);}
  return archived;
 }
 async getTelegramChats(telegramId?:string) {
  const chats=await prisma.telegramChat.findMany({where:{active:true}});
  return byName(telegramId?chats.filter(c=>registeredBy(c.addedByTelegramIds,telegramId)):chats,c=>c.title,c=>c.chatId).map(({addedByTelegramIds,...chat})=>chat);
 }
}
