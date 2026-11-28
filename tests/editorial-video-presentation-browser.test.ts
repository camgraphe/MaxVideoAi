import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {chromium, webkit} from '@playwright/test';
import {ImageConfigContext} from 'next/dist/shared/lib/image-config-context.shared-runtime';
import {imageConfigDefault} from 'next/dist/shared/lib/image-config';
import {makeEditorialVideoDraft} from './fixtures/editorial-video.ts';
import {parseEditorialDraft, digestEditorialDraft} from '../frontend/lib/editorial/schema.ts';
import {projectPublicEditorialArticle} from '../frontend/src/server/editorial/publication-content.ts';
import {EditorialArticle} from '../frontend/app/(core)/admin/editorial/_components/EditorialArticle.tsx';
import {PublicEditorialArticleView} from '../frontend/components/editorial/PublicEditorialArticleView.tsx';

// This verifies our reader and browser geometry. The remote YouTube response is
// deliberately replaced and must never be reported as live embedded playback.
for (const engine of [chromium, webkit]) test(`${engine.name()}: editorial players preserve responsive geometry and disclosure access in public/admin readers`, async () => {
  const draft = parseEditorialDraft(makeEditorialVideoDraft());
  const record = {articleId:'b1f7b87f-4850-4181-a499-97f9cadc78b3', version:1, draft, digest:digestEditorialDraft(draft),
    createdAt:'2026-10-25T10:00:00Z', approvedAt:null, approvedBy:null};
  const css = await readFile('frontend/components/editorial/editorial-article.css', 'utf8');
  const pages = new Map<string,string>();
  for (const locale of ['en','fr','es'] as const) for (const surface of ['public','admin'] as const) {
    const article = projectPublicEditorialArticle(record, locale, {a1:`https://media.maxvideoai.com/editorial/published/${'a'.repeat(64)}.webp`});
    const node = surface === 'public' ? React.createElement(PublicEditorialArticleView, {article}) : React.createElement(EditorialArticle, {draft,locale,articleId:record.articleId,version:1});
    const html = renderToStaticMarkup(React.createElement(ImageConfigContext.Provider,
      {value:{...imageConfigDefault,remotePatterns:[{protocol:'https',hostname:'media.maxvideoai.com'}]}}, node));
    pages.set(`/${surface}/${locale}`, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f5f3ed}${css}</style></head><body>${html}</body></html>`);
  }
  const server = createServer((req,res) => {res.setHeader('Content-Type','text/html'); res.end(pages.get(req.url!.split('?')[0]) ?? 'Missing fixture');});
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const evidence = process.env.EDITORIAL_VIDEO_EVIDENCE_DIR;
  const measurements: unknown[] = [];
  try {
    // Literal launcher calls also let the validation runner select the browser lane.
    browser = engine === chromium ? await chromium.launch({headless:true}) : await webkit.launch({headless:true});
    const page = await browser.newPage();
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.startsWith('https://www.youtube-nocookie.com/')) return route.fulfill({contentType:'text/html',body:'<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#25322d;color:#fff;font:16px system-ui;text-align:center}p{padding:20px}</style><p>Player response fixture<br><small>YouTube playback is checked separately</small></p>'});
      if (url.startsWith(origin) && !url.includes('/_next/image') && !url.includes('/api/')) return route.continue();
      return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#d4dfbb"/><text x="80" y="300" font-size="48">Explicit article layout fixture</text></svg>'});
    });
    for (const locale of ['en','fr','es']) for (const surface of ['public','admin']) for (const width of [390,1440]) {
      await page.setViewportSize({width,height:900});
      await page.goto(`${origin}/${surface}/${locale}?review=private`, {waitUntil:'load'});
      assert.equal(await page.locator('#legacy-video details').getAttribute('open'), null);
      assert.equal(await page.locator('#legacy-video iframe').isVisible(), false);
      assert.equal(await page.locator('#inline-portrait details').count(), 0);
      for (const [id,ratio] of [['inline-landscape',16/9],['inline-portrait',9/16]] as const) {
        const frame = page.locator(`#${id} iframe`);
        await frame.scrollIntoViewIfNeeded();
        assert.equal(await frame.isVisible(), true);
        const box = (await frame.boundingBox())!;
        assert.ok(Math.abs(box.width / box.height - ratio) < .01, `${id}: ${JSON.stringify(box)}`);
        if (ratio < 1) {
          const section = (await page.locator(`#${id}`).boundingBox())!;
          assert.ok(Math.abs(box.width - (width <= 700 ? section.width : 360)) < 1);
          assert.ok(Math.abs(box.x + box.width/2 - width/2) < 1, 'Portrait stays centered');
        }
        measurements.push({engine:engine.name(),locale,surface,width,id,box});
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      for (const id of ['legacy-video','disclosure-portrait']) {
        await page.locator(`#${id} summary`).click();
        const frame = page.locator(`#${id} iframe`);
        assert.equal(await frame.isVisible(), true);
        const box = (await frame.boundingBox())!;
        assert.ok(Math.abs(box.width / box.height - (id === 'legacy-video' ? 16/9 : 9/16)) < .01);
        await page.locator(`#${id} summary`).click();
        assert.equal(await frame.isVisible(), false);
      }
      if (evidence && engine === chromium && locale === 'fr') {
        await mkdir(evidence,{recursive:true});
        await page.locator('#inline-portrait').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(evidence,`${surface}-${width}-portrait.png`)});
        await page.locator('#inline-landscape').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(evidence,`${surface}-${width}-landscape.png`)});
        await page.locator('#legacy-video').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(evidence,`${surface}-${width}-legacy.png`)});
      }
    }
    if (evidence) await writeFile(path.join(evidence,`${engine.name()}-geometry.json`),JSON.stringify(measurements,null,2));
  } finally {
    await browser?.close();
    await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
