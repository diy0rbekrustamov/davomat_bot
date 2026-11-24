const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{AsyncLocalStorage}=require('node:async_hooks');
const context=new AsyncLocalStorage();let tail=Promise.resolve();
const enabled=()=>process.env.GITHUB_PRIMARY==='1',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const blobSha=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');
class StorageError extends Error{constructor(code,operationId){super(code);this.name='StorageError';this.code=code;this.status=503;this.operationId=operationId;}}
function settings(){if(!process.env.GITHUB_PAT)throw new StorageError('STORAGE_CREDENTIAL_MISSING');return {repo:process.env.GITHUB_REPO||'provveb/database_davomat_byprovveb',branch:process.env.GITHUB_BRANCH||'main',root:process.env.GITHUB_RAM_DIR||'/ram',state:process.env.GITHUB_STATE_DIR||'/state',file:'dev.db'};}
async function atomic(file,bytes){await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.'+crypto.randomUUID()+'.tmp',fd=await fs.open(temp,'wx',0o600);try{await fd.writeFile(bytes);await fd.sync();}finally{await fd.close();}await fs.rename(temp,file);if(process.platform!=='win32'){const d=await fs.open(path.dirname(file),'r');try{await d.sync();}finally{await d.close();}}}
async function json(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function api(route,method='GET',body,options={}){const s=settings();for(let attempt=0;;attempt++){try{const r=await fetch(`https://api.github.com/repos/${s.repo}/${route}`,{method,headers:{Authorization:'Bearer '+process.env.GITHUB_PAT,Accept:'application/vnd.github+json','Content-Type':'application/json','Cache-Control':'no-cache','X-GitHub-Api-Version':'2022-11-28',...(options.etag?{'If-None-Match':options.etag}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(Number(process.env.GITHUB_TIMEOUT_MS||10000))});if(r.status===304&&options.meta&&options.etag){await r.body?.cancel();return {notModified:true,etag:r.headers.get('etag')||options.etag};}if(!r.ok){const rate=r.status===429||(r.status===403&&r.headers.get('x-ratelimit-remaining')==='0');const e=new StorageError(rate?'STORAGE_RATE_LIMIT':({401:'STORAGE_AUTH',403:'STORAGE_FORBIDDEN',404:'STORAGE_NOT_FOUND',409:'STORAGE_CONFLICT',422:'STORAGE_VALIDATION'}[r.status]||'STORAGE_REMOTE_ERROR'));e.remoteStatus=r.status;e.retryAfter=Number(r.headers.get('retry-after')||0);await r.body?.cancel();throw e;}const value=await r.json();return options.meta?{value,etag:r.headers.get('etag')||undefined}:value;}catch(e){const err=e instanceof StorageError?e:new StorageError('STORAGE_NETWORK');if(method!=='GET'||attempt>=2||(err.remoteStatus&&err.remoteStatus<500&&err.code!=='STORAGE_RATE_LIMIT')||err.retryAfter>2)throw err;await sleep(Math.max(err.retryAfter*1000||0,100*2**attempt));}}}
const sourceKey=s=>JSON.stringify([s.repo,s.branch,s.file]);
async function readRemote(known){
 const s=settings(),result=await api(`contents/${s.file}?ref=${encodeURIComponent(s.branch)}`,'GET',undefined,{meta:true,etag:known?.etag});
 if(result.notModified){if(!known)throw new StorageError('STORAGE_INVALID_CACHE');return {...known,etag:result.etag,verifiedAt:Date.now()};}
 const d=result.value;
 const bytes=known?.sha===d.sha?known.bytes:d.content?Buffer.from(d.content,'base64'):Buffer.from((await api('git/blobs/'+d.sha)).content,'base64');
 if(bytes.subarray(0,16).toString()!=='SQLite format 3\0'||blobSha(bytes)!==d.sha)throw new StorageError('STORAGE_INVALID_DATABASE');
 return {bytes,sha:d.sha,etag:result.etag,verifiedAt:Date.now()};
}
async function acquireDirectory(root){await fs.mkdir(root,{recursive:true});const lock=path.join(root,'database-lock'),token=crypto.randomUUID(),deadline=Date.now()+Number(process.env.GITHUB_LOCK_WAIT_MS||30000);while(true){try{await fs.mkdir(lock);try{await fs.writeFile(path.join(lock,'pid'),String(process.pid));await fs.writeFile(path.join(lock,'token'),token);}catch(e){await fs.rm(lock,{recursive:true,force:true});throw e;}return async()=>{if(await fs.readFile(path.join(lock,'token'),'utf8').catch(()=>null)===token)await fs.rm(lock,{recursive:true,force:true});};}catch(e){if(e.code!=='EEXIST')throw e;const pid=Number(await fs.readFile(path.join(lock,'pid'),'utf8').catch(()=>''));if(pid>0){try{process.kill(pid,0);}catch(err){if(err.code==='ESRCH'){if(Number(await fs.readFile(path.join(lock,'pid'),'utf8').catch(()=>''))===pid)await fs.rm(lock,{recursive:true,force:true});continue;}}}if(Date.now()>deadline)throw new StorageError('STORAGE_BUSY');await sleep(50);}}}
async function acquire(root){
 if(process.platform==='win32')return acquireDirectory(root);
 await fs.mkdir(root,{recursive:true,mode:0o700});
 const {spawn}=require('node:child_process');
 return new Promise((resolve,reject)=>{
  const child=spawn('flock',['-x','-w',String(Number(process.env.GITHUB_LOCK_WAIT_MS||30000)/1000),path.join(root,'database.lock'),'sh','-c','printf "LOCKED\n"; cat >/dev/null'],{stdio:['pipe','pipe','pipe']});
  let acquired=false,output='';let exited;const done=new Promise(r=>exited=r);
  child.on('error',()=>{exited();reject(new StorageError('STORAGE_LOCK_UNAVAILABLE'));});
  child.on('exit',code=>{exited();if(!acquired)reject(new StorageError('STORAGE_BUSY'));});
  child.stdout.on('data',chunk=>{output+=chunk;if(!acquired&&output.includes('LOCKED')){acquired=true;resolve(async()=>{child.stdin.end();await done;});}});
 });
}
async function disconnect(p){const timer=setTimeout(()=>{console.error('DAVOMAT_DIAG',JSON.stringify({code:'STORAGE_DISCONNECT_STALLED'}));process.exit(70);},Number(process.env.GITHUB_DISCONNECT_MS||20000));timer.unref();try{await p.$disconnect();}finally{clearTimeout(timer);}}
async function markHealth(s,v){await atomic(path.join(s.state,'health.json'),JSON.stringify({...v,at:Date.now()}));}
async function clearPending(s,keep=false){const p=await json(path.join(s.state,'pending.json'));await fs.unlink(path.join(s.state,'pending.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});if(process.platform!=='win32'){const d=await fs.open(s.state,'r');try{await d.sync();}finally{await d.close();}}if(p&&!keep)await fs.unlink(path.join(s.state,p.file)).catch(()=>{});}
async function reconcile(s,pending,known){const bytes=await fs.readFile(path.join(s.state,pending.file));if(blobSha(bytes)!==pending.targetSha)throw new StorageError('STORAGE_JOURNAL_INVALID',pending.id);for(let attempt=0;attempt<3;attempt++){let remote;try{remote=await readRemote(known);known=remote;}catch{await sleep(100*2**attempt);continue;}if(remote.sha===pending.targetSha){await clearPending(s);return remote;}if(remote.sha!==pending.baseSha)throw new StorageError('STORAGE_CONFLICT_REVIEW',pending.id);try{const result=await api('contents/'+s.file,'PUT',{message:'Davomat commit '+pending.id,branch:s.branch,sha:pending.baseSha,content:bytes.toString('base64')});if(result.content?.sha!==pending.targetSha)throw new StorageError('STORAGE_COMMIT_UNCONFIRMED',pending.id);await clearPending(s);return {bytes,sha:pending.targetSha,verifiedAt:Date.now()};}catch(e){if(['STORAGE_AUTH','STORAGE_FORBIDDEN','STORAGE_NOT_FOUND','STORAGE_VALIDATION'].includes(e.code)){await atomic(path.join(s.state,'rejected-'+pending.id+'.json'),JSON.stringify({...pending,error:e.code}));await clearPending(s,true);throw e;}await sleep(100*2**attempt);}}try{const remote=await readRemote();if(remote.sha===pending.targetSha){await clearPending(s);return remote;}}catch{}throw new StorageError('STORAGE_COMMIT_UNCONFIRMED',pending.id);}
async function installSnapshot(s,file,remote){
 const wal=await fs.stat(file+'-wal').catch(()=>null);if(wal?.size)throw new StorageError('STORAGE_WAL_REVIEW');
 const current=await fs.readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 if(!current?.equals(remote.bytes))await atomic(file,remote.bytes);
 const metadata=JSON.stringify({sha:remote.sha,etag:remote.etag,verifiedAt:remote.verifiedAt,source:sourceKey(s)}),cachePath=path.join(s.root,'database-cache.json');
 if(await fs.readFile(cachePath,'utf8').catch(()=>null)!==metadata)await atomic(cachePath,metadata);
}
// All processes still use the same kernel lock. Only explicitly read-only work may
// use the short-lived, hash-verified snapshot; writers always validate with GitHub.
async function withGithubDatabase(work,options={}){
 if(!enabled()||context.getStore()?.active)return work();
 const next=tail.then(async()=>{
  const s=settings(),{prisma}=require('./index.js'),file=process.env.DATABASE_URL?.replace(/^file:/,'').split('?')[0];
  if(!file||!path.resolve(file).startsWith(path.resolve(s.root)+path.sep))throw new StorageError('STORAGE_PATH');
  const release=await acquire(s.state);let remote,state,committed=false,result,problem;
  try{
   await disconnect(prisma);
   const pending=await json(path.join(s.state,'pending.json'));
   const existing=await fs.readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
   const cache=await json(path.join(s.root,'database-cache.json')),health=await json(path.join(s.state,'health.json'));
   const existingSha=existing?blobSha(existing):null;
   const known=existing&&cache?.sha===existingSha&&cache.source===sourceKey(s)?{bytes:existing,sha:cache.sha,etag:cache.etag,verifiedAt:cache.verifiedAt}:undefined;
   const age=Date.now()-Number(known?.verifiedAt||0),ttl=Math.min(15000,Math.max(0,Number(options.maxAgeMs??2000)||0));
   const cached=options.readOnly&&known&&health?.ok&&age>=0&&age<ttl;
   remote=pending?await reconcile(s,pending,known):cached?known:await readRemote(known);
   if(existing&&existingSha!==remote.sha&&(!cache||existingSha!==cache.sha)){
    const id=crypto.randomUUID();await atomic(path.join(s.state,'unconfirmed-local-'+id+'.sqlite'),existing);throw new StorageError('STORAGE_LOCAL_REVIEW',id);
   }
   await installSnapshot(s,file,remote);
   const c=await prisma.$queryRawUnsafe('PRAGMA table_info(telegram_chats)');
   if(!c.some(x=>x.name==='addedByTelegramIds'))await prisma.$executeRawUnsafe("ALTER TABLE telegram_chats ADD COLUMN addedByTelegramIds TEXT NOT NULL DEFAULT '[]'");
   const t=await prisma.$queryRawUnsafe('PRAGMA table_info(teachers)');
   if(!t.some(x=>x.name==='deletedAt'))await prisma.$executeRawUnsafe('ALTER TABLE teachers ADD COLUMN deletedAt DATETIME');
   state={active:true,readOnly:!!options.readOnly,after:[]};result=await context.run(state,work);state.active=false;
   await disconnect(prisma);const bytes=await fs.readFile(file);
   if(!bytes.equals(remote.bytes)){
    if(options.readOnly)throw new StorageError('STORAGE_READ_ONLY_VIOLATION');
    const id=crypto.randomUUID(),pending={id,baseSha:remote.sha,targetSha:blobSha(bytes),file:'candidate-'+id+'.sqlite',createdAt:Date.now()};
    await atomic(path.join(s.state,pending.file),bytes);await atomic(path.join(s.state,'pending.json'),JSON.stringify(pending));remote=await reconcile(s,pending,remote);
   }
   committed=true;await installSnapshot(s,file,remote);
   if(!health?.ok||health.lastSuccess!==remote.verifiedAt)await markHealth(s,{ok:true,lastSuccess:remote.verifiedAt||Date.now()});
  }catch(e){
   if(committed)console.error('DAVOMAT_DIAG',JSON.stringify({code:'POST_COMMIT_LOCAL_ERROR',cause:e.code||e.name}));else problem=e;
   await markHealth(s,{ok:committed,code:e.code||'APPLICATION_ERROR',operationId:e.operationId}).catch(()=>{});
  }finally{
   if(state)state.active=false;
   try{await disconnect(prisma);if(!committed&&remote&&!await json(path.join(s.state,'pending.json'))&&!['STORAGE_LOCAL_REVIEW','STORAGE_WAL_REVIEW'].includes(problem?.code))await installSnapshot(s,file,remote);}
   catch(e){problem ||=e;}finally{await release();}
  }
  if(problem)throw problem;
  for(const task of state?.after||[])setImmediate(()=>context.exit(()=>Promise.resolve().then(task).catch(e=>console.error('DAVOMAT_DIAG',JSON.stringify({code:'POST_COMMIT_FAILED',cause:e.code||e.name})))));
  return result;
 });tail=next.catch(()=>{});return next;
}
async function storageStatus(){if(!enabled())return {ok:true,storage:'local'};const s=settings(),h=await json(path.join(s.state,'health.json')),p=await json(path.join(s.state,'pending.json'));return {ok:!!h?.ok&&!p&&Date.now()-h.at<180000,storage:'github',code:p?'STORAGE_COMMIT_UNCONFIRMED':h?.code,operationId:p?.id||h?.operationId,lastSuccess:h?.lastSuccess||null};}
async function storageHealth(){return withGithubDatabase(async()=>{await require('./index.js').prisma.group.count();return true;});}
function afterGithubCommit(task){const s=context.getStore();if(enabled()&&s?.active){s.after.push(task);return;}setImmediate(()=>Promise.resolve().then(task).catch(e=>console.error('DAVOMAT_DIAG',JSON.stringify({code:'POST_COMMIT_FAILED',cause:e.code||e.name}))));}
module.exports={drainGithubDatabase:()=>tail,withGithubDatabase,storageHealth,storageStatus,githubPrimary:enabled,afterGithubCommit,StorageError,inGithubDatabase:()=>!!context.getStore()?.active};
