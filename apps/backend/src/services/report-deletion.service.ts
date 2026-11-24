import {prisma} from '@davomat/db';
import {DEVELOPER_CHAT_ID,reportMessageRefs,deletionView} from '@davomat/shared';
import {HttpError} from '../http-error';
const jobId=(id:string)=>'attendance-delete:'+id;
export async function requestReportDeletion(id:string,actor:string){
 return prisma.$transaction(async tx=>{
  const previous=await tx.notification.findUnique({where:{id:jobId(id)}});
  if(previous)return deletionView(previous);
  const session=await tx.attendanceSession.findUnique({where:{id},include:{group:true,teacher:true,records:{include:{student:true}}}});
  if(!session)throw new HttpError(404,'Hisobot topilmadi.');
  const editTask=await tx.notification.findUnique({where:{id:'attendance-edit:'+id}});
  if(editTask){const edit=JSON.parse(editTask.tafsilot||'{}');if(edit._lease?.expiresAt>Date.now())throw new HttpError(409,'Hisobot tahrirlanmoqda. Birozdan keyin o‘chiring.');await tx.notification.update({where:{id:editTask.id},data:{harakat:'ATTENDANCE_EDIT_CANCELLED'}});}
  const source=await tx.notification.findUnique({where:{id:'attendance-report:'+id}});
  const report=source?JSON.parse(source.tafsilot||'{}'):{};
  const {refs,unknownChats}=reportMessageRefs(session,report,process.env.ADMIN_CHAT_ID);
  const archiveSnapshot=JSON.parse(JSON.stringify(session,(_k,v)=>typeof v==='bigint'?String(v):v));
  const archiveComplete=!!refs[DEVELOPER_CHAT_ID]?.length&&!!(report.archiveDone||(process.env.ADMIN_CHAT_ID===DEVELOPER_CHAT_ID&&report.adminDone));
  const state={sessionId:id,groupName:session.group.nomi,requestedBy:actor,requestedAt:Date.now(),
   targets:refs,unknownChats,archiveSnapshot,archiveDone:archiveComplete,archiveMessageIds:archiveComplete?refs[DEVELOPER_CHAT_ID]:[],
   archiveCursor:0,deleted:{},failed:{},attempts:0,nextAt:0};
  const task=await tx.notification.create({data:{id:jobId(id),kimTomonidan:actor,harakat:'ATTENDANCE_DELETE_PENDING',tafsilot:JSON.stringify(state)}});
  if(source)await tx.notification.update({where:{id:source.id},data:{harakat:'ATTENDANCE_REPORT_CANCELLED',tafsilot:JSON.stringify({...report,deleteRequested:true})}});
  await tx.attendanceSession.delete({where:{id}});
  return deletionView(task);
 });
}
export async function deletionList(){return (await prisma.notification.findMany({where:{harakat:{startsWith:'ATTENDANCE_DELETE_'}},orderBy:{vaqt:'desc'},take:30})).map(deletionView);}
export async function deletionArchive(id:string){const task=await prisma.notification.findUnique({where:{id:jobId(id)}});if(!task)throw new HttpError(404,'Arxiv topilmadi.');return {...JSON.parse(task.tafsilot||'{}').archiveSnapshot,deletedArchive:true};}
export async function retryDeletion(id:string){
 const task=await prisma.notification.findUnique({where:{id:jobId(id)}});if(!task)throw new HttpError(404,'O‘chirish vazifasi topilmadi.');
 const state=JSON.parse(task.tafsilot||'{}');if(state._lease?.expiresAt>Date.now())throw new HttpError(409,'O‘chirish hozir bajarilmoqda.');
 state.failed={};state.nextAt=0;state.waiting=null;delete state.archiveBlocked;
 const updated=await prisma.notification.update({where:{id:task.id},data:{harakat:'ATTENDANCE_DELETE_PENDING',tafsilot:JSON.stringify(state)}});return deletionView(updated);
}
