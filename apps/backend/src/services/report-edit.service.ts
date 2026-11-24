import {prisma} from '@davomat/db';
import {randomUUID} from 'crypto';
import {attendanceSnapshot,reportEditPlan,reportEditView} from '@davomat/shared';
import {HttpError} from '../http-error';
export async function editReport(id:string,records:{studentId:string;holat:string}[],expectedRevision:string){return prisma.$transaction(async tx=>{
 const session=await tx.attendanceSession.findUnique({where:{id},include:{group:true,teacher:true,records:{include:{student:true}}}});if(!session||session.holat!=='YAKUNLANDI')throw new HttpError(404,'Yakunlangan davomat topilmadi.');
 const source=await tx.notification.findUnique({where:{id:'attendance-report:'+id}}),previous=await tx.notification.findUnique({where:{id:'attendance-edit:'+id}});const data=JSON.parse(source?.tafsilot||'{}'),old=JSON.parse(previous?.tafsilot||'{}');
 if(expectedRevision!==(data.editRevision||old.revision||''))throw new HttpError(409,'Hisobot o‘zgargan. Qayta ochib tahrirlang.');
 if(data.deleteRequested||data._lease?.expiresAt>Date.now()||old._lease?.expiresAt>Date.now()||source?.harakat==='ATTENDANCE_REPORT_PENDING')throw new HttpError(409,'Hisobot yuborish yoki tahrirlash hozir bajarilmoqda. Birozdan keyin qayta urinib ko‘ring.');
 const existing=new Set(session.records.map(r=>r.studentId));if(records.length!==existing.size||new Set(records.map(r=>r.studentId)).size!==records.length||records.some(r=>!existing.has(r.studentId)))throw new HttpError(400,'Faqat ushbu hisobotdagi o‘quvchilar holatini tahrirlang.');
 const changed={...session,records:session.records.map(r=>({...r,holat:records.find(x=>x.studentId===r.studentId)!.holat}))};
 let plan;try{plan=reportEditPlan(changed,data,process.env.ADMIN_CHAT_ID);}catch{throw new HttpError(400,'Matn mavjud Telegram xabarlariga sig‘maydi. Bildirishnomasiz tahrirlash uchun ro‘yxatni qisqartiring.');}
 const revision=randomUUID();for(const holat of ['BOR','YOQ'])await tx.attendanceRecord.updateMany({where:{sessionId:id,studentId:{in:records.filter(r=>r.holat===holat).map(r=>r.studentId)}},data:{holat}});
 const state={sessionId:id,revision,targets:plan.targets,unknownChats:plan.unknownChats,done:{},failed:{},attempts:0,nextAt:0};
 const taskData={harakat:'ATTENDANCE_EDIT_PENDING',kimTomonidan:'8197301287',tafsilot:JSON.stringify(state)};const task=await tx.notification.upsert({where:{id:'attendance-edit:'+id},create:{id:'attendance-edit:'+id,...taskData},update:taskData});
 if(source)await tx.notification.update({where:{id:source.id},data:{tafsilot:JSON.stringify({...data,reportSnapshot:attendanceSnapshot(changed),editRevision:revision})}});
 return {session:changed,correction:reportEditView(task),message:'Davomat saqlandi. Mavjud Telegram xabarlari bildirishnomasiz tahrirlanmoqda.'};
 });}
export async function correctionFor(id:string){return reportEditView(await prisma.notification.findUnique({where:{id:'attendance-edit:'+id}}));}
export async function retryReportEdit(id:string){const row=await prisma.notification.findUnique({where:{id:'attendance-edit:'+id}});if(!row)throw new HttpError(404,'Tahrir vazifasi topilmadi.');const d=JSON.parse(row.tafsilot||'{}');if(d._lease?.expiresAt>Date.now())throw new HttpError(409,'Tahrirlash bajarilmoqda.');if(!await prisma.attendanceSession.findUnique({where:{id}}))throw new HttpError(404,'Hisobot o‘chirilgan.');d.failed={};d.nextAt=0;return reportEditView(await prisma.notification.update({where:{id:row.id},data:{harakat:'ATTENDANCE_EDIT_PENDING',tafsilot:JSON.stringify(d)}}));}
