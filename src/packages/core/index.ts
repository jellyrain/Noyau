import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { InvalidDraft, type Product } from '@noyau/extension-contract';

const { version } = require('../package.json') as { version: string };

export function openProduct(product: Product, directory: string) {
  const maxDraftBytes = product.maxDraftBytes ?? 1024 * 1024;
  if (!Number.isSafeInteger(maxDraftBytes) || maxDraftBytes < 1) {
    throw new RangeError('maxDraftBytes 须为正整数');
  }
  const page = readFileSync(product.page, 'utf8');
  mkdirSync(directory, { recursive: true });
  const database = new DatabaseSync(join(directory, 'noyau.sqlite'));
  try {
    database.exec(`
      PRAGMA locking_mode = EXCLUSIVE;
      CREATE TABLE IF NOT EXISTS product_data (
        id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL
      );
      BEGIN EXCLUSIVE;
      COMMIT;
    `);
  } catch (error) {
    database.close();
    throw error;
  }
  const read = database.prepare('SELECT value FROM product_data WHERE id = 1');
  const write = database.prepare('INSERT OR REPLACE INTO product_data (id, value) VALUES (1, ?)');

  async function handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/') {
      return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (pathname !== '/api/data') return new Response(null, { status: 404 });
    if (request.method === 'GET') {
      const row = read.get();
      const data = row ? JSON.parse(row.value as string) : product.initial;
      return Response.json({ data, version }, { headers: { 'cache-control': 'no-store' } });
    }
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return new Response(null, { status: 415 });
    }
    const body = await request.text();
    if (Buffer.byteLength(body) > maxDraftBytes) return new Response(null, { status: 413 });
    let draft: unknown;
    try {
      draft = JSON.parse(body);
    } catch {
      return new Response(null, { status: 400 });
    }
    try {
      const revision = product.prepareSave(draft);
      write.run(JSON.stringify(revision));
    } catch (error) {
      if (error instanceof InvalidDraft) return new Response(error.message, { status: 400 });
      throw error;
    }
    return new Response(null, { status: 204 });
  }

  return { handle, maxDraftBytes, close: () => database.close() };
}
