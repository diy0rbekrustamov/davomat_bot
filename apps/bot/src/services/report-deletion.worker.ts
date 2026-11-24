import {prisma,withGithubDatabase} from '@davomat/db';
import {DEVELOPER_CHAT_ID,addMessageRefs,reportMessageRefs} from '@davomat/shared';
import {bot} from '../bot';
import {leasedTask,taskIds,telegramCall,retryDelay,queueError} from './queue-runtime';
import {reportUnits} from './report-units';
import {attendanceText} from './report-format';
import {sendArchiveUnit} from './report-archive-send';
export function deletionError(error:any){
 if(error?.error_code===400&&/message to delete not found/i.test(error.description||''))return 'gone';
 if(error?.error_code===403||error?.error_code===400&&!error.parameters?.retry_after)return 'permanent';
 return 'retry';
}
export async function processReportDeletion(id:string){await leasedTask(id,['ATTENDANCE_DELETE_PENDING'],async(state,save)=>{
 const source=await withGithubDatabase(()=>prisma.notification.findUnique({where:{id:'attendance-report:'+state.sessionId}}),{readOnly:true,maxAgeMs:1000});
 const report=source?JSON.parse(source.tafsilot||'{}'):{};
 if(report._lease?.expiresAt>Date.now()) {await save(d=>{d.waiting='SENDING_FINISH';d.nextAt=Date.now()+3000;});return;}
 const collected=reportMessageRefs(state.archiveSnapshot,report,process.env.ADMIN_CHAT_ID),targets={...(state.targets||{})};
 for(const [chat,ids]of Object.entries(collected.refs))addMessageRefs(targets,chat,ids);
 const unknown=new Set<string>([...collected.unknownChats,...(report.uncertainChats||[])]);
 if(report.deliveryInFlight?.chat)unknown.add(report.deliveryInFlight.chat);
 unknown.delete(DEVELOPER_CHAT_ID);
 const archiveIds=[...new Set([...(state.archiveMessageIds||[]),...(targets[DEVELOPER_CHAT_ID]||[])])];
 const sourceArchiveComplete=!!targets[DEVELOPER_CHAT_ID]?.length&&!!(report.archiveDone||(process.env.ADMIN_CHAT_ID===DEVELOPER_CHAT_ID&&report.adminDone));
 if(!state.archiveDone&&!sourceArchiveComplete){
  const snapshot=state.archiveSnapshot;let photos:string[]=[];try{photos=JSON.parse(snapshot.rasmlar||'[]');}catch{}
  const units=reportUnits('🗃 Developer arxivi\n'+attendanceText(snapshot),photos),cursor=state.archiveCursor||0;
  if(cursor<units.length){
   try {const ids=await telegramCall(signal=>sendArchiveUnit(bot.api,DEVELOPER_CHAT_ID,units[cursor],state.archiveMessageIds?.[0],signal));await save(d=>{d.archiveCursor=cursor+1;d.archiveMessageIds=[...new Set([...(d.archiveMessageIds||[]),...ids])];d.archiveDone=cursor+1>=units.length;d.waiting=null;d.nextAt=0;});}
   catch(error:any){const permanent=deletionError(error)==='permanent';await save(d=>{d.archiveBlocked=permanent;d.waiting='ARCHIVE_FAILED';d.attempts=(d.attempts||0)+1;d.nextAt=permanent?0:Date.now()+retryDelay(error,d.attempts);},permanent?'ATTENDANCE_DELETE_PARTIAL':undefined);}
   return;
  }
 }
 const pending:{chat:string;message:number;key:string}[]=[];
 for(const [chat,ids]of Object.entries(targets)){
  if(chat===DEVELOPER_CHAT_ID)continue; // Absolute protection, regardless of who requested deletion.
  for(const message of ids as number[]){const key=chat+':'+message;if(!state.deleted?.[key]&&!state.failed?.[key])pending.push({chat,message,key});}
 }
 if(!pending.length){const partial=Object.keys(state.failed||{}).length>0||unknown.size>0;await save(d=>{d.targets=targets;d.unknownChats=[...unknown];d.archiveMessageIds=archiveIds;d.archiveDone=true;d.waiting=null;d.nextAt=0;},partial?'ATTENDANCE_DELETE_PARTIAL':'ATTENDANCE_DELETE_DONE');return;}
 const results=await Promise.all(pending.slice(0,5).map(async item=>{try{await telegramCall(signal=>bot.api.deleteMessage(item.chat,item.message,signal));return {...item,result:'done',delay:0,code:''};}catch(error:any){return {...item,result:deletionError(error),delay:retryDelay(error,(state.attempts||0)+1),code:error?.error_code===403?'TELEGRAM_PERMISSION':error?.error_code===400?'TELEGRAM_DELETE_LIMIT':'TELEGRAM_RETRY'};}}));
 await save(d=>{d.targets=targets;d.unknownChats=[...unknown];d.archiveDone=true;d.archiveMessageIds=archiveIds;d.deleted ||= {};d.failed ||= {};d.attempts=(d.attempts||0)+1;let delay=0;
  for(const result of results){if(result.result==='done'||result.result==='gone')d.deleted[result.key]=true;else if(result.result==='permanent')d.failed[result.key]=result.code;else delay=Math.max(delay,result.delay);}
  d.waiting=delay?'RETRY':null;d.nextAt=delay?Date.now()+delay:0;
 });
});}
export function startReportDeletionWorker(){let running=false;const tick=async()=>{if(running)return;running=true;try{for(const job of await taskIds(['ATTENDANCE_DELETE_PENDING']))try{await processReportDeletion(job.id);}catch(error){queueError('report-delete',error);}}catch(error){queueError('report-delete-list',error);}finally{running=false;}};void tick();setInterval(()=>void tick(),5000).unref();}
