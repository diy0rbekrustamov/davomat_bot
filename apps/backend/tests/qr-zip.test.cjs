const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
require.cache[require.resolve('../dist/services/group.service')] = { exports: { GroupService: class {} } };
require.cache[require.resolve('../dist/services/github.service')] = { exports: { githubService: {} } };
const { GroupController } = require('../dist/controllers/group.controller');
const controller = new GroupController();
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
function response() { return { locals:{},end(){return this;},code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
test('requires an authenticated recipient', async () => {
  const res = response(); await controller.sendQrZip({ body: {} }, res); assert.equal(res.code, 401);
  if(res.locals.afterStorageCommit)await res.locals.afterStorageCommit();
});
test('rejects invalid archives before forwarding to Telegram', async () => {
  global.fetch = () => { throw Error('Should not forward'); };
  for (const base64 of ['bad file', Buffer.from('not a ZIP').toString('base64'), null]) {
    const res = response(); await controller.sendQrZip({ telegramUser: { id: 123 }, body: { base64 } }, res);
  if(res.locals.afterStorageCommit)await res.locals.afterStorageCommit();
    assert.equal(res.code, 400);
  }
});
test('archive is sent only to the authenticated user, using the internal credential', async () => {
  const base64 = Buffer.from([80, 75, 3, 4, 0, 0, 0, 0]).toString('base64');
  global.fetch = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:3001/internal/send-qr-zip');
    assert.deepEqual(JSON.parse(options.body), { telegramId: 123, base64 });
    assert.equal(options.headers['X-Internal-Token'], process.env.BOT_TOKEN);
    return { ok: true };
  };
  const res = response();
  await controller.sendQrZip({ telegramUser: { id: 123 }, body: { base64, telegramId: 999 } }, res);
  if(res.locals.afterStorageCommit)await res.locals.afterStorageCommit();
  assert.equal(res.code, 200);
});
test('Telegram failure returns a visible retry error', async () => {
  global.fetch = async () => ({ ok: false });
  const res = response();
  await controller.sendQrZip({ telegramUser: { id: 123 }, body: { base64: 'UEsDBAAAAAA=' } }, res);
  if(res.locals.afterStorageCommit)await res.locals.afterStorageCommit();
  assert.equal(res.code, 502); assert.ok(res.body.message.includes('/start'));
});
