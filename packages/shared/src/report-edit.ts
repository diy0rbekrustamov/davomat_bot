import {attendanceText,reportUnits} from './report-render';
import {reportMessageRefs,DEVELOPER_CHAT_ID} from './report-deletion';
export type ReportEditTarget={key:string;chat:string;id:number;kind:'caption'|'text';text:string};
export function reportEditPlan(session:any,source:any,adminChat?:string){
 const {refs,unknownChats}=reportMessageRefs(session,source,adminChat),unknown=new Set<string>(unknownChats),targets:ReportEditTarget[]=[];
 if(source.deliveryVersion!==2){for(const chat of Object.keys(refs))unknown.add(chat);if(!unknown.size)unknown.add('UNTRACKED_REPORT');return {targets,unknownChats:[...unknown]};}
 const snapshot=source.reportSnapshot||session;let photos:string[]=[];try{photos=JSON.parse(snapshot.rasmlar||'[]');}catch{}
 for(const [chat,ids] of Object.entries(refs)){
  const parents=chat!==DEVELOPER_CHAT_ID&&chat!==adminChat&&!Object.keys(source.progress||{}).some(k=>k==='admin:'+chat);
  const units=reportUnits(attendanceText(session,parents),photos),desired:{kind:'caption'|'text';text:string}[]=[];
  for(const unit of units){if(unit.kind==='album')for(const media of JSON.parse(unit.value))desired.push({kind:'caption',text:media.caption||''});else desired.push({kind:unit.kind==='text'?'text':'caption',text:unit.kind==='text'?unit.value:unit.caption||''});}
  if(desired.length>ids.length)throw Error('REPORT_EDIT_CAPACITY');
  const oldMediaCount=photos.length;
  for(let i=0;i<ids.length;i++){const item=desired[i]||{kind:(i<oldMediaCount?'caption':'text') as 'caption'|'text',text:i<oldMediaCount?'':'📋 Hisobot yakuni.'};targets.push({key:chat+':'+ids[i],chat,id:ids[i],kind:item.kind,text:item.text});}
 }
 if(!targets.length)unknown.add('UNTRACKED_REPORT');
 return {targets,unknownChats:[...unknown]};
}
export function reportEditView(row:any){if(!row)return null;const d=JSON.parse(row.tafsilot||'{}');return {status:row.harakat,total:d.targets?.length||0,done:Object.keys(d.done||{}).length,failed:Object.keys(d.failed||{}).length,unknown:d.unknownChats?.length||0,revision:d.revision};}
