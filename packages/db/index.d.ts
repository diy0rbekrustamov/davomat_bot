import {PrismaClient} from '@prisma/client';
export const prisma:PrismaClient;
export * from '@prisma/client';

export function withGithubDatabase<T>(work:()=>Promise<T>,options?:{readOnly?:boolean;maxAgeMs?:number}):Promise<T>;
export function storageHealth():Promise<boolean>;
export function githubPrimary():boolean;

export function afterGithubCommit(task:()=>Promise<unknown>):void;

export function storageStatus():Promise<{ok:boolean;storage:string;code?:string;operationId?:string;lastSuccess?:number|null}>;
export function inGithubDatabase():boolean;

export function drainGithubDatabase():Promise<unknown>;
