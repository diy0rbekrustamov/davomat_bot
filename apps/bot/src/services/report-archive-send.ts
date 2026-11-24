import {InputFile} from 'grammy';
import {ReportUnit} from './report-units';
export async function sendArchiveUnit(api:any,chat:string,unit:ReportUnit,replyId:number|undefined,signal:any):Promise<number[]>{
 const file=(value:string)=>value.startsWith('https://')?value:new InputFile(value);
 let result:any;
 if(unit.kind==='album')result=await api.sendMediaGroup(chat,JSON.parse(unit.value).map((item:any)=>({type:'photo',media:file(item.value),...(item.caption?{caption:item.caption}:{})})),{},signal);
 else if(unit.kind==='photo')result=await api.sendPhoto(chat,file(unit.value),{caption:unit.caption},signal);
 else {if(unit.replyToAlbum&&!replyId)throw Error('ARCHIVE_REFERENCE_MISSING');result=await api.sendMessage(chat,unit.value,{...(unit.replyToAlbum?{reply_parameters:{message_id:replyId}}:{})},signal);}
 return (Array.isArray(result)?result:[result]).map(m=>m.message_id);
}
