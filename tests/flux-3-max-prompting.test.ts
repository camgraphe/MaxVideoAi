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

// Exact submitted English prompts for the user's final selection: films 12, 18, 09 and 10.
const approved = [
  ['action', '9125bd6756c8dcd11eb06417be385205f9610a08273e69cd64bf266be48d238b'],
  ['romance', '36fa5d96048bd6312ca4d5e051637f0459b6bc5099c8fab52b6655de7ea87663'],
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
    assert.equal(content.demo!.prompt, content.tabs[1].copy);
    assert.equal(content.demo!.title, content.tabs[1].title);
    assert.equal(content.demo!.presentationOverrides.duration, '18 s');
    assert.equal(content.demo!.presentationOverrides.audioChipMode, 'media');
    assert.match(content.demo!.summary.output, /18.*16:9.*720p/);
    for (const [index, duration] of [14, 18, 16, 16].entries()) {
      assert.match(content.tabNotes[index].body, new RegExp(`\\b${duration}\\b`));
      assert.match(content.tabNotes[index].body, /16:9.*720p/);
    }
    assert.match(content.tabNotes[3].body, /0, 192.*384.*24/);
    for (const tab of content.tabs) {
      const featured = toFeaturedMedia({
        id: `fixture-${tab.id}`, href: `/video/fixture-${tab.id}`, engineLabel: 'FLUX 3 Max',
        engineIconId: 'flux-3-max', priceLabel: null, prompt: 'A shortened card excerpt.', promptFull: tab.copy,
        aspectRatio: '16:9', durationSec: tab.id === 'action' ? 14 : tab.id === 'romance' ? 18 : 16,
        hasAudio: true, videoUrl: `https://example.test/${tab.id}.mp4`,
      }, true);
      assert.equal(featured?.prompt, tab.copy, `${locale}/${tab.id} full featured prompt`);
    }
  }
});

test('the selected romance demo retains its exact prompt and localized title with the real media settings', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const doc = JSON.parse(readFileSync(`content/models/${locale}/flux-3-max.json`, 'utf8'));
    const content = parseModelPromptingContent(doc.prompting, 'flux-3-max', locale);
    const romance = content.tabs.find(tab => tab.id === 'romance')!;
    const view = buildModelPromptingViewModel({
      content, locale, engineId: 'flux-3-max', modelSlug: 'flux-3-max', appGenerationEnabled: true,
      imageAnchorId: 'prompting', isVideoEngine: true, isImageEngine: false, supportsNativeAudio: true,
      demoPromptSource: 'media', defaultDemoPromptSource: 'media',
      demoMedia: {
        id: 'fixture-film-18', label: 'FLUX 3 Max', prompt: romance.copy, durationSec: 18,
        aspectRatio: '16:9', hasAudio: true, videoUrl: '/film-18.mp4', posterUrl: '/film-18.jpg',
        href: '/video/fixture-film-18',
      },
      defaultDemoPresentation: { audioBadgeLabel: '', altContext: '' }, referenceWorkflows: [],
    });
    assert.equal(view.demo?.title, romance.title);
    assert.equal(view.demo?.prompt, romance.copy);
    assert.equal(view.demo?.durationLabel, locale === 'en' ? '18s' : '18 s');
    assert.equal(view.demo?.aspectLabel, '16:9');
    assert.equal(view.demo?.audioChipLabel, view.ui.audioOn);
    assert.equal(view.demo?.videoSrc, '/film-18.mp4');
    assert.equal(view.demo?.fullHref, '/video/fixture-film-18');
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
