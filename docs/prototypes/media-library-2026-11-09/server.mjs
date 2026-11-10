import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname } from 'node:path';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const frontend = join(root, 'frontend');
export async function startPrototype(port = 0) {
  const result = await build({
    entryPoints: [join(here, 'App.tsx')], bundle: true, write: false,
    format: 'iife', platform: 'browser', jsx: 'automatic', minify: true,
    nodePaths: [join(frontend, 'node_modules')], tsconfig: join(frontend, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'synthetic-media-access', setup(builder) {
      // Only the local prototype replaces this boundary. No auth, API or signed URL is used.
      builder.onResolve({ filter: /^@\/hooks\/useLibraryMediaAccess$/ }, () => ({ path: 'access', namespace: 'prototype' }));
      builder.onLoad({ filter: /.*/, namespace: 'prototype' }, () => ({ contents: 'export function useLibraryMediaAccess({asset}) { return {retired:false,access:{thumbnailAccessUrl:asset.thumbUrl},refresh:async()=>{}}; }' }));
    } }],
  });
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
      if (pathname === '/prototype.js') { response.writeHead(200, { 'Content-Type': 'text/javascript' }); response.end(result.outputFiles[0].text); return; }
      const file = pathname.startsWith('/assets/') ? resolve(frontend, 'public', '.' + pathname)
        : pathname === '/grid.css' ? join(frontend, 'components/library/compact-library.css')
        : ['/', '/index.html', '/prototype.css'].includes(pathname) ? join(here, pathname === '/' ? 'index.html' : pathname.slice(1)) : null;
      if (!file || (pathname.startsWith('/assets/') && !file.startsWith(join(frontend, 'public/assets/')))) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(await readFile(file));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolveListen => server.listen(port, '127.0.0.1', resolveListen));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolveClose, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolveClose()); }) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startPrototype(Number(process.env.PORT ?? 4176)).then(server => console.log(`Synthetic media prototype: ${server.url}`));
}
