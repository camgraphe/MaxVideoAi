import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../../../package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const origin = 'http://localhost:3116';
const route = '/models/seedream-5-5';
const response = await fetch(origin + route);
const html = await response.text();
const doc = new JSDOM(html).window.document;
const records = [...doc.querySelectorAll('a[href]')].map(a => ({
  href: a.getAttribute('href'), text: a.textContent.trim(),
  scope: a.closest('.model-cinematic-page') ? 'model' : 'shell',
  panel: a.closest('dialog') ? true : false,
  analytics: a.getAttribute('data-analytics-event'),
}));
const modelOnly = process.argv.includes('--model-only');
const urls = [...new Set(records.filter(r => !modelOnly || r.scope === 'model').map(r => r.href))];
const cache = new Map([[origin + route, { status: response.status, url: origin + route, doc }]]);
async function read(url, media) {
  if (cache.has(url)) return cache.get(url);
  const promise = (async () => {
    try {
      const r = await fetch(url, { method: media ? 'HEAD' : 'GET', signal: AbortSignal.timeout(45000) });
      const type = r.headers.get('content-type') || '';
      return { status: r.status, url: r.url, type, doc: type.includes('text/html') && !media ? new JSDOM(await r.text()).window.document : null };
    } catch (e) { return { error: e.message }; }
  })();
  cache.set(url, promise); return promise;
}
let cursor = 0;
const results = [];
async function worker() {
  while (cursor < urls.length) {
    const href = urls[cursor++];
    const url = new URL(href, origin + route);
    const uses = records.filter(r => r.href === href);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) {
      results.push({ href, uses, external: true }); continue;
    }
    const hash = decodeURIComponent(url.hash.slice(1)); url.hash = '';
    const media = url.pathname.startsWith('/assets/');
    const target = await read(url.href, media);
    const anchor = hash && target.doc ? !!target.doc.getElementById(hash) : null;
    results.push({ href, uses, status: target.status, final: target.url, error: target.error, ...(hash ? { anchor, hash } : {}) });
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
writeFileSync(new URL(modelOnly ? './links-after.json' : './links.json', import.meta.url), JSON.stringify(results, null, 2));
writeFileSync(new URL(modelOnly ? './page-after.html' : './page-before.html', import.meta.url), html);
console.log(JSON.stringify({
  links: records.length, unique: urls.length, modelLinks: records.filter(r => r.scope === 'model').length,
  external: results.filter(r => r.external).map(r => r.href),
  broken: results.filter(r => r.error || r.status >= 400 || r.anchor === false),
}, null, 2));
