import { mkdirSync } from 'node:fs';
import { InvalidDraft, type Json, type Operation, type ProductEntry, type ProductModule } from '@noyau/extension-contract';
import { loadPages } from './pages';
import { openRecords } from './records';

const { version } = require('../package.json') as { version: string };
const namePattern = /^[a-z0-9][a-z0-9._-]*$/i;

function registerModules(modules: readonly ProductModule[]) {
  const registry = new Map<string, Map<string, Operation>>();
  for (const module of modules) {
    const parts = module.id.startsWith('@') ? module.id.slice(1).split('/') : [module.id];
    if ((module.id.startsWith('@') && parts.length !== 2) || !parts.every(part => namePattern.test(part))) {
      throw new Error('无效的模块标识：' + module.id);
    }
    if (registry.has(module.id)) throw new Error('重复的模块标识：' + module.id);
    const operations = new Map(Object.entries(module.operations));
    for (const [name, operation] of operations) {
      if (!namePattern.test(name) || typeof operation !== 'function') throw new Error('无效的模块操作：' + module.id + '/' + name);
    }
    registry.set(module.id, operations);
  }
  for (const module of modules) {
    for (const id of module.requires ?? []) {
      if (!registry.has(id)) throw new Error(module.id + ' 缺少依赖：' + id);
    }
  }
  return registry;
}

function dataResponse(data: Json) {
  return Response.json({ data, version }, { headers: { 'cache-control': 'no-store' } });
}

export function openProduct(product: ProductEntry, directory: string) {
  const maxDraftBytes = product.maxDraftBytes ?? 1024 * 1024;
  if (!Number.isSafeInteger(maxDraftBytes) || maxDraftBytes < 1) throw new RangeError('maxDraftBytes 须为正整数');
  const registry = registerModules(product.modules ?? []);
  if (product.legacyRecord && !registry.has(product.legacyRecord.module)) {
    throw new Error('旧资料对应的模块未注册：' + product.legacyRecord.module);
  }
  const legacy = typeof product.prepareSave === 'function' ? product : undefined;
  if (('initial' in product || 'prepareSave' in product) && (!legacy || legacy.initial === undefined)) {
    throw new Error('单文档产品需同时提供 initial 和 prepareSave');
  }
  mkdirSync(directory, { recursive: true });
  const servePage = loadPages(product.page, directory);
  const records = openRecords(directory, product.legacyRecord);

  async function submit(request: Request, execute: (input: unknown) => Response | Promise<Response>) {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return new Response(null, { status: 415 });
    }
    const body = await request.arrayBuffer();
    if (body.byteLength > maxDraftBytes) return new Response(null, { status: 413 });
    let input: unknown;
    try {
      input = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return new Response(null, { status: 400 });
    }
    try {
      return await execute(input);
    } catch (error) {
      if (error instanceof InvalidDraft) return new Response(error.message, { status: 400 });
      throw error;
    }
  }

  async function dispatch(request: Request, pathname: string): Promise<Response> {
    if (pathname === '/api/data' && legacy) {
      if (request.method === 'GET') {
        const stored = records.readLegacy();
        return dataResponse(stored === undefined ? legacy.initial : stored);
      }
      return submit(request, input => {
        records.writeLegacy(legacy.prepareSave(input));
        return new Response(null, { status: 204 });
      });
    }
    const match = /^\/api\/modules\/([^/]+)\/([^/]+)$/.exec(pathname);
    if (!match) return new Response(null, { status: 404 });
    let module: string, name: string;
    try {
      module = decodeURIComponent(match[1]);
      name = decodeURIComponent(match[2]);
    } catch {
      return new Response(null, { status: 400 });
    }
    const operation = registry.get(module)?.get(name);
    if (!operation) return new Response(null, { status: 404 });
    return submit(request, input => records.transaction(module, async store =>
      dataResponse((await operation(input, store)) ?? null)));
  }
  let closed = false;
  let pending = 0;
  let tail = Promise.resolve();
  function handle(request: Request): Promise<Response> {
    if (closed) return Promise.resolve(new Response(null, { status: 503 }));
    const { pathname } = new URL(request.url);
    if (pathname !== '/api' && !pathname.startsWith('/api/')) return servePage(request, pathname);
    pending++;
    const result = tail.then(() => dispatch(request, pathname)).finally(() => { pending--; });
    tail = result.then(() => {}, () => {});
    return result;
  }
  let closing: Promise<void> | undefined;
  function close() {
    if (closed) return closing;
    closed = true;
    if (pending) closing = tail.then(records.close);
    else records.close();
    return closing;
  }
  return { handle, maxDraftBytes, close };
}
