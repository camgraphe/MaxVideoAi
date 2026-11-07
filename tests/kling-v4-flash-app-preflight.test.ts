import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { KLING_V4_FLASH_ENGINE } from '../frontend/src/config/fal-engines/kling-v4-flash';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';
import { resolveAdmittedMediaAwarePreflight, type MediaAwarePreflightDependencies } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { computeConfiguredPreflight } from '../frontend/src/server/engines';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import type { PricingContext } from '../frontend/src/lib/pricing-context';

const sourceUrl = 'https://media.maxvideoai.com/user-assets/flash-source.mp4';
const referenceUrl = 'https://media.maxvideoai.com/user-assets/flash-reference.mp4';
const subjectUrl = 'https://media.maxvideoai.com/user-assets/flash-subject.mp4';
const source = { assetId: 'source', slotId: 'video_url', kind: 'video' as const, url: sourceUrl };
const reference = { assetId: 'reference', slotId: 'video_urls', kind: 'video' as const, url: referenceUrl };
const subject = { videoAssetId: 'subject', videoUrl: subjectUrl };
const omitted = { engine: 'kling-v4-flash', mode: 'v2v', resolution: '720p', inputs: [source, reference], elements: [subject] };
const cell: ManualTariffCell = {
  id: 'reviewed-flash-modify', source: 'database', version: 7, currency: 'USD', effectiveFrom: '2026-10-01T00:00:00Z',
  selector: { engineId: 'kling-v4-flash', mode: 'v2v', resolution: '720p', durationSec: 'continuous',
    billingInputType: 'video_input', inputVideoDurationSec: 'continuous' },
  price: { kind: 'unit_terms', rounding: 'up', terms: [{ unit: 'billable_seconds', centsPerUnit: 15 }] },
};

test('App preflight admits Flash Modify omission and video subjects while preserving the exact model identity', () => {
  const parsed = parsePreflightRequestPayload(omitted);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.request.engine, 'kling-v4-flash');
    assert.equal(parsed.request.durationSec, undefined);
    assert.deepEqual(parsed.request.elements, [subject]);
  }
  const explicit = parsePreflightRequestPayload({ ...omitted, durationSec: 5 });
  assert.equal(explicit.ok, true);
  if (explicit.ok) assert.equal(explicit.request.durationSec, 5);
  for (const patch of [
    { mode: 'ref2v' }, { mode: 't2v' }, { durationOption: 'auto' },
    { engine: 'kling-3-pro' }, { engine: 'kling-v4' },
    { inheritedDurationSec: 4.25 }, { elements: [subject, subject, subject, subject] },
  ]) assert.equal(parsePreflightRequestPayload({ ...omitted, ...patch }).ok, false, JSON.stringify(patch));
});

test('Flash App owned-media preflight quotes exact source inheritance, aggregate references and explicit output through canonical cells', async () => {
  const contexts: PricingContext[] = [];
  let cells = [cell];
  const metadata = new Map([
    [sourceUrl, { assetId: 'source', durationSec: 4.25 }],
    [referenceUrl, { assetId: 'reference', durationSec: 3.5 }],
    [subjectUrl, { assetId: 'subject', durationSec: 5 }],
  ]);
  const dependencies: MediaAwarePreflightDependencies = {
    getConfiguredEngineFn: async () => KLING_V4_FLASH_ENGINE,
    mediaConstraintDeps: {
      queryFn: async <T>(_sql: string, params?: readonly unknown[]) => {
        if (params?.[0] !== 'offline-owner') return [];
        return [...metadata].map(([url, facts]) => ({ asset_id: facts.assetId, url, mime_type: 'video/mp4',
          size_bytes: 1024, width: 1280, height: 720, duration_sec: facts.durationSec })) as T[];
      },
      detectVideoMetadataFn: async url => {
        const facts = metadata.get(url);
        return facts ? { width: 1280, height: 720, durationSec: facts.durationSec, fps: 24 } : null;
      },
    },
    computeConfiguredPreflightFn: (request, options) => computeConfiguredPreflight(request, {
      ...options, computePublicSnapshot: context => {
        contexts.push(context);
        return computeCanonicalBillingSnapshot(context, {
          pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
          loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 7,
            versionedCells: [], databaseCells: cells }),
        });
      },
    }),
  };
  const quote = async (patch: Record<string, unknown> = {}, userId = 'offline-owner') => {
    const parsed = parsePreflightRequestPayload({ ...omitted, ...patch });
    assert.equal(parsed.ok, true, JSON.stringify(patch));
    if (!parsed.ok) throw new Error('Expected an admitted Flash Modify request.');
    return resolveAdmittedMediaAwarePreflight({ request: parsed.request, userId }, dependencies);
  };
  const inherited = await quote();
  assert.equal(inherited.ok, true, JSON.stringify(inherited));
  assert.equal(inherited.total, 255);
  assert.equal(inherited.pricing?.base.seconds, 4.25);
  assert.equal(inherited.pricing?.meta?.billable_seconds, 17);
  const explicit = await quote({ durationSec: 5 });
  assert.equal(explicit.ok, true, JSON.stringify(explicit));
  assert.equal(explicit.total, 267);
  assert.deepEqual(contexts.map(context => ({ engineId: context.engine.id, mode: context.mode,
    output: context.durationSec, aggregate: context.inputVideoDurationSec, inherited: context.inheritedDurationSec })), [
    { engineId: 'kling-v4-flash', mode: 'v2v', output: 4.25, aggregate: 12.75, inherited: 4.25 },
    { engineId: 'kling-v4-flash', mode: 'v2v', output: 5, aggregate: 12.75, inherited: undefined },
  ]);
  assert.equal((await quote({ extraInputValues: { inheritedDurationSec: 1, inputVideoDurationSec: 1 } })).error?.code, 'PRICING_MEDIA_FACTS_UNTRUSTED');
  assert.equal((await quote({}, 'foreign-owner')).ok, false);
  metadata.set(sourceUrl, { assetId: 'source', durationSec: 11.501 });
  assert.equal((await quote()).ok, false, 'The 20.001-second aggregate must fail before price calculation.');
  metadata.delete(sourceUrl);
  assert.equal((await quote()).ok, false, 'A missing exact owned source must fail before pricing.');
  assert.equal(contexts.length, 2);
  metadata.set(sourceUrl, { assetId: 'source', durationSec: 4.25 });
  cells = [];
  const unavailable = await quote();
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.error?.code, 'PRICING_ERROR');
  assert.equal(unavailable.total, undefined, 'A missing Modify tariff cannot use a creation price or percentage policy.');
});
