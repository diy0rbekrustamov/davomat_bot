import {Request,Response} from 'express';
import {prisma,withGithubDatabase} from '@davomat/db';
import {randomUUID} from 'crypto';
import {githubService} from './github.service';
import {deferResponse} from '../deferred-response';
import {HttpError} from '../http-error';
export async function checkCurrentRole(req:Request){const id=req.telegramUser!.id;if((req as any).userRole==='teacher'||req.path==='/me/photo'){const t=await prisma.teacher.findUnique({where:{telegramId:BigInt(id)}});if(!t?.faolmi||t.deletedAt)throw new HttpError(403,'O‘qituvchi huquqi bekor qilingan.');return;}if(id!==8197301287){const a=await prisma.admin.findUnique({where:{telegramId:BigInt(id)}});if(!a?.faolmi)throw new HttpError(403,'Admin huquqi bekor qilingan.');}}
export function deferTeacherPhoto(req:Request,res:Response,data:any,save:(data:any)=>Promise<unknown>,status=200){if(process.env.GITHUB_PRIMARY!=='1'||typeof data.rasmFileId!=='string'||!data.rasmFileId.startsWith('data:image/'))return false;
const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data.rasmFileId);if(!match||match[2].length>12*1024*1024)throw new HttpError(400,'PNG, JPEG yoki WebP rasm yuboring (8 MB gacha).');const buffer=Buffer.from(match[2],'base64');if(buffer.length>8*1024*1024)throw new HttpError(400,'Rasm 8 MB dan katta.');
deferResponse(res,async()=>{const key='images/teachers/'+randomUUID()+'.'+match[1];await githubService.pushFiles([{path:key,content:buffer,isBinary:true}],'Davomat teacher media');const repo=process.env.GITHUB_REPO||'provveb/database_davomat_byprovveb',branch=process.env.GITHUB_BRANCH||'main';const result=await withGithubDatabase(async()=>{await checkCurrentRole(req);return save({...data,rasmFileId:`https://raw.githubusercontent.com/${repo}/${branch}/${key}`});});res.status(status).json(result);});return true;}
