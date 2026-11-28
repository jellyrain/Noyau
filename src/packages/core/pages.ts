import { readFileSync, realpathSync, statSync } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const mediaTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.map': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
};

function inside(root: string, file: string) {
  const name = relative(root, file);
  return name !== '..' && !name.startsWith('..' + sep) && !isAbsolute(name);
}

export function loadPages(page: string, directory: string) {
  const source = realpathSync(page);
  const root = statSync(source).isDirectory() ? source : undefined;
  const entry = root ? realpathSync(join(root, 'index.html')) : source;
  if (root && !inside(root, entry)) throw new Error('index.html 必须位于产品构建目录内');
  if (root && inside(root, realpathSync(directory))) throw new Error('资料目录必须位于公开的前端构建目录以外');
  const html = readFileSync(entry, 'utf8');

  async function serve(request: Request, pathname: string) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
    const head = request.method === 'HEAD';
    const index = () => new Response(head ? null : html, { headers: { 'content-type': mediaTypes['.html'] } });
    if (pathname === '/' || pathname === '/index.html') return index();
    if (!root) return new Response(null, { status: 404 });
    let path: string;
    try {
      path = decodeURIComponent(pathname);
    } catch {
      return new Response(null, { status: 400 });
    }
    const segments = path.slice(1).split('/');
    if (segments.some(s => s === '..' || /[\\:\0]/.test(s))) return new Response(null, { status: 404 });
    try {
      const file = await realpath(resolve(root, '.' + path));
      if (!inside(root, file)) return new Response(null, { status: 404 });
      if ((await stat(file)).isFile()) {
        return new Response(head ? null : new Uint8Array(await readFile(file)), {
          headers: { 'content-type': mediaTypes[extname(file).toLowerCase()] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff' },
        });
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
    }
    if (!extname(path) && request.headers.get('accept')?.includes('text/html')) return index();
    return new Response(null, { status: 404 });
  }
  return serve;
}
