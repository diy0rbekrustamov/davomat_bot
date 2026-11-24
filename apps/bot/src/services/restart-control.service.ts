import http from 'node:http';
import fs from 'node:fs/promises';
export const RESTART_BUTTON='🔄 Davomatni qayta ishga tushirish';
export const RESTART_CONFIRM='✅ Ha, Davomatni restart qilish';
export const RESTART_CANCEL='❌ Restartni bekor qilish';
export const RESTART_DEVELOPER=8197301287;
export async function requestDavomatRestart(requestId:string):Promise<void>{
 const root=process.env.DAVOMAT_CONTROL_DIR||'/run/davomat-control';
 const token=(await fs.readFile(root+'/token','utf8')).trim();
 const payload=JSON.stringify({telegramId:RESTART_DEVELOPER,requestId});
 await new Promise<void>((resolve,reject)=>{const req=http.request({socketPath:root+'/control.sock',path:'/restart',method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},res=>{let bytes=0;const chunks:Buffer[]=[];res.on('data',chunk=>{bytes+=chunk.length;if(bytes>4096){req.destroy(Error('CONTROL_RESPONSE_TOO_LARGE'));return;}chunks.push(chunk);});res.on('end',()=>{if(res.statusCode===202){resolve();return;}const e=Object.assign(Error(res.statusCode===409?'RESTART_BUSY':'RESTART_UNAVAILABLE'),{code:res.statusCode===409?'RESTART_BUSY':'RESTART_UNAVAILABLE'});reject(e);});});req.setTimeout(5000,()=>req.destroy(Error('CONTROL_TIMEOUT')));req.on('error',reject);req.end(payload);});
}
