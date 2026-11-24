const {spawn}=require('node:child_process');
const path=require('node:path');
const children=[];let stopping=false;
function launch(file,cwd){const child=spawn(process.execPath,[file],{cwd:path.join(__dirname,cwd),stdio:'inherit',env:{...process.env,NODE_ENV:'production'}});children.push(child);child.on('exit',(code,signal)=>{if(!stopping){console.error('Davomat process stopped:',cwd,code,signal);stop(1);}});return child;}
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');const timeout=setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');process.exit(code);},35000);Promise.all(children.map(child=>child.exitCode!==null?Promise.resolve():new Promise(resolve=>child.once('exit',resolve)))).then(()=>{clearTimeout(timeout);process.exit(code);});}
process.on('SIGTERM',()=>stop());process.on('SIGINT',()=>stop());
async function start(){launch('dist/index.js','apps/backend');if(process.env.DISABLE_BOT!=='1')launch('dist/index.js','apps/bot');launch('proxy-server.js','.');console.log('Davomat production services started.');}
start().catch(()=>stop(1));
