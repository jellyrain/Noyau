const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const { openProduct } = require('../src/packages/core');
const { InvalidDraft } = require('../src/packages/extension-contract');

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'noyau-modules-'));
  const directory = join(root, 'data');
  const page = join(root, 'index.html');
  writeFileSync(page, '<!doctype html>');
  let session;
  t.after(() => {
    session?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  });
  return {
    directory, page,
    open(options) {
      session?.close();
      session = undefined;
      session = openProduct({ page, ...options }, directory);
      return session;
    },
  };
}

function invoke(session, module, operation, input = null) {
  return session.handle(new Request('http://product/api/modules/' + encodeURIComponent(module) + '/' + operation, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
  }));
}

const notes = {
  id: 'notes',
  operations: {
    save({ id, title }, store) { store.set(id, { title }); },
    read(id, store) { return store.get(id) ?? null; },
    list(_, store) { return store.entries(); },
    async discard(_, store) {
      store.delete('a');
      await Promise.resolve();
      store.set('b', { title: '部分写入' });
      throw new InvalidDraft('草稿无效');
    },
  },
};
const labels = { ...notes, id: '@example/labels', requires: ['notes'] };

test('模块和扩展可以同名操作、同名字段，逐条保存并在重开后读取', async t => {
  const f = fixture(t);
  const options = { modules: [notes, labels] };
  let session = f.open(options);
  for (const [module, id, title] of [['notes', 'a', '笔记 A'], ['notes', 'b', '笔记 B'], ['@example/labels', 'a', '标签 A']]) {
    assert.equal((await invoke(session, module, 'save', { id, title })).status, 200);
  }
  assert.equal((await invoke(session, 'notes', 'discard')).status, 400);
  session = f.open(options);
  assert.deepEqual((await (await invoke(session, 'notes', 'list')).json()).data,
    [['a', { title: '笔记 A' }], ['b', { title: '笔记 B' }]]);
  assert.deepEqual((await (await invoke(session, '@example/labels', 'read', 'a')).json()).data, { title: '标签 A' });
  assert.equal((await invoke(session, 'notes', 'toString')).status, 404);
});

test('重复模块标识和缺少的扩展依赖在加载产品入口时报告', t => {
  const f = fixture(t);
  assert.throws(() => f.open({ modules: [notes, notes] }), /重复.*notes/);
  assert.throws(() => f.open({ modules: [labels] }), /依赖.*notes/);
});

test('并发操作依次读到前一次提交，关闭资料目录会等待已受理的操作', async t => {
  const f = fixture(t);
  const started = Promise.withResolvers();
  const resume = Promise.withResolvers();
  let finishedStore;
  const counters = {
    id: 'counters',
    operations: {
      async increment(wait, store) {
        const current = store.get('count') ?? 0;
        if (wait) {
          started.resolve();
          await resume.promise;
        }
        store.set('count', current + 1);
        finishedStore = store;
      },
      read(_, store) { return store.get('count'); },
    },
  };
  const session = f.open({ modules: [counters] });
  const first = invoke(session, 'counters', 'increment', true);
  await started.promise;
  const second = invoke(session, 'counters', 'increment', false);
  const closing = session.close();
  resume.resolve();
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  await closing;
  assert.throws(() => finishedStore.set('count', 99), /已.*结束/);
  const reopened = f.open({ modules: [counters] });
  assert.equal((await (await invoke(reopened, 'counters', 'read')).json()).data, 2);
});

test('模块接管旧资料后，旧产品入口也能读到随后保存的那一版', async t => {
  const f = fixture(t);
  mkdirSync(f.directory);
  const old = new DatabaseSync(join(f.directory, 'noyau.sqlite'));
  old.exec('CREATE TABLE product_data(id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL)');
  old.prepare('INSERT INTO product_data VALUES(1, ?)').run(JSON.stringify({ title: '旧笔记' }));
  old.close();
  let session = f.open({ modules: [notes], legacyRecord: { module: 'notes', key: 'first' } });
  assert.deepEqual((await (await invoke(session, 'notes', 'read', 'first')).json()).data, { title: '旧笔记' });
  await invoke(session, 'notes', 'save', { id: 'first', title: '新笔记' });
  session = f.open({ initial: {}, prepareSave: x => x });
  const response = await session.handle(new Request('http://product/api/data'));
  assert.deepEqual((await response.json()).data, { title: '新笔记' });
});

test('已存在的模块记录遇到旧资料映射冲突时保留原值', async t => {
  const f = fixture(t);
  let session = f.open({ modules: [notes] });
  await invoke(session, 'notes', 'save', { id: 'first', title: '原值' });
  assert.throws(() => f.open({ modules: [notes], legacyRecord: { module: 'notes', key: 'first' } }), /映射.*冲突/);
  session = f.open({ modules: [notes] });
  assert.deepEqual((await (await invoke(session, 'notes', 'list')).json()).data, [['first', { title: '原值' }]]);
});

test('旧接口冻结本次提交的版本，关闭后重开仍读回原值', async t => {
  const f = fixture(t);
  const product = { initial: {}, prepareSave(draft) {
    queueMicrotask(() => { draft.title = '下一版'; });
    return draft;
  } };
  const session = f.open(product);
  const submitted = session.handle(new Request('http://product/api/data', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"title":"本次提交"}',
  }));
  await session.close();
  assert.equal((await submitted).status, 204);
  const response = await f.open(product).handle(new Request('http://product/api/data'));
  assert.deepEqual((await response.json()).data, { title: '本次提交' });
});

test('新版笔记产品兼容旧客户端，两个接口读写同一条旧笔记', async t => {
  const f = fixture(t);
  const session = f.open(require('../src/examples/notes').notes);
  const url = 'http://product/api/data';
  const saved = await session.handle(new Request(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"title":"旧客户端","body":"A"}',
  }));
  assert.equal(saved.status, 204);
  assert.deepEqual((await (await invoke(session, 'notes', 'read', 'first')).json()).data, { title: '旧客户端', body: 'A' });
  await invoke(session, 'notes', 'save', { id: 'first', title: '新客户端', body: 'B' });
  assert.deepEqual((await (await session.handle(new Request(url))).json()).data, { title: '新客户端', body: 'B' });
});
