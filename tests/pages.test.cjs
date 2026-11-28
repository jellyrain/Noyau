const assert = require('node:assert/strict');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { serve } = require('../src/packages/server');
const { openProduct } = require('../src/packages/core');

test('构建目录提供静态资源和前端导航，业务地址独立分发', async t => {
  const root = fs.mkdtempSync(join(tmpdir(), 'noyau-pages-'));
  const page = join(root, 'public');
  const directory = join(root, 'data');
  fs.mkdirSync(page);
  fs.writeFileSync(join(page, 'index.html'), '<h1>首页</h1>');
  fs.writeFileSync(join(page, '编辑器.mjs'), 'export default 42');
  let server;
  t.after(async () => {
    if (server) await server.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const extension = { id: '@example/labels', operations: { read: () => '扩展已加载' } };
  assert.throws(() => openProduct({ page, modules: [] }, page), /资料目录/);
  server = await serve({ page, modules: [extension] }, directory, 0);
  const get = (path, options) => fetch(server.url + path, options);
  const script = await get('/编辑器.mjs?v=42');
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal(await script.text(), 'export default 42');
  const navigation = { headers: { accept: 'text/html' } };
  assert.equal(await (await get('/notes/first', navigation)).text(), '<h1>首页</h1>');
  assert.equal((await get('/missing.js', navigation)).status, 404);
  assert.equal((await get('/api/missing', navigation)).status, 404);
  const response = await get('/api/modules/%40example%2Flabels/read', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: 'null',
  });
  assert.equal((await response.json()).data, '扩展已加载');
  await server.close();
  server = undefined;
  const single = openProduct({ page: join(page, 'index.html'), initial: null, prepareSave: x => x }, directory);
  try {
    assert.equal((await single.handle(new Request('http://product/编辑器.mjs'))).status, 404);
    const read = () => single.handle(new Request('http://product/api/data'));
    assert.equal((await (await read()).json()).data, null);
    const saved = await single.handle(new Request('http://product/api/data', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"title":"原入口"}',
    }));
    assert.equal(saved.status, 204);
    assert.deepEqual((await (await read()).json()).data, { title: '原入口' });
  } finally {
    await single.close();
  }
});
