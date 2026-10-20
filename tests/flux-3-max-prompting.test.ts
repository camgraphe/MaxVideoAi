import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';
import { buildModelPromptingViewModel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model';
import { ModelDecisionPromptTabs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptTabs.client';
import { toFeaturedMedia } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

// Exact approved and generated English prompts, frozen before publication copy changes.
const approved = [
  ['action', 'db4e49bfc2fc0476cf1aa629a299d4a7046bb1bab5c623484999a71866b00205'],
  ['romance', '2c939d09ccd34fc5d23e6cdeef7ead09d5c653e0adab52b1d58f67fe679e8df7'],
  ['scifi', '69c64c38bad20d60fd8e76c680a9ad1b5aa80518282f7e335fb7276e2d13c908'],
  ['keyframes', '0f8f55d23eb4b919e6ca79739f4b23759d5853d55e5d562d6e476267a181e3dd'],
];
test('Max Prompt Lab uses the four exact rendered English recipes in all locales', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const doc = JSON.parse(readFileSync(`content/models/${locale}/flux-3-max.json`, 'utf8'));
    const content = parseModelPromptingContent(doc.prompting, 'flux-3-max', locale);
    assert.deepEqual(content.tabs.map(tab => [tab.id, createHash('sha256').update(tab.copy).digest('hex')]), approved);
    assert.ok(content.tabs.every(tab => tab.matchPublicExample === true));
    assert.deepEqual(content.tabNotes.map(note => note.tabId), approved.map(([id]) => id));
    assert.equal(content.demo!.prompt, content.tabs[2].copy);
    for (const tab of content.tabs) {
      const featured = toFeaturedMedia({
        id: `fixture-${tab.id}`, href: `/video/fixture-${tab.id}`, engineLabel: 'FLUX 3 Max',
        engineIconId: 'flux-3-max', priceLabel: null, prompt: 'A shortened card excerpt.', promptFull: tab.copy,
        aspectRatio: '16:9', durationSec: 16, hasAudio: true, videoUrl: `https://example.test/${tab.id}.mp4`,
      }, true);
      assert.equal(featured?.prompt, tab.copy, `${locale}/${tab.id} full featured prompt`);
    }
  }
});

test('each localized tab renders its complete prompt and its own public replay destination', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const doc = JSON.parse(readFileSync(`content/models/${locale}/flux-3-max.json`, 'utf8'));
    const content = parseModelPromptingContent(doc.prompting, 'flux-3-max', locale);
    const view = buildModelPromptingViewModel({
      content, locale, engineId: 'flux-3-max', modelSlug: 'flux-3-max', appGenerationEnabled: true,
      imageAnchorId: 'prompting', isVideoEngine: true, isImageEngine: false, supportsNativeAudio: true,
      demoPromptSource: 'media', defaultDemoPromptSource: 'media', demoMedia: null,
      defaultDemoPresentation: { audioBadgeLabel: '', altContext: '' }, referenceWorkflows: [],
      galleryVideos: content.tabs.map(tab => ({ id: `fixture-${tab.id}`, promptFull: tab.copy,
        videoUrl: `/${tab.id}.mp4`, href: `/video/fixture-${tab.id}`,
        recreateHref: `/app?engine=flux-3-max&from=fixture-${tab.id}` })),
    });
    for (const selected of view.tabs.items) {
      const tabs = [selected, ...view.tabs.items.filter(tab => tab !== selected)];
      const children = React.createElement(ModelDecisionPromptTabs, {
        tabs, labels: view.ui, notesById: view.tabs.notesById,
        exampleHref: '/video/wrong-shared-demo', usePromptHref: '/app?engine=wrong-shared-demo',
      });
      const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale, messages: {}, children }));
      const document = new JSDOM(html).window.document;
      assert.equal(document.querySelector('pre')?.textContent, selected.copy);
      const links = [...document.querySelectorAll('a')].map(link => new URL(link.href, 'https://example.test'));
      assert.ok(links.some(url => url.pathname.endsWith(`/video/fixture-${selected.id}`)));
      assert.ok(links.some(url => url.searchParams.get('from') === `fixture-${selected.id}`));
      assert.ok(links.every(url => !url.href.includes('wrong-shared-demo')));
      assert.ok(document.body.textContent?.includes(view.tabs.notesById[selected.id]));
      document.defaultView?.close();
    }
  }
});
