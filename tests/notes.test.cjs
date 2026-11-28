const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { createRequire } = require('node:module');
const path = require('node:path');
const { createInterface } = require('node:readline');
const test = require('node:test');
const { chromium, _electron: electron } = require('playwright-core');

const examples = path.resolve(__dirname, '../src/examples');

function checkFrameworkVersions(runtime, t) {
  const fromProduct = createRequire(path.join(examples, runtime, 'package.json'));
  const host = '@noyau/' + runtime;
  const expected = fromProduct('./package.json').dependencies[host].replace(/^workspace:/, '');
  const fromHost = createRequire(fromProduct.resolve(host));
  const fromCore = createRequire(fromHost.resolve('@noyau/core'));
  const fromNotes = createRequire(fromProduct.resolve('@noyau-example/notes'));
  const versions = {
    [host]: fromProduct(host + '/package.json').version,
    core: fromHost('@noyau/core/package.json').version,
    coreContract: fromCore('@noyau/extension-contract/package.json').version,
    productContract: fromNotes('@noyau/extension-contract/package.json').version,
  };
  t.diagnostic(JSON.stringify({ runtime, expected, versions }));
  assert.match(expected, /^\d+\.\d+\.\d+$/);
  for (const actual of Object.values(versions)) assert.equal(actual, expected);
  return expected;
}

async function startServer(directory, ui) {
  const child = spawn(process.execPath, [path.join(examples, 'server'), directory, '0', '--ui=' + ui], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const exited = once(child, 'exit');
  const output = createInterface({ input: child.stdout });
  try {
    for await (const line of output) {
      if (/^http:\/\/127\.0\.0\.1:\d+$/.test(line)) {
        return { url: line, close: async () => { child.kill(); await exited; } };
      }
    }
    throw new Error('独立 Server 在输出本机地址前退出');
  } catch (error) {
    child.kill();
    throw error;
  } finally {
    output.close();
  }
}

async function editAndReopen(runtime, ui, open, t) {
  const expectedVersion = checkFrameworkVersions(runtime, t);
  const directory = await mkdtemp(path.join(tmpdir(), 'noyau-notes-'));
  try {
    const editor = await open(directory);
    try {
      await editor.page.getByLabel('标题').fill('首条笔记');
      await editor.page.getByLabel('正文').fill('原文 A');
      await editor.page.getByRole('button', { name: '保存', exact: true }).click();
      await editor.page.getByText('已保存', { exact: true }).waitFor();
    } finally {
      await editor.close();
    }
    assert.ok((await readdir(directory)).length, '已保存的内容应写入本次指定的资料目录');

    const reopened = await open(directory);
    try {
      await reopened.page.getByText(`Noyau ${expectedVersion}`, { exact: true }).waitFor();
      await reopened.page.goto(new URL('/notes/first', reopened.page.url()).href);
      await reopened.page.getByText(`Noyau ${expectedVersion}`, { exact: true }).waitFor();
      const title = await reopened.page.getByLabel('标题').inputValue();
      const body = await reopened.page.getByLabel('正文').inputValue();
      assert.equal(await reopened.page.getByLabel('正文').evaluate(field => getComputedStyle(field).resize), 'vertical');
      const version = await reopened.page.getByLabel('框架版本').textContent();
      t.diagnostic(JSON.stringify({ platform: process.platform, arch: process.arch, ui, version, title, body }));
      assert.deepEqual({ title, body }, { title: '首条笔记', body: '原文 A' });
    } finally {
      await reopened.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
}

for (const ui of ['vue', 'react']) {
  test(`独立 Server 在 ${ui} 本机产品页保存后退出，重开读回标题与正文`, { timeout: 90000 }, async t => {
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
      await editAndReopen('server', ui, async directory => {
        const server = await startServer(directory, ui);
        try {
          const page = await browser.newPage();
          await page.goto(server.url);
          return { page, close: async () => { await page.close(); await server.close(); } };
        } catch (error) {
          await server.close();
          throw error;
        }
      }, t);
    } finally {
      await browser.close();
    }
  });

  test(`桌面 App 在 ${ui} 主窗口保存后退出，重开读回标题与正文`, { timeout: 90000 }, async t => {
    await editAndReopen('desktop', ui, async directory => {
      const app = await electron.launch({
        args: [path.join(examples, 'desktop'), '--data-dir=' + directory, '--ui=' + ui],
        executablePath: createRequire(path.join(examples, 'desktop/package.json'))('electron'),
      });
      try {
        const page = await app.firstWindow();
        return { page, close: () => app.close() };
      } catch (error) {
        await app.close();
        throw error;
      }
    }, t);
  });
}
