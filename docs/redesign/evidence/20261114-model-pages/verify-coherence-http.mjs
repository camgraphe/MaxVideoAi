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
    // Assemble React's streamed HTML segments without executing page scripts.
    // Video pricing resolves after the section shell, including individual table rows.
    for (let pass = 0; pass < 20; pass++) {
      let assembled = 0;
      for (const marker of doc.querySelectorAll('template[id^="P:"]')) {
        const segment = doc.getElementById(marker.id.replace('P:', 'S:'));
        if (!segment) continue;
        marker.replaceWith(...segment.childNodes);
        segment.remove();
        assembled++;
      }
      if (!assembled) break;
    }
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.equal(doc.querySelectorAll('.cinema-hero dialog, .cinema-hero details, .cinema-hero-caption a, .cinema-overview-detail a').length, 0);
    assert.ok(doc.querySelectorAll('.cinema-prompt-dialog p[lang=en]').length > 0, 'Original prompts stay in server HTML');
    assert.equal(doc.querySelector('.cinema-provenance-band'), null, 'No standalone provenance band between examples and prompting');
    // React streams delayed video details into separate HTML segments. Their final
    // section placement is checked in the browser; this verifies the SSR content.
    assert.ok(doc.querySelector('.cinema-hero-evidence dialog'), `${pathname}: hero evidence is server-rendered`);
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
    assert.ok(doc.querySelector('.cinema-spec-source a')?.href.endsWith(pathname + '#specs'), 'Reusable specifications cite the localized canonical page');
    assert.ok(doc.querySelector('.cinema-spec-table th[scope="row"]'), 'Specifications use a semantic server-rendered table');
    if (slug === 'seedream-5-5') {
      assert.equal(doc.querySelectorAll('#prompting .cinema-prompt-factors dt').length, 4);
      assert.ok(doc.querySelector('#prompting .cinema-prompt-excerpt')?.textContent.includes('MAKE YOUR MOVE'));
      assert.equal(doc.querySelectorAll('.cinema-settings-data > .cinema-spec-table tbody tr').length, 8);
      const benefits = [...doc.querySelectorAll('#overview .cinema-benefits a')];
      assert.equal(benefits.length, 4);
      for (const benefit of benefits) assert.ok(doc.querySelector(benefit.getAttribute('href')), 'Every benefit has a visible proof destination');
      assert.equal(doc.querySelectorAll('#top img').length, 1, 'The hero shows one optimized image without a redundant crop');
      assert.equal(doc.querySelectorAll('.cinema-overview-band').length, 0, 'No second opening');
      assert.ok(!galleryPaths.includes(displayPath(doc.querySelector('#top img'))), 'Overview scene is unique');
      assert.equal(doc.querySelectorAll('#overview video, #overview .cinema-detail-original').length, 0);
      assert.ok(doc.querySelector('#specs .cinema-hero-evidence .cinema-overview-source[href="https://seed.bytedance.com/en/seedream5_5"]'));
      for (const id of ['specs', 'decision-pricing', 'faq']) assert.equal(doc.getElementById(id).closest('[hidden]'), null);
      assert.ok(doc.querySelector('.cinema-detail-crop img'), 'Portrait crop is visible in initial HTML');
      assert.equal(assistant.pathname, '/app/image');
    } else {
      assert.equal(assistant.pathname, '/app');
      assert.equal(doc.querySelectorAll('.cinema-workflow-nav a').length, 3);
      assert.ok(doc.querySelector('#top #overview .cinema-hero-intro'));
      assert.equal(doc.querySelectorAll('.cinema-settings-data > .cinema-spec-table tbody tr').length, 10);
      assert.equal(doc.querySelectorAll('#examples .cinema-video-prompt').length, 3);
      assert.equal(doc.querySelectorAll('#prompting .cinema-video-prompt, #specs .cinema-video-prompt').length, 2);
      const faq = schemas.flatMap(schema => schema['@graph'] ?? [schema]).find(schema => schema['@type'] === 'FAQPage');
      assert.equal(faq.mainEntity.length, 9);
      for (const question of faq.mainEntity) assert.ok(doc.querySelector('#faq').textContent.includes(question.name), 'FAQ schema matches visible questions');
      assert.ok(doc.querySelectorAll('.cinema-settings-data details .cinema-spec-table tbody tr').length > 0);
      assert.deepEqual([...doc.querySelectorAll('.cinema-workflow-copy > a.cinema-button')].map(a => new URL(a.href, 'https://maxvideoai.com').searchParams.get('mode')), ['t2v', 'v2v', 'extend']);
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
