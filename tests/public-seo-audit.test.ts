import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectPublicPage, parseSitemap, checkHreflang, publicUrl, matchesPublicRobotsPolicy, auditPublicPages } from '../scripts/seo/check-public-pages.mjs';
import { buildRobotsText } from '../frontend/lib/seo/robots-text.ts';

const origin = 'https://maxvideoai.com';
const url = `${origin}/examples?page=2`;
const html = `<html><head><title>Examples, page 2</title><link rel="canonical" href="${url}"></head><body><h1>Examples</h1><a href="/examples?page=3">Next</a><script type="application/ld+json">{"@type":"CollectionPage"}</script></body></html>`;

test('live robots policy cannot silently become the protocol-host exclusion', () => {
  assert.equal(matchesPublicRobotsPolicy(buildRobotsText('public')),true);
  assert.equal(matchesPublicRobotsPolicy(buildRobotsText('protocol')),false);
  assert.equal(matchesPublicRobotsPolicy(buildRobotsText('public')+'\nDisallow: /examples\n'),false);
});

test('public audit inspects server HTML and preserves pagination identity', () => {
  const result = inspectPublicPage({url, status:200, headers:new Headers(), html});
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.pagination, [`${origin}/examples?page=3`]);
  assert.equal(result.canonical, url);
});

test('HTTP exclusions and HTML exclusions both fail for submitted pages', () => {
  for (const input of [
    {headers:new Headers({'X-Robots-Tag':'googlebot: noindex, follow'}), html},
    {headers:new Headers(), html:html.replace('</head>','<meta name="robots" content="noindex,follow"></head>')},
    {headers:new Headers(), html:html.replace('</head>','<meta name="googlebot" content="none"></head>')},
  ]) assert.ok(inspectPublicPage({url,status:200,...input}).errors.includes('indexing-excluded'));
});

test('a redirected, collapsed, duplicated or malformed public document fails', () => {
  const cases = [
    {status:307, html, code:'http-307'},
    {status:200, html:html.replace(`href="${url}"`,`href="${origin}/examples"`), code:'canonical-mismatch'},
    {status:200, html:html.replace('</head>',`<link rel="canonical" href="${url}"></head>`), code:'canonical-count'},
    {status:200, html:html.replace('{"@type":"CollectionPage"}','{broken}'), code:'invalid-jsonld'},
    {status:200, html:html.replace('<h1>Examples</h1>',''), code:'h1-count'},
  ];
  for(const {code,...input} of cases) assert.ok(inspectPublicPage({url,headers:new Headers(),...input}).errors.includes(code),code);
});

test('sitemaps keep only page locs, decode entities and reject off-origin targets', () => {
  const result=parseSitemap(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"><url><loc>${origin}/examples?page=2&amp;sort=date-desc</loc><video:video><video:content_loc>https://cdn.example/video.mp4</video:content_loc></video:video></url></urlset>`,origin);
  assert.deepEqual(result,{kind:'urlset',urls:[`${origin}/examples?page=2&sort=date-desc`]});
  assert.throws(()=>parseSitemap('<urlset><url><loc>https://other.example/</loc></url></urlset>',origin));
  assert.throws(()=>parseSitemap('<html>Temporarily unavailable</html>',origin));
  assert.throws(()=>publicUrl('https://maxvideoai.com@evil.example/',origin));
  assert.throws(()=>publicUrl('http://maxvideoai.com/',origin));
});

test('localized alternates must return reciprocal canonical links', () => {
  const en={url:`${origin}/examples`,canonical:`${origin}/examples`,languages:{en:`${origin}/examples`,fr:`${origin}/fr/galerie`}};
  const fr={url:`${origin}/fr/galerie`,canonical:`${origin}/fr/galerie`,languages:{en:en.url,fr:`${origin}/fr/galerie`}};
  assert.deepEqual(checkHreflang([en,fr]),[]);
  assert.ok(checkHreflang([en,{...fr,languages:{fr:fr.url}}]).length>0);
  assert.ok(checkHreflang([en,{...fr,languages:{en:fr.url,fr:en.url}}]).length>0);
  assert.ok(checkHreflang([en]).length>0);
});

test('crawl follows pages discovered by partial batches and reports a late HTTP exclusion', async () => {
  const visited: string[] = [];
  const report = await auditPublicPages({readDocument:async (target: string) => {
    visited.push(target);
    const parsed = new URL(target);
    let content = '';
    const headers = new Headers();
    if (parsed.pathname === '/robots.txt') content = buildRobotsText('public');
    else if (parsed.pathname === '/sitemap.xml') {
      content = `<urlset>${['/','/models','/ai-video-engines','/examples'].map(path => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`;
    } else {
      const current = Number(parsed.searchParams.get('page') || 1);
      const next = parsed.pathname === '/examples' && current < 4 ? `<a href="/examples?page=${current+1}">Next</a>` : '';
      content = `<title>Page</title><link rel="canonical" href="${target}"><h1>Page</h1>${next}`;
      if (current === 4) headers.set('x-robots-tag','noindex');
    }
    return {status:200,headers,html:content};
  }});
  assert.equal(report.pages.length,7);
  for (const page of [2,3,4]) assert.ok(visited.includes(`${origin}/examples?page=${page}`));
  assert.deepEqual(report.errors,[{url:`${origin}/examples?page=4`,error:'indexing-excluded'}]);
});

test('audit deadline yields an explicit incomplete report before workflow termination', async () => {
  const report = await auditPublicPages({timeLimitMs:0,readDocument:async () => { throw new Error('must not fetch after deadline'); }});
  assert.equal(report.pages.length,0);
  assert.ok(report.completedAt);
  assert.deepEqual(report.errors,[{error:'Error: audit-deadline-exceeded'}]);
});
