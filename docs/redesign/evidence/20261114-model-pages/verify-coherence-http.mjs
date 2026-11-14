import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

// Run from this checkout against the local production candidate; no application DB required.
const require = createRequire(new URL('../../../../package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const results = [];
for (const slug of ['seedream-5-5', 'seedance-2-5-flash']) {
  for (const [locale, prefix] of [['en', '/models/'], ['fr', '/fr/modeles/'], ['es', '/es/modelos/']]) {
    const pathname = prefix + slug;
    const response = await fetch('http://localhost:3116' + pathname);
    assert.equal(response.status, 200, pathname);
    const doc = new JSDOM(await response.text()).window.document;
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.equal(doc.querySelector('link[rel="canonical"]').href, 'https://maxvideoai.com' + pathname);
    const hreflang = [...doc.querySelectorAll('link[rel="alternate"][hreflang]')].map(el => el.hreflang);
    assert.deepEqual(hreflang.sort(), ['en', 'es', 'fr', 'x-default']);
    const schemas = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(el => JSON.parse(el.textContent));
    assert.ok(schemas.length > 0);
    assert.ok(!JSON.stringify(schemas).includes('"VideoObject"'), 'Start frames are not completed videos');
    for (const id of ['examples', 'prompting', 'specs', 'decision-pricing', 'faq', 'compare']) assert.ok(doc.getElementById(id), id);
    const promptImage = doc.querySelector('.cinema-prompt-proof img');
    const settingsImage = doc.querySelector('.cinema-settings-proof img');
    assert.ok(promptImage && settingsImage);
    assert.notEqual(promptImage.src, settingsImage.src);
    const displayPath = img => new URL(img.src, 'http://localhost:3116').searchParams.get('url');
    const galleryPaths = [...doc.querySelectorAll('#examples img')].map(displayPath);
    assert.ok(!galleryPaths.includes(displayPath(promptImage)), 'Prompt scene is not repeated in the gallery');
    assert.ok(!galleryPaths.includes(displayPath(settingsImage)), 'Settings scene is not repeated in the gallery');
    const pricing = doc.getElementById('decision-pricing');
    assert.ok(!/Live quote|Devis en direct|Cotización en directo/.test(pricing.textContent));
    const assistant = new URL(doc.querySelector('#prompting .cinema-prompt-assistant a').href, 'https://maxvideoai.com');
    assert.equal(assistant.searchParams.get('assistant'), 'milo');
    assert.equal(assistant.searchParams.get('engine'), slug);
    assert.equal(assistant.searchParams.get('lang'), locale);
    assert.equal(assistant.searchParams.has('prompt'), false);
    if (slug === 'seedream-5-5') {
      for (const id of ['specs', 'decision-pricing', 'faq']) assert.equal(doc.getElementById(id).closest('[hidden]'), null);
      assert.ok(doc.querySelector('.cinema-detail-crop img'), 'Portrait crop is visible in initial HTML');
      assert.equal(assistant.pathname, '/app/image');
    } else {
      assert.equal(assistant.pathname, '/app');
      assert.equal(doc.querySelectorAll('.cinema-settings-data > .cinema-spec-grid > div').length, 8);
      assert.ok(doc.querySelectorAll('.cinema-settings-data details .cinema-spec-grid > div').length > 0);
      assert.deepEqual([...doc.querySelectorAll('.cinema-path-body a')].map(a => new URL(a.href, 'https://maxvideoai.com').searchParams.get('mode')), ['t2v', 'extend', 'v2v']);
    }
    results.push({ pathname, status: response.status, h1: doc.querySelector('h1').textContent, hreflang, schemas: schemas.length, dedicatedPromptAndSettingsMedia: true, quotePlaceholders: 0, assistant: assistant.pathname + assistant.search });
  }
}
for (const pathname of ['/en/models/seedream-5-5', '/fr/models/seedance-2-5-flash']) {
  const response = await fetch('http://localhost:3116' + pathname, { redirect: 'manual' });
  assert.ok([301, 302, 307, 308].includes(response.status));
  results.push({ pathname, status: response.status, location: response.headers.get('location') });
}
const sitemap = await fetch('http://localhost:3116/sitemap-models.xml');
assert.equal(sitemap.status, 200);
const xml = await sitemap.text();
for (const result of results.slice(0, 6)) assert.ok(xml.includes('https://maxvideoai.com' + result.pathname));
results.push({ modelsSitemap: 'All six localized pilot URLs present', status: sitemap.status });
writeFileSync('/private/tmp/cinematic-coherence-http.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
