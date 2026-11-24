const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const nonce=process.argv[2];if(!/^[a-zA-Z0-9-]+$/.test(nonce||''))throw Error('INVALID_CHECKPOINT_ID');
 const root=process.env.GITHUB_RAM_DIR||'/ram',state=process.env.GITHUB_STATE_DIR||'/state',store=require('/app/packages/db');let release;await fs.writeFile(path.join(root,'audit-cutover-'+nonce+'.pid'),String(process.pid));
 if(store.storageStatus){await fs.mkdir(state,{recursive:true});if(await fs.stat(path.join(state,'pending.json')).catch(()=>null))throw Error('PENDING_COMMIT_REQUIRES_RECONCILIATION');release=await new Promise((resolve,reject)=>{const child=spawn('flock',['-x','-w','30',path.join(state,'database.lock'),'sh','-c','printf "HELD\\n";cat >/dev/null'],{stdio:['pipe','pipe','pipe']});let held=false;child.stdout.once('data',()=>{held=true;resolve(async()=>{child.stdin.end();await new Promise(r=>child.once('exit',r));});});child.on('exit',()=>{if(!held)reject(Error('CHECKPOINT_LOCK_BUSY'));});child.on('error',reject);});}
 else{const lock=path.join(root,'database-lock'),deadline=Date.now()+30000;while(true){try{await fs.mkdir(lock);await fs.writeFile(path.join(lock,'pid'),String(process.pid));break;}catch(e){if(e.code!=='EEXIST')throw e;if(Date.now()>deadline)throw Error('CHECKPOINT_LOCK_BUSY');await sleep(100);}}release=async()=>{if(Number(await fs.readFile(path.join(lock,'pid'),'utf8').catch(()=>''))===process.pid)await fs.rm(lock,{recursive:true,force:true});};}
 let ready=false;const {PrismaClient}=require('/app/node_modules/@prisma/client');const p=new PrismaClient();
 async function finish(){await p.$disconnect().catch(()=>{});await release();process.exit(0);}
 process.once('SIGTERM',()=>void finish());process.once('SIGINT',()=>void finish());
 try{
 const pending=await p.notification.count({where:{harakat:{in:['ATTENDANCE_DELETE_PENDING','ATTENDANCE_REPORT_PENDING','ANNOUNCEMENT_PENDING','ANNOUNCEMENT_DONE_NOTICE','ACCESS_NOTICE_PENDING','REMINDER_PENDING']}}});if(pending)throw Error('QUEUES_NOT_DRAINED');
 const prefix=path.join(root,'audit-cutover-'+nonce);await p.$executeRawUnsafe("VACUUM INTO '"+prefix+".sqlite'");
 const counts={};for(const name of ['admin','teacher','group','student','attendanceSession','attendanceRecord','notification'])counts[name]=await p[name].count();
 await p.$disconnect();
 const e=process.env,repo=e.GITHUB_REPO||'provveb/database_davomat_byprovveb',branch=e.GITHUB_BRANCH||'main',headers={Authorization:'Bearer '+e.GITHUB_PAT,Accept:'application/vnd.github+json','Cache-Control':'no-cache'};
 const r=await fetch(`https://api.github.com/repos/${repo}/contents/dev.db?ref=${encodeURIComponent(branch)}`,{headers,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('CHECKPOINT_REMOTE_'+r.status);const d=await r.json();let remote;if(d.content)remote=Buffer.from(d.content,'base64');else{const b=await fetch(`https://api.github.com/repos/${repo}/git/blobs/${d.sha}`,{headers,signal:AbortSignal.timeout(15000)});if(!b.ok)throw Error('CHECKPOINT_BLOB_'+b.status);remote=Buffer.from((await b.json()).content,'base64');}
 const local=await fs.readFile(path.join(root,'dev.db'));const blob=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');
 if(blob(remote)!==d.sha)throw Error('CHECKPOINT_HASH_INVALID');if(!local.equals(remote)){const cache=JSON.parse(await fs.readFile(path.join(root,'database-cache.json'),'utf8').catch(()=>'null'));if(!cache||cache.sha!==blob(local))throw Error('UNCONFIRMED_LOCAL_CHANGES');}
 await fs.writeFile(prefix+'.github.sqlite',remote);const data={pid:process.pid,sha:d.sha,bytes:remote.length,counts,localMatches:local.equals(remote)};await fs.writeFile(prefix+'.ready.json',JSON.stringify(data));console.log('CHECKPOINT_READY',JSON.stringify(data));ready=true;setInterval(()=>{},1000);
 }catch(error){await p.$disconnect().catch(()=>{});await release();throw error;}
})().catch(e=>{console.error(e.message);process.exit(1);});
