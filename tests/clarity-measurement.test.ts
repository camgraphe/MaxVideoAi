import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
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
  } finally {
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    await rm(directory, { recursive: true, force: true });
  }
});
