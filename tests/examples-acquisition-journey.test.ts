import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { buildExamplesNextStepLinks, getExamplesMainVideoCopy } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy';
import { getExampleReuseCopy } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/example-reuse-copy';
import { getCanonicalCompareSlug, resolveEngines } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-helpers';
import { resolveWorkspaceRequestParams } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-hydration';
import { safeInternalReturnTarget } from '../frontend/lib/auth-return-target';
import { createAnalyticsJourneyRecord, prepareJourneyEvents } from '../frontend/lib/analytics/journey';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

for (const locale of ['en', 'fr', 'es'] as const) {
  test(`${locale}: the featured example has an explicit creation action and a separate evidence link`, async () => {
    const require = createRequire(import.meta.url);
    const previous = require.extensions['.css'];
    require.extensions['.css'] = () => {};
    let ExamplesMainVideoFeature;
    try {
      ({ ExamplesMainVideoFeature } = await import('../frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-main-video-feature'));
    } finally {
      if (previous) require.extensions['.css'] = previous;
      else delete require.extensions['.css'];
    }
    const recreateHref = '/app?from=public-example';
    const dom = new JSDOM(renderToStaticMarkup(React.createElement(ExamplesMainVideoFeature, {
      aspectRatio: '16 / 9', contentUrl: 'https://media.maxvideoai.com/example.mp4',
      copy: getExamplesMainVideoCopy(locale, 'ltx'), durationSec: 6, engineLabel: 'LTX 2.5 Pro',
      exampleHref: '/video/public-example', recreateHref, hasAudio: true, heroLine: 'LTX 2.5 Pro',
      isPortrait: false, locale, mimeType: 'video/mp4', modelHref: '/models/ltx-2-5-pro',
      poster: '/poster.jpg', promptFull: 'A train at night', title: 'Example',
    })));
    try {
      const document = dom.window.document;
      const reuse = document.querySelector('a[data-analytics-cta-name="reuse_example"]');
      assert.equal(reuse?.getAttribute('href'), recreateHref);
      assert.ok(reuse?.textContent?.includes(getExampleReuseCopy(locale).cta));
      assert.equal(document.querySelectorAll(`a[href="${recreateHref}"]`).length, 1);
      assert.equal(document.querySelector('a[data-analytics-cta-name="view_example_details"]')?.getAttribute('href'), '/video/public-example');
      assert.ok(document.body.textContent?.includes(getExampleReuseCopy(locale).hint));
      assert.equal(document.querySelector('video'), null, 'creation CTA must not mount an eager video');
      assert.equal(document.querySelectorAll('img[fetchpriority="high"]').length, 1);
    } finally { dom.window.close(); }
  });

  test(`${locale}: priority gallery comparisons resolve published model pairs`, () => {
    for (const family of ['ltx', 'kling', 'seedance', 'veo', 'hailuo', 'wan']) {
      const links = buildExamplesNextStepLinks({
        appLocale: locale, locale, familySlug: family, pricingPath: '/pricing',
        isLtxLanding: family === 'ltx', isKlingLanding: family === 'kling',
        isSeedanceLanding: family === 'seedance', isVeoLanding: family === 'veo',
      });
      assert.equal(new Set(links.map(link => link.href)).size, links.length);
      for (const link of links) {
        const slug = link.href.split('/').pop()!;
        const resolved = getCanonicalCompareSlug(slug);
        assert.ok(resolved, link.href);
        assert.ok(resolveEngines(resolved.canonicalSlug), link.href);
        assert.ok(link.href.startsWith(locale === 'en' ? '/ai-video-engines/' : `/${locale}/`));
      }
      if (family === 'ltx') {
        assert.match(links[0].href, /ltx-2-5/);
        assert.ok(links.some(link => link.href.includes('ltx-2-3')), 'older examples retain an onward comparison');
      }
      if (family === 'seedance') assert.match(links[0].href, /seedance-2-5/);
    }
  });
}

test('the selected example survives workspace and login return-target normalization', () => {
  const request = resolveWorkspaceRequestParams(new URLSearchParams({ from: 'public-example' }), '/app');
  const login = new URL(`https://maxvideoai.com/login?next=${encodeURIComponent(request.loginRedirectTarget)}`);
  const returnTarget = safeInternalReturnTarget(login.searchParams.get('next'));
  const restored = resolveWorkspaceRequestParams(new URL(returnTarget, 'https://maxvideoai.com').searchParams, '/app');
  assert.equal(restored.fromVideoId, request.fromVideoId);
  assert.equal(returnTarget, '/app?from=public-example');
});

test('example funnel clicks keep bounded labels and never report prompt or media URLs', () => {
  const record = createAnalyticsJourneyRecord({
    journeyId: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9', now: 100,
    touch: { source: 'google', medium: 'organic', referrerHost: 'www.google.com', landingRouteFamily: 'marketing', landingSurface: '/examples', locale: 'fr' },
  });
  for (const location of ['examples_hero', 'examples_gallery', 'watch_hero', 'watch_sidebar']) {
    const result = prepareJourneyEvents(record, 'cta_click', {
      cta_name: location === 'examples_gallery' ? 'view_example_details' : 'reuse_example',
      cta_location: location, target_family: 'workspace', prompt: 'private prompt',
      href: '/app?from=private-id', video_url: 'https://private.example/video.mp4',
    }, 200);
    const event = result.events.find(item => item.event === 'cta_click');
    assert.equal(event?.payload.cta_location, location);
    assert.ok(event?.payload.cta_name);
    assert.equal(event?.payload.target_family, 'workspace');
    assert.equal(event?.payload.journey_locale, 'fr');
    assert.doesNotMatch(JSON.stringify(result.events), /private/);
  }
});
