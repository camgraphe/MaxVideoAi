import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

test('Clarity separates storage consent, excludes admins and forwards only safe canonical event names', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'clarity-measurement-'));
  const output = join(directory, 'client.cjs');
  const dom = new JSDOM('', { url: 'https://maxvideoai.com/mcp' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  try {
    await build({
      stdin: { contents: "export * from './frontend/src/lib/clarity-client'; export * from './frontend/lib/analytics/clarity-context'; export {sendPreparedAnalyticsEvents} from './frontend/lib/analytics/ordered-events';", resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
      define: { 'process.env.NEXT_PUBLIC_ENABLE_CLARITY': '"true"', 'process.env.NEXT_PUBLIC_CLARITY_ALLOWED_HOSTS': '"maxvideoai.com"', 'process.env.NODE_ENV': '"production"' },
    });
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document })) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    const client = require(output);
    const commands: unknown[][] = [];
    (dom.window as unknown as { clarity: (...args: unknown[]) => void }).clarity = (...args) => commands.push(args);
    client.setClarityConsent(true, false);
    assert.deepEqual(commands, [['consentv2', { analytics_Storage: 'granted', ad_Storage: 'denied' }]], 'analytics acceptance cannot grant ads through the legacy API');
    commands.length = 0;
    client.setClarityConsent(false, true);
    assert.deepEqual(commands, [['consentv2', { analytics_Storage: 'denied', ad_Storage: 'granted' }]]);

    dom.window.sessionStorage.setItem('mvai.analytics-excluded-admin.v1', '1');
    assert.equal(client.isClarityEnabledForRuntime(), false, 'persisted authoritative admin exclusion applies before SDK injection');
    dom.window.sessionStorage.removeItem('mvai.analytics-excluded-admin.v1');
    client.recordClarityAnalyticsEvent('topup_completed', { job_id: 'private-id', value: 123, email: 'private@example.test' });
    assert.equal(commands.length, 1, 'events require analytics consent');
    client.setAnalyticsConsentCookie(true);
    client.recordClarityAnalyticsEvent('topup_completed', { job_id: 'private-id', value: 123, email: 'private@example.test' });
    assert.deepEqual(commands.at(-1), ['event', 'mvai_topup_completed'], 'no payload, amount, identity or arbitrary strings go to Clarity');
    client.recordClarityAnalyticsEvent('private@example.test', {});
    assert.equal(commands.length, 2, 'unknown event names are rejected');
    (dom.window as unknown as { __mvaiCommercialAnalyticsExcluded: boolean }).__mvaiCommercialAnalyticsExcluded = true;
    client.recordClarityAnalyticsEvent('generation_completed', {});
    assert.equal(commands.length, 2, 'resolved DB admin cannot emit events');

    assert.deepEqual(client.getClarityPageTags('/fr/ai-video-engines/veo-vs-kling?email=private@example.test#private'), {
      page: '/ai-video-engines/veo-vs-kling', page_category: 'comparisons', page_locale: 'fr', route_family: 'marketing',
    });
    assert.equal(client.getClarityPageTags('/oauth/consent?code=secret'), null);
    assert.equal(client.getClarityPageTags('/app/studio/private-project?token=secret'), null);
    assert.equal(client.getClarityPageTags('/v/private-video-id'), null);
    assert.equal(client.getClarityPageTags('/s/private-share-token'), null);
    assert.equal(client.getClarityPageTags('/fr/mcp/reference-upload/private-upload-token'), null);

    // A loaded SDK must actually receive stop; deleting its script alone leaves its observers alive.
    (dom.window as unknown as { __mvaiCommercialAnalyticsExcluded: boolean }).__mvaiCommercialAnalyticsExcluded = false;
    commands.length = 0;
    client.injectClarityScript('fixture-project');
    dom.window.document.querySelector('script')!.dispatchEvent(new dom.window.Event('load'));
    (dom.window as unknown as { __mvaiCommercialAnalyticsExcluded: boolean }).__mvaiCommercialAnalyticsExcluded = true;
    dom.window.dispatchEvent(new dom.window.Event('mvai:commercial-analytics-resolved'));
    assert.ok(commands.some((command) => command[0] === 'stop'));
    assert.equal(client.isClarityReady(), false);
    commands.length = 0;
    client.queueClarityCommand('identify', 'private-id');
    assert.equal(commands.length, 0, 'excluded visitors cannot bypass guards through the generic command API');
    (dom.window as unknown as { __mvaiCommercialAnalyticsExcluded: boolean }).__mvaiCommercialAnalyticsExcluded = false;
    client.setClarityConsent(true, false);
    client.injectClarityScript('fixture-project');
    assert.ok(commands.some((command) => command[0] === 'start'), 'eligible public re-entry resumes the same SDK');
    assert.equal(document.querySelectorAll('script[src*="clarity.ms/tag/"]').length, 1, 'restoration cannot double-inject the SDK');
    assert.equal(client.isClarityReady(), true);
    commands.length = 0;
    const batch = [{ event: 'studio_entered', payload: {} }, { event: 'generation_completed', payload: { job_id: 'private-id' } }];
    const first = client.sendPreparedAnalyticsEvents((_kind: string, event: string) => { if (event === 'generation_completed') throw new Error('fixture'); }, batch);
    assert.equal(first, 1);
    assert.deepEqual(commands, [['event', 'mvai_studio_entered']], 'failed GA sends do not mirror speculative success');
    assert.equal(client.sendPreparedAnalyticsEvents(() => {}, batch, first), 2);
    assert.deepEqual(commands, [['event', 'mvai_studio_entered'], ['event', 'mvai_generation_completed']], 'retry mirrors only the unsent suffix');
    dom.window.dispatchEvent(new dom.window.CustomEvent('consent:updated', { detail: { categories: { analytics: false, ads: false } } }));
    assert.equal(client.isClarityReady(), false, 'withdrawal stops a SDK even when its React loader is already unmounted');

    // Model the vendor's dispatcher replacement. Its consentv2 denial schedules
    // an asynchronous restart; sending stop to a captured old function is unsafe.
    let active = true;
    const deferredRestarts: (() => void)[] = [];
    const sdkWindow = dom.window as unknown as { clarity: ((...args: unknown[]) => void) & { q?: unknown[][] } };
    const setupQueue = () => {
      const stub = Object.assign((...args: unknown[]) => {
        stub.q.push(args);
        if (args[0] === 'start') {
          const queued = stub.q.splice(0);
          sdkWindow.clarity = vendor;
          active = true;
          queued.filter((command) => command[0] !== 'start').forEach((command) => vendor(...command));
        }
      }, { q: [] as unknown[][] });
      sdkWindow.clarity = stub;
    };
    const vendor = (...args: unknown[]) => {
      if (args[0] === 'stop') { active = false; setupQueue(); }
      if (args[0] === 'consentv2' && (args[1] as { analytics_Storage: string }).analytics_Storage === 'denied') {
        active = false;
        setupQueue();
        deferredRestarts.push(() => { active = true; sdkWindow.clarity = vendor; });
      }
    };
    sdkWindow.clarity = vendor;
    client.injectClarityScript('fixture-project');
    document.cookie = '_clck=host-cookie; Path=/';
    document.cookie = '_clsk=domain-cookie; Path=/; Domain=.maxvideoai.com';
    dom.window.dispatchEvent(new dom.window.CustomEvent('consent:updated', { detail: { categories: { analytics: false, ads: false } } }));
    client.setClarityConsent(false, false); // The CMP's subsequent callback.
    deferredRestarts.forEach((restart) => restart());
    assert.equal(active, false, 'vendor restart cannot revive a withdrawn session');
    assert.equal(deferredRestarts.length, 0, 'withdrawal must never schedule the vendor consent restart');
    assert.deepEqual(sdkWindow.clarity.q, [], 'the stopped dispatcher cannot replay stale identities or consent');
    assert.doesNotMatch(document.cookie, /_clck=|_clsk=|mv-clarity-id=/, 'host and parent-domain vendor/visitor cookies are removed');
  } finally {
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    await rm(directory, { recursive: true, force: true });
  }
});

test('public loader restores a stored admin only after eligibility, stops during SDK loading, and regrants actual CMP choices', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'clarity-loader-'));
  const output = join(directory, 'loader.cjs');
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.com/fr/mcp?code=private' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const frontendRequire = createRequire(join(process.cwd(), 'frontend/package.json'));
  let root: ReturnType<typeof createRoot> | undefined;
  try {
    await build({
      stdin: { contents: "export {Clarity} from './frontend/components/analytics/Clarity'; export {setClarityConsent,isClarityReady} from './frontend/src/lib/clarity-client';", resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', tsconfig: 'frontend/tsconfig.json',
      define: { 'process.env.NEXT_PUBLIC_ENABLE_CLARITY': '"true"', 'process.env.NEXT_PUBLIC_CLARITY_ALLOWED_HOSTS': '"maxvideoai.com"', 'process.env.NEXT_PUBLIC_CLARITY_ID': '"fixture-project"', 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'runtime-boundaries', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path === 'next/navigation') return { path: args.path, namespace: 'route' };
          if (args.path === 'react' || args.path.startsWith('react/')) return { path: require.resolve(args.path), external: true };
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) return { path: frontendRequire.resolve(args.path), external: true };
        });
        builder.onLoad({ filter: /.*/, namespace: 'route' }, () => ({ contents: 'export const usePathname=()=>window.location.pathname;', loader: 'js' }));
      } }],
    });
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    const writeConsent = (analytics: boolean, ads: boolean) => {
      document.cookie = `mv-consent=${encodeURIComponent(JSON.stringify({ version: 'fixture', timestamp: Date.now(), categories: { analytics, ads }, source: 'banner' }))}; Path=/`;
    };
    const sdkWindow = dom.window as unknown as { clarity: ((...args: unknown[]) => void) & { q?: unknown[][] }; __mvaiCommercialAnalyticsExcluded: boolean };
    writeConsent(true, false);
    dom.window.sessionStorage.setItem('mvai.analytics-excluded-admin.v1', '1');
    const client = require(output);
    root = createRoot(document.getElementById('root')!);
    await act(async () => root!.render(React.createElement(client.Clarity)));
    assert.equal(document.querySelector('script[src*="clarity.ms/tag/"]'), null);
    sdkWindow.__mvaiCommercialAnalyticsExcluded = false;
    await act(async () => dom.window.dispatchEvent(new dom.window.Event('mvai:commercial-analytics-resolved')));
    const script = document.querySelector('script[src*="clarity.ms/tag/"]')!;
    assert.ok(script);
    assert.ok(sdkWindow.clarity.q!.some((command) => command[0] === 'consentv2' && (command[1] as { ad_Storage: string }).ad_Storage === 'denied'));
    assert.ok(sdkWindow.clarity.q!.some((command) => command[0] === 'set' && command[1] === 'page_category' && command[2] === 'mcp'));
    assert.ok(!JSON.stringify(sdkWindow.clarity.q).includes('?code='));
    writeConsent(false, false);
    await act(async () => dom.window.dispatchEvent(new dom.window.CustomEvent('consent:updated', { detail: { categories: { analytics: false, ads: false } } })));
    client.setClarityConsent(false, false);
    assert.deepEqual(sdkWindow.clarity.q, [['stop']], 'pre-load withdrawal retains the sole SDK stop command');
    const commands: unknown[][] = [];
    sdkWindow.clarity = (...args) => commands.push(args);
    script.dispatchEvent(new dom.window.Event('load'));
    assert.deepEqual(commands, [['stop']], 'onload reasserts a direct stop, never a consent-triggered restart');
    assert.equal(client.isClarityReady(), false);
    writeConsent(true, false);
    await act(async () => dom.window.dispatchEvent(new dom.window.CustomEvent('consent:updated', { detail: { categories: { analytics: true, ads: false } } })));
    assert.equal(client.isClarityReady(), true);
    assert.equal(document.querySelectorAll('script[src*="clarity.ms/tag/"]').length, 1);
    const startIndex = commands.findIndex((command) => command[0] === 'start');
    const consentIndex = commands.findIndex((command) => command[0] === 'consentv2');
    assert.ok(startIndex >= 0 && consentIndex > startIndex, 'restart precedes current consent, so stale denial cannot replay');
    assert.deepEqual(commands[consentIndex], ['consentv2', { analytics_Storage: 'granted', ad_Storage: 'denied' }]);
  } finally {
    if (root) await act(async () => root!.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    await rm(directory, { recursive: true, force: true });
  }
});
