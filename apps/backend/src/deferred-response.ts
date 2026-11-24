import {Response} from 'express';
export function deferResponse(res:Response,work:()=>Promise<void>){res.locals.afterStorageCommit=work;res.end();}
