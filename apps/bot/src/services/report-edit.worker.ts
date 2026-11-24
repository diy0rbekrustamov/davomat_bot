import {bot} from '../bot';
import {prisma,withGithubDatabase} from '@davomat/db';
import {leasedTask,taskIds,telegramCall,retryDelay,queueError} from './queue-runtime';
export async function deliverReportEdit(id:string,api:any=bot.api){await leasedTask(id,['ATTENDANCE_EDIT_PENDING'],async(d,save)=>{
 const exists=await withGithubDatabase(()=>prisma.attendanceSession.findUnique({where:{id:d.sessionId},select:{id:true}}),{readOnly:true,maxAgeMs:1000});
 if(!exists){await save(()=>{},'ATTENDANCE_EDIT_CANCELLED');return;}
 const targets=(d.targets||[]).filter((t:any)=>!d.done?.[t.key]&&!d.failed?.[t.key]).slice(0,5),outcomes:any[]=[];
 for(const target of targets){try{await telegramCall(signal=>target.kind==='caption'?api.editMessageCaption(target.chat,target.id,{caption:target.text},signal):api.editMessageText(target.chat,target.id,target.text,{},signal));outcomes.push({key:target.key,done:true});}catch(error:any){if(error.error_code===400&&/message is not modified/i.test(error.description||''))outcomes.push({key:target.key,done:true});else if(error.error_code===400||error.error_code===403)outcomes.push({key:target.key,failed:error.description||'Telegram tahrirlashga ruxsat bermadi.'});else outcomes.push({key:target.key,retry:retryDelay(error,(d.attempts||0)+1)});}}
 const completed=new Set([...Object.keys(d.done||{}),...outcomes.filter(o=>o.done).map(o=>o.key)]),failed=new Set([...Object.keys(d.failed||{}),...outcomes.filter(o=>o.failed).map(o=>o.key)]);
 const pending=(d.targets||[]).some((t:any)=>!completed.has(t.key)&&!failed.has(t.key));const status=pending?undefined:failed.size||(d.unknownChats||[]).length?'ATTENDANCE_EDIT_PARTIAL':'ATTENDANCE_EDIT_DONE';
 await save(state=>{state.done ||= {};state.failed ||= {};state.attempts=(state.attempts||0)+1;state.nextAt=0;for(const item of outcomes){if(item.done)state.done[item.key]=true;else if(item.failed)state.failed[item.key]=item.failed;else state.nextAt=Math.max(state.nextAt,Date.now()+item.retry);}},status);
 });

}
export function startReportEditWorker(){let running=false;const tick=async()=>{if(running)return;running=true;try{for(const row of await taskIds(['ATTENDANCE_EDIT_PENDING']))try{await deliverReportEdit(row.id);}catch(e){queueError('attendance-edit',e);}}finally{running=false;}};void tick().catch(e=>queueError('attendance-edit-list',e));setInterval(()=>void tick().catch(e=>queueError('attendance-edit-list',e)),5000).unref();}
