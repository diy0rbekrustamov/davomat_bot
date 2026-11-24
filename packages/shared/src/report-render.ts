export function attendanceText(session:any,parents=false):string {
 const records=session.records||[];
 const present=records.filter((r:any)=>r.holat==='BOR').length;
 const absent=records.filter((r:any)=>r.holat==='YOQ');
 const date=(v:any)=>new Date(v).toLocaleDateString('uz-UZ',{timeZone:'Asia/Tashkent'});
 const time=(v:any)=>v?new Date(v).toLocaleTimeString('uz-UZ',{timeZone:'Asia/Tashkent',hour:'2-digit',minute:'2-digit'}):'—';
 return `📅 Sana: ${date(session.sana)}\n⏰ Vaqt: ${time(session.boshlanganVaqt)} – ${time(session.yakunlanganVaqt)}\n\n👥 Guruh: ${session.group.nomi}\n👤 Sinf rahbari: ${session.group.sinfRahbariIsmi}\n📚 Fan: ${session.fanNomi}\n👨‍🏫 O'qituvchi: ${session.teacher.ismFamiliya}\n\n📊 Statistika:\nJami: ${records.length} ta\nKeldi: ${present} ta\nYo'q: ${absent.length} ta\n${parents?'':`Davomat: ${records.length?Math.round(present/records.length*100):0}%\n`}\n❌ ${parents?"Darsda yo'qlar":"Yo'q bo'lganlar"}:\n${absent.length?absent.map((r:any,i:number)=>`${i+1}. ${r.student.ismFamiliya}`).join('\n'):'Barcha qatnashyapti 💯'}`;
}
export function textChunks(text:string,limit=3500):string[] {
 const result:string[]=[];
 while(text.length>limit){let end=text.lastIndexOf('\n',limit);if(end<limit/2)end=limit;if(/[\uD800-\uDBFF]/.test(text[end-1]))end--;result.push(text.slice(0,end));text=text.slice(end).replace(/^\n/,'');}
 if(text)result.push(text);return result;
}


export type ReportUnit = {kind:'text'|'photo'|'album';value:string;caption?:string;replyToAlbum?:boolean};
// Photo captions are limited to 1024 UTF-16 code units conservatively. Remaining
// chunks go on the other album photos; an exceptionally long report replies to it.
export function reportUnits(text:string,photos:string[]):ReportUnit[] {
  if(!photos.length)return textChunks(text).map(value=>({kind:'text',value}));
  const captions=text.length<=1024?[text]:textChunks(text,960),shown=captions.slice(0,photos.length);
  const media=photos.slice(0,10).map((value,index)=>({value,...(shown[index]?{caption:(index?'📋 Hisobot davomi ('+(index+1)+'/'+captions.length+')\n':'')+shown[index]}:{})}));
  const units:ReportUnit[]=media.length>1?[{kind:'album',value:JSON.stringify(media)}]:[{kind:'photo',value:media[0].value,caption:media[0].caption}];
  const extra=captions.slice(media.length).join('\n');
  if(extra)for(const value of textChunks(extra,3400))units.push({kind:'text',value:'📋 Hisobot davomi\n'+value,replyToAlbum:true});
  return units;
}
