import {DEVELOPER_CHAT_ID,addMessageRefs,attendanceSnapshot} from '@davomat/shared';
import {reportUnits,ReportUnit} from './report-units';
import {prisma,withGithubDatabase} from '@davomat/db';
import {bot} from '../bot';
import {InputFile} from 'grammy';
import {attendanceText,textChunks} from './report-format';
import {leasedTask,taskIds,telegramCall,retryDelay,recipientUnavailable,queueError} from './queue-runtime';
class NotifyService {
 async sendAttendanceReport(sessionId:string){await withGithubDatabase(async()=>{
  const session=await prisma.attendanceSession.findUnique({where:{id:sessionId},include:{group:true,teacher:true,records:{include:{student:true}}}});
  if(!session)throw Error('Attendance session not found');
  await prisma.notification.upsert({where:{id:'attendance-report:'+sessionId},create:{id:'attendance-report:'+sessionId,harakat:'ATTENDANCE_REPORT_PENDING',tafsilot:JSON.stringify({sessionId,deliveryVersion:2,developerArchive:true,trackingVersion:1,messages:{},reportSnapshot:attendanceSnapshot(session),adminDone:false,parentsDone:false,attempts:0,nextAt:0})},update:{}});
 });}
 async deliver(id:string){await leasedTask(id,['ATTENDANCE_REPORT_PENDING'],async(state,save,prepare)=>{
  const live=await withGithubDatabase(()=>prisma.attendanceSession.findUnique({where:{id:state.sessionId},include:{group:true,teacher:true,records:{include:{student:true}}}}));
  if(!live){await save(()=>{},'ATTENDANCE_REPORT_CANCELLED');return;}
  const session=state.deliveryVersion===2&&state.reportSnapshot?{...live,...state.reportSnapshot,group:{...live.group,...state.reportSnapshot.group,telegramChatIds:live.group.telegramChatIds,telegramChatId:live.group.telegramChatId}}:live;
  let photos:string[]=[];try{photos=JSON.parse(session.rasmlar||'[]');if(!Array.isArray(photos))photos=[];}catch{}
  let targets:string[]=[];try{const raw=JSON.parse(session.group.telegramChatIds);if(Array.isArray(raw))targets=raw.filter((x:unknown)=>typeof x==='string');}catch{}
  if(!targets.length&&session.group.telegramChatId)targets=[session.group.telegramChatId];targets=[...new Set(targets)];
  const candidates:{chat:string;admin:boolean;archive?:boolean}[]=[...(state.developerArchive?[{chat:DEVELOPER_CHAT_ID,admin:true,archive:true}]:[]),...(process.env.ADMIN_CHAT_ID?[{chat:process.env.ADMIN_CHAT_ID,admin:true}]:[]),...targets.map(chat=>({chat,admin:false}))];
  const deliveries=candidates.filter((target,index)=>candidates.findIndex(item=>item.chat===target.chat)===index);
  state.parentDelivered ||= [];state.progress ||= {};state.failedTargets ||= [];
  for(const target of deliveries){const key=(target.archive?'archive:':target.admin?'admin:':'parent:')+target.chat;if((target.archive&&state.archiveDone)||(!target.archive&&target.admin&&state.adminDone)||(!target.admin&&(state.parentsDone||state.parentDelivered.includes(target.chat)))||state.failedTargets.includes(key))continue;
   const chunks=textChunks(attendanceText(session,!target.admin)),cursor=state.progress[key]||0;
   const units:ReportUnit[]=state.deliveryVersion===2?reportUnits(attendanceText(session,!target.admin),photos):[...chunks.map(text=>({kind:'text' as const,value:text})),...(photos.length>1?[{kind:'album' as const,value:JSON.stringify(photos.slice(0,10))}]:photos.map(value=>({kind:'photo' as const,value})))];
   if(cursor>=units.length){await save(d=>{if(target.archive)d.archiveDone=true;else if(target.admin)d.adminDone=true;else{d.parentDelivered ||= [];if(!d.parentDelivered.includes(target.chat))d.parentDelivered.push(target.chat);}});return;}
   const unit=units[cursor];let messageIds:number[];
   if(!await prepare(d=>{d.deliveryInFlight={chat:target.chat,key,at:Date.now()};}))return;
   try{
    const replyId=state.albumMessageIds?.[key]?.[0];
    if(unit.replyToAlbum&&!replyId)throw Error('REPORT_ALBUM_REFERENCE_MISSING');
    const response:any=await telegramCall<any>(signal=>{
     if(unit.kind==='album')return bot.api.sendMediaGroup(target.chat,JSON.parse(unit.value).map((item:any)=>{const value=typeof item==='string'?item:item.value;return {type:'photo' as const,media:value.startsWith('https://')?value:new InputFile(value),...(typeof item==='object'&&item.caption?{caption:item.caption}:{})};}),{},signal);
     if(unit.kind==='photo')return bot.api.sendPhoto(target.chat,unit.value.startsWith('https://')?unit.value:new InputFile(unit.value),{...(unit.caption?{caption:unit.caption}:{})},signal);
     return bot.api.sendMessage(target.chat,unit.value,{...(unit.replyToAlbum&&replyId?{reply_parameters:{message_id:replyId}}:{})},signal);
    });
    messageIds=(Array.isArray(response)?response:[response]).map((m:any)=>m.message_id);
   }
   catch(error:any){await save(d=>{if(!error.error_code||error.error_code>=500){d.uncertainChats ||= [];if(!d.uncertainChats.includes(target.chat))d.uncertainChats.push(target.chat);}delete d.deliveryInFlight;d.attempts=(d.attempts||0)+1;d.lastError=error.error_code||'network';d.nextAt=Date.now()+retryDelay(error,d.attempts);if(recipientUnavailable(error)){d.failedTargets ||= [];d.failedTargets.push(key);d.nextAt=0;}},undefined);return;}
   // Progress commit is outside the Telegram catch: a storage failure is not a send failure.
   await save(async d=>{d.messages ||= {};addMessageRefs(d.messages,target.chat,messageIds);delete d.deliveryInFlight;
    if(d.deleteRequested){const deletion=await prisma.notification.findUnique({where:{id:'attendance-delete:'+session.id}});if(deletion){const payload=JSON.parse(deletion.tafsilot||'{}');payload.targets ||= {};addMessageRefs(payload.targets,target.chat,messageIds);payload.nextAt=0;await prisma.notification.update({where:{id:deletion.id},data:{harakat:'ATTENDANCE_DELETE_PENDING',tafsilot:JSON.stringify(payload)}});}}
    d.progress ||= {};d.progress[key]=cursor+1;d.nextAt=0;if(state.deliveryVersion===2&&(unit.kind==='album'||unit.kind==='photo')){d.albumMessageIds ||= {};d.albumMessageIds[key]=messageIds;}if(state.deliveryVersion===2&&cursor+1>=units.length){if(target.archive)d.archiveDone=true;else if(target.admin)d.adminDone=true;else{d.parentDelivered ||= [];if(!d.parentDelivered.includes(target.chat))d.parentDelivered.push(target.chat);}}if(target.admin&&target.chat===process.env.ADMIN_CHAT_ID){const current=await prisma.attendanceSession.findUnique({where:{id:session.id}});if(current){let ids:number[]=[];try{ids=JSON.parse(current.telegramMessageIds||'[]');}catch{}await prisma.attendanceSession.update({where:{id:session.id},data:{telegramMessageIds:JSON.stringify([...new Set([...ids,...messageIds])])}});}}});
   return;
  }
  await save(d=>{d.parentsDone=true;d.adminDone=true;},state.failedTargets.length?'ATTENDANCE_REPORT_PARTIAL':'ATTENDANCE_REPORT_DELIVERED');
 });}
 startWorker(){let running=false;const tick=async()=>{if(running)return;running=true;try{for(const task of await taskIds(['ATTENDANCE_REPORT_PENDING']))try{await this.deliver(task.id);}catch(e){queueError('attendance',e);}}catch(e){queueError('attendance-list',e);}finally{running=false;}};void tick();setInterval(()=>void tick(),5000).unref();}
}
export default new NotifyService();
