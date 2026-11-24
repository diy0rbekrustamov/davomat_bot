const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
test('database lock gives another process a turn and prevents overlapping access', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'davomat-storage-test-'));
  const script = `
    const fs=require('node:fs/promises'),path=require('node:path');
    const root=process.env.TEST_DB_ROOT;
    process.env.GITHUB_PRIMARY='1';process.env.GITHUB_PAT='fixture';process.env.GITHUB_RAM_DIR=root;process.env.DATABASE_URL='file:'+path.join(root,'dev.db');
    const prisma={$disconnect:async()=>{},$queryRawUnsafe:async()=>[{name:'addedByTelegramIds'},{name:'deletedAt'}]};
    require.cache[require.resolve('/app/packages/db/index.js')]={exports:{prisma}};
    global.fetch=async()=>({ok:true,json:async()=>({content:Buffer.from('SQLite format 3\\0fixture').toString('base64'),sha:'fixture'})});
    const {withGithubDatabase}=require('/app/packages/db/github-store.cjs');
    (async()=>{for(let i=0;i<Number(process.env.TEST_ROUNDS);i++)await withGithubDatabase(async()=>{
      const marker=path.join(root,'critical');const fd=await fs.open(marker,'wx');console.log('entered');
      await new Promise(r=>setTimeout(r,20));await fd.close();await fs.unlink(marker);
    });console.log('done')})().catch(e=>{console.error(e.message);process.exitCode=1});
  `;
  let first;
  function worker(rounds) {
    const proc = spawn(process.execPath, ['-e', script], { env: { ...process.env, TEST_DB_ROOT: root, TEST_ROUNDS: String(rounds) } });
    let output = '';
    proc.stdout.on('data', chunk => { output += chunk; });
    const done = new Promise((resolve, reject) => {
      proc.on('error', reject);
      proc.on('exit', code => code === 0 ? resolve(output) : reject(Error('Worker failed: ' + code)));
    });
    return { proc, done };
  }
  try {
    first = worker(15);
    await new Promise(resolve => first.proc.stdout.once('data', resolve));
    const second = worker(1);
    await second.done;
    assert.equal(first.proc.exitCode, null, 'Second process must not wait for the whole batch');
    assert.match(await first.done, /done/);
  } finally {
    if (first?.proc.exitCode === null) first.proc.kill();
    await fs.rm(root, { recursive: true, force: true });
  }
});
