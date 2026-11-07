import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CHARACTER_STUDIO_ARTICLE_SLUGS } from '../frontend/lib/character-studio-marketing';
import { mountToolFixture } from './helpers/tool-selection-fixture';

const stubs = {
  '@/i18n/navigation': `import React from 'react';export const Link=({prefetch,...props})=>React.createElement('a',props);`,
  '@/lib/i18n/I18nProvider': `export const useOptionalI18n=()=>({locale:window.locale});`,
  'next/image': `import React from 'react';export default ({fill,...props})=>React.createElement('img',props);`,
};

for (const locale of ['en', 'fr', 'es']) test(`blog proof ${locale} preserves two honest stills until public video is available`, async () => {
  const fixture = await mountToolFixture(`
    import {CharacterStudioRecastExamples} from './src/components/tools/character-builder/landing/CharacterStudioRecastExamples.client';
    function App(){return <CharacterStudioRecastExamples films={window.films} showStills showLink ctaLocation="blog_character_studio"/>;}
  `, stubs, window => {
    window.locale = locale; window.films = []; window.plays = [];
    window.IntersectionObserver = class { observe(){} disconnect(){} };
    window.HTMLMediaElement.prototype.pause = () => {};
    window.HTMLMediaElement.prototype.load = () => {};
    window.HTMLMediaElement.prototype.play = function(){window.plays.push(this.src);return Promise.resolve();};
  });
  try {
    const doc = fixture.w.document;
    assert.equal(doc.querySelectorAll('figure').length, 2);
    assert.equal(doc.querySelectorAll('video').length, 0);
    assert.equal(doc.querySelectorAll('img[loading="lazy"]').length, 2);
    assert.ok([...doc.querySelectorAll('img')].every((image: any) => image.getAttribute('src').startsWith('/assets/')));
    const geometry = [...doc.querySelectorAll('figure > div')].map((node: any) => node.className);
    const link = doc.querySelector('a');
    assert.equal(link?.getAttribute('href'), '/app/tools/character-builder?mode=recast');
    assert.equal(link?.getAttribute('data-analytics-cta-location'), 'blog_character_studio');
    fixture.w.films = [{ key: 'dixie', video: 'https://media.maxvideoai.com/marketing-media/dixie/video.mp4', poster: '/dixie.webp' }];
    await fixture.render();
    assert.equal(doc.querySelectorAll('figure').length, 2, 'one published clip does not collapse the other frame');
    assert.deepEqual([...doc.querySelectorAll('figure > div')].map((node: any) => node.className), geometry);
    assert.equal(doc.querySelectorAll('video').length, 1);
    assert.equal(doc.querySelector('video')?.getAttribute('preload'), 'none');
    assert.equal(doc.querySelector('video')?.hasAttribute('autoplay'), false);
    assert.equal(doc.querySelectorAll('img[loading="lazy"]').length, 1);
    assert.deepEqual(fixture.w.plays, []);
    assert.deepEqual(fixture.w.requests, []);
    fixture.w.films = [];
    await fixture.render();
    assert.equal(doc.querySelector('video'), null);
    assert.equal(doc.querySelectorAll('figure').length, 2);
  } finally { await fixture.close(); }
});

test('character blog proof has a scoped nonblocking boundary and no private media fallback', () => {
  const owner = readFileSync('frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_components/blog-character-studio-proof.tsx', 'utf8');
  const view = readFileSync('frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_components/blog-post-view.tsx', 'utf8');
  assert.deepEqual(CHARACTER_STUDIO_ARTICLE_SLUGS, ['ai-character-sheet-generator', 'how-to-create-consistent-ai-characters']);
  assert.match(owner, /new Set\(CHARACTER_STUDIO_ARTICLE_SLUGS\)/);
  assert.match(owner, /if \(!CHARACTER_ARTICLES\.has\(canonicalSlug\)\) return null/);
  assert.match(owner, /<Suspense fallback=\{<CharacterStudioRecastExamples films=\{\[\]\}/);
  assert.match(owner, /<CharacterStudioPublicFilms locale=\{locale\} showLink showStills/);
  assert.doesNotMatch(owner, /await|media_assets|app_jobs|renders\/|https:\/\//);
  assert.doesNotMatch(view, /await getCharacterStudioMarketingVideos/);
  assert.ok(view.indexOf('<BlogWalkthrough') < view.indexOf('<BlogCharacterStudioProof'));
});
