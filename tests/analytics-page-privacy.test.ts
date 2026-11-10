import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { prepareBrowserAnalyticsEvents } from '../frontend/lib/analytics/journey-browser';
import { ANALYTICS_JOURNEY_STORAGE_KEY } from '../frontend/lib/analytics/journey-contract';
import { sendPreparedAnalyticsEvents } from '../frontend/lib/analytics/ordered-events';

function withPage(href: string, run: (window: Window) => void) {
  const dom = new JSDOM('<html lang="fr"><title>Private customer project</title></html>', {
    url: href,
    referrer: 'https://smithery.ai/server/maxvideoai?token=private-referrer',
  });
  const descriptors = ['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  (dom.window as unknown as Window).__mvaiCommercialAnalyticsPending = false;
  dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
  dom.window.document.cookie = `mv-consent=${encodeURIComponent(JSON.stringify({
    version: '2026-07', timestamp: Date.now(), categories: { analytics: true, ads: false }, source: 'preferences',
  }))}; path=/`;
  try { run(dom.window as unknown as Window); } finally {
    dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test('the final GA payload retains safe page context after projection and parameter budgeting', () => {
  for (const [href, expectedPath] of [
    ['https://maxvideoai.com/app/studio/conversation/project_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?secret=private-query#private-hash', '/app/studio'],
    ['https://maxvideoai.com/billing?session_id=private-query', '/billing'],
    ['https://maxvideoai.com/auth/callback?code=private-query', '/login'],
    ['https://maxvideoai.com/fr/blog/my-public-guide?utm_source=google', '/fr/blog/my-public-guide'],
    ['https://maxvideoai.com/es/modelos/veo-3-1?utm_source=google', '/es/modelos/veo-3-1'],
    ['https://maxvideoai.com/tools/subtitles?asset=private-query', '/tools/subtitles'],
    ['https://maxvideoai.com/tools/project_private?asset=private-query', '/tools'],
    ['https://maxvideoai.com/es/herramientas/character-builder?asset=private-query', '/es/herramientas/character-builder'],
    ['https://maxvideoai.com/fr/outils/project_private?asset=private-query', '/tools'],
  ]) {
    withPage(href, () => {
      const events = prepareBrowserAnalyticsEvents('page_view', {
        page_location: href, page_title: 'Private customer project', route_family: 'workspace',
        workspace_section: 'studio',
      });
      assert.ok(events.length > 0);
      const calls: Record<string, unknown>[] = [];
      sendPreparedAnalyticsEvents((_command, _name, payload) => calls.push(payload as Record<string, unknown>), events);
      for (const payload of calls) {
        assert.equal(payload.page_location, `https://maxvideoai.com${expectedPath}`);
        assert.equal(payload.page_path, expectedPath);
        assert.equal(payload.page_referrer, 'https://smithery.ai/');
        assert.doesNotMatch(JSON.stringify(payload), /private-query|private-hash|private-referrer|Private customer|project_aaaaaaaa/);
        assert.ok(Object.keys(payload).length <= 25);
      }
    });
  }
});

test('excluded routes cannot prepare or send queued GA events', () => {
  withPage('https://maxvideoai.com/admin/transactions', () => {
    assert.deepEqual(prepareBrowserAnalyticsEvents('cta_click', { route_family: 'marketing' }), []);
    const calls: unknown[][] = [];
    sendPreparedAnalyticsEvents((...args) => calls.push(args), [{ event: 'page_view', payload: {} }]);
    assert.deepEqual(calls, []);
  });
});

const comparisonCampaign = 'utm_source=reddit&utm_medium=organic_social&utm_campaign=community_pilot&utm_content=mcp_quote';

test('Higgsfield comparison page views and CTAs retain only bounded attribution across locales', () => {
  const comparisonCtas = [
    ['higgsfield_price_project', 'comparison_hero'],
    ['higgsfield_price_project', 'comparison_footer'],
    ['higgsfield_download_comparison', 'comparison_share'],
    ['higgsfield_character_studio', 'comparison_character_proof'],
  ] as const;
  for (const locale of ['en', 'fr', 'es']) {
    const pagePath = `${locale === 'en' ? '' : `/${locale}`}/higgsfield-alternative`;
    const pageUrl = `https://maxvideoai.com${pagePath}`;
    withPage(`${pageUrl}?${comparisonCampaign}&token=private-query#private-hash`, window => {
      window.document.documentElement.lang = locale;
      const events = [
        ...prepareBrowserAnalyticsEvents('page_view', { route_family: 'marketing' }),
        ...comparisonCtas.flatMap(([cta_name, cta_location]) => prepareBrowserAnalyticsEvents('cta_click', {
          route_family: 'marketing', cta_name, cta_location,
        })),
      ];
      const calls: { event: string; payload: Record<string, unknown> }[] = [];
      sendPreparedAnalyticsEvents((_command, event, payload) => calls.push({ event, payload: payload as Record<string, unknown> }), events);
      const view = calls.find(call => call.event === 'page_view')?.payload;
      assert.equal(view?.page_location, pageUrl);
      assert.equal(view?.page_path, pagePath);
      assert.equal(view?.landing_surface, '/higgsfield-alternative');
      assert.equal(view?.journey_locale, locale);
      assert.equal(view?.campaign_source, 'reddit');
      assert.equal(view?.campaign_medium, 'organic_social');
      assert.equal(view?.campaign_name, 'community_pilot');
      assert.equal(view?.campaign_content, 'mcp_quote');
      const ctas = calls.filter(call => call.event === 'cta_click').map(call => call.payload);
      assert.deepEqual(ctas.map(payload => [payload.cta_name, payload.cta_location]), comparisonCtas);
      assert.ok(ctas.every(payload => payload.page_location === pageUrl && payload.landing_surface === '/higgsfield-alternative'));
      const stored = window.localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY);
      assert.ok(stored);
      assert.doesNotMatch(JSON.stringify(calls) + stored, /private-query|private-hash|private-referrer/);
    });
  }
});

test('OpenArt and project-budget CTAs retain their bounded names and public landing owner', () => {
  const entries = [
    ['/openart-alternative', 'openart_price_shot', 'openart_hero', '/openart-alternative'],
    ['/fr/openart-alternative', 'openart_price_shot', 'openart_footer', '/openart-alternative'],
    ['/es/blog/coste-proyecto-video-ia', 'project_cost_configure', 'project_cost_article', '/blog'],
    ['/fr/blog/cout-projet-video-ia', 'project_cost_configure', 'project_cost_scenario', '/blog'],
    ['/fr/blog/comparer-plateformes-video-ia', 'platform_guide_configure', 'platform_guide_budget', '/blog'],
  ] as const;
  for (const [path, name, location, surface] of entries) {
    withPage(`https://maxvideoai.com${path}?${comparisonCampaign}&prompt=private-query`, () => {
      const events = prepareBrowserAnalyticsEvents('cta_click', { route_family: 'marketing', cta_name: name, cta_location: location });
      const calls: Record<string, unknown>[] = [];
      sendPreparedAnalyticsEvents((_command, event, payload) => {
        if (event === 'cta_click') calls.push(payload as Record<string, unknown>);
      }, events);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].cta_name, name);
      assert.equal(calls[0].cta_location, location);
      assert.equal(calls[0].landing_surface, surface);
      assert.equal(calls[0].campaign_source, 'reddit');
      assert.doesNotMatch(JSON.stringify(calls), /private-query/);
    });
  }
});

test('the comparison campaign and its CTA do not create GA events or storage without consent', () => {
  withPage(`https://maxvideoai.com/higgsfield-alternative?${comparisonCampaign}`, window => {
    window.localStorage.removeItem('mv-consent-analytics');
    window.document.cookie = 'mv-consent=; Max-Age=0; path=/';
    assert.deepEqual(prepareBrowserAnalyticsEvents('cta_click', {
      route_family: 'marketing', cta_name: 'higgsfield_price_project', cta_location: 'comparison_hero',
    }), []);
    assert.equal(window.localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY), null);
  });
});

test('queued events keep their safe observed page when navigation precedes delivery', () => {
  withPage('https://maxvideoai.com/pricing?token=private-query', window => {
    const events = prepareBrowserAnalyticsEvents('cta_click', { cta_name: 'start', route_family: 'marketing' });
    window.history.pushState(null, '', '/app/studio/conversation/project_private');
    const calls: Record<string, unknown>[] = [];
    sendPreparedAnalyticsEvents((_command, _name, payload) => calls.push(payload as Record<string, unknown>), events);
    assert.ok(calls.length > 0);
    assert.ok(calls.every(payload => payload.page_location === 'https://maxvideoai.com/pricing'));
  });
});

test('private URL overrides cannot enter the final transport through an already prepared payload', () => {
  withPage('https://maxvideoai.com/app/studio', () => {
    const diagnostics = Object.fromEntries(Array.from({ length: 35 }, (_, i) => [`diagnostic_${i}`, i]));
    let sent: Record<string, unknown> = {};
    sendPreparedAnalyticsEvents((_command, _event, payload) => { sent = payload as Record<string, unknown>; }, [{
      event: 'generation_completed',
      payload: {
        ...diagnostics, page_location: 'https://maxvideoai.com/app/studio/conversation/private?token=private-query',
        page_title: 'Private customer project', page_referrer: 'https://smithery.ai/private?token=private-query',
        first_touch_source: 'smithery.ai', last_touch_source: 'smithery.ai',
      },
    }]);
    assert.equal(sent.page_location, 'https://maxvideoai.com/app/studio');
    assert.equal(sent.page_referrer, 'https://smithery.ai/');
    assert.equal(sent.first_touch_source, 'smithery.ai');
    assert.ok(Object.keys(sent).length <= 25);
    assert.doesNotMatch(JSON.stringify(sent), /private|Private/);
  });
});

test('cleaning campaign URLs preserves approved native GA acquisition fields without leaking other query values', () => {
  withPage('https://maxvideoai.com/pricing?utm_source=google&utm_medium=cpc&utm_campaign=Launch&utm_content=Hero&email=private-query', () => {
    const events = prepareBrowserAnalyticsEvents('page_view', { route_family: 'marketing' });
    const calls: Record<string, unknown>[] = [];
    sendPreparedAnalyticsEvents((_command, _name, payload) => calls.push(payload as Record<string, unknown>), events);
    for (const payload of calls) {
      assert.equal(payload.page_location, 'https://maxvideoai.com/pricing');
      assert.equal(payload.campaign_source, 'google');
      assert.equal(payload.campaign_medium, 'cpc');
      assert.equal(payload.campaign_name, 'Launch');
      assert.equal(payload.campaign_content, 'Hero');
      assert.doesNotMatch(JSON.stringify(payload), /private-query/);
    }
  });
});

test('the source-only ChatGPT tag survives URL cleaning without inventing a medium or accepting free query text', () => {
  withPage('https://maxvideoai.com/?utm_source=chatgpt.com&email=private-query', () => {
    const calls: Record<string, unknown>[] = [];
    sendPreparedAnalyticsEvents((_command, _name, payload) => calls.push(payload as Record<string, unknown>),
      prepareBrowserAnalyticsEvents('page_view', { route_family: 'marketing' }));
    assert.equal(calls.at(-1)?.campaign_source, 'chatgpt.com');
    assert.equal(calls.at(-1)?.campaign_medium, undefined);
    assert.equal(calls.at(-1)?.page_location, 'https://maxvideoai.com/');
    assert.doesNotMatch(JSON.stringify(calls), /private-query/);
  });
});
