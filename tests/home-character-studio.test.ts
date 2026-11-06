import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

for (const locale of ['en', 'fr', 'es']) {
  test(`home Character Studio ${locale}: published films are manual; unavailable films stay honest stills`, async () => {
    const f = await mountToolFixture(`import {HomeCharacterStudio} from './components/marketing/home/HomeCharacterStudio';function App(){return <HomeCharacterStudio locale="${locale}" films={[{key:'dixie',video:'https://media.maxvideoai.com/marketing-media/dixie.mp4',poster:'https://media.maxvideoai.com/marketing-media/dixie.webp'}]}/>}`, {
      'next/image': `import React from 'react';export default ({fill,priority,...p})=>React.createElement('img',p)`,
      '@/i18n/navigation': `import React from 'react';export const Link=({currentLocale,prefetch,href,...p})=>React.createElement('a',{...p,href:typeof href==='string'?href:href.pathname+'#'+href.hash})`,
      './HomeCharacterStudio.module.css': `export default new Proxy({},{get:(_,key)=>key})`,
    });
    try {
      const d = f.w.document;
      assert.equal(d.querySelectorAll('video').length, 1);
      const video = d.querySelector('video');
      assert.equal(video.getAttribute('preload'), 'none');
      assert.equal(video.autoplay, false);
      assert.equal(video.muted, false);
      assert.equal(d.querySelectorAll('figure').length, 2);
      assert.ok(d.querySelector('a[href="/app/tools/character-builder?mode=recast"]'));
      assert.ok(d.querySelector('a[href="/tools/character-builder"]'));
      assert.ok(d.querySelector('a[href="/examples#character-studio"]'));
      assert.match(d.querySelector('figure:last-of-type').textContent, /Still|Image extraite|Fotograma/);
      assert.ok([...d.querySelectorAll('img')].every((i: any) => i.getAttribute('loading') === 'lazy'));
    } finally { await f.close(); }
  });
}

test('home character proof streams below the opening without blocking the hero on the optional catalog', () => {
  const source = readFileSync('frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx', 'utf8');
  assert.match(source, /<Suspense fallback=\{<HomeCharacterStudio locale=\{locale\} \/>\}>\s*<HomeCharacterStudioProof locale=\{locale\} \/>/);
  assert.ok(source.indexOf('<HomeCharacterStudioProof') > source.indexOf('<HomeHero'));
});
