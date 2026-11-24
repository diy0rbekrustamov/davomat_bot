const { test } = require('node:test');
const assert = require('node:assert/strict');
test('slow attendance worker does not enqueue overlapping polling jobs', async () => {
  let tick, release, calls = 0;
  require.cache[require.resolve('@davomat/db')] = { exports: {
    prisma: { notification: { findMany: async () => [] } },
    withGithubDatabase: async work => { calls++; await new Promise(resolve => { release = resolve; }); return work(); },
  } };
  require.cache[require.resolve('../dist/bot')] = { exports: { bot: { api: {} } } };
  const original = global.setInterval;
  global.setInterval = fn => { tick = fn; return { unref() {} }; };
  try {
    require('../dist/services/notify.service').default.startWorker();
    await tick(); await tick();
    assert.equal(calls, 1);
    release(); await new Promise(resolve => setImmediate(resolve));
    tick(); assert.equal(calls, 2);
    release(); await new Promise(resolve => setImmediate(resolve));
  } finally { global.setInterval = original; }
});
