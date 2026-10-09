import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import type { PoolClient, QueryResult } from 'pg';

import { getDb } from '../frontend/src/lib/db';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { mergeEngineLocalizedContent } from '../frontend/lib/models/i18n-normalization';
import { computeCurrentPublicSnapshot } from '../frontend/server/pricing/quote-public';
import * as pricing from '../frontend/server/pricing/quote-public-model-scenario';
import { confirmCustomerTariffChange, previewCustomerTariffChange } from '../frontend/server/pricing-admin/customer-tariff-service';
import { customerTariffCellId } from '../frontend/server/pricing/customer-tariff-seed';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { findModelLayoutElements, makeModelPagePricingHarness } from './helpers/model-page-pricing-harness';

type Counts = Record<'policy' | 'begin' | 'state' | 'selected' | 'commit' | 'rollback' | 'other', number>;
const emptyCounts = (): Counts => ({ policy: 0, begin: 0, state: 0, selected: 0, commit: 0, rollback: 0, other: 0 });
const clone = (value: unknown) => JSON.parse(JSON.stringify(value));
const actor = '11111111-1111-4111-8111-111111111111';
const pikaInput = { modelId: 'pika-text-to-video', mode: 't2v', durationSec: 5, resolution: '720p' };
const locales = ['en', 'fr', 'es'] as const;

function pageInput(modelId: string, locale: typeof locales[number] = 'en') {
  const engine = getFalEngineById(modelId)!;
  const english = JSON.parse(readFileSync(`content/models/en/${engine.modelSlug}.json`, 'utf8'));
  const localized = JSON.parse(readFileSync(`content/models/${locale}/${engine.modelSlug}.json`, 'utf8'));
  return { engine, locale, localizedContent: mergeEngineLocalizedContent(english, localized),
    detailCopy: { backLabel: 'Back', pricingLinkLabel: 'Pricing', breadcrumb: { home: 'Home', models: 'Models' } } };
}

// Break caught: a route/layout owner using an unscoped reader repeats the real policy
// SELECT; shared tariff state or contextual-to-catalog conversion changes parity.
test('active model route and real server layout share policy while preserving independent SQL and complete localized outputs', async t => {
  const database = await startDisposablePostgres('model-page-policy');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV,
    PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: database.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  const { harness: h, dispose } = await makeModelPagePricingHarness({ executeInputs: true, executeGallery: true, timingEnabled: false });
  const evidence: unknown[] = [];
  let counts = emptyCounts();
  let instrumentation = true;
  let before: ((category: keyof Counts, ordinal: number) => void | Promise<void>) | undefined;
  let after: ((category: keyof Counts, ordinal: number) => void | Promise<void>) | undefined;
  const reset = () => { counts = emptyCounts(); };
  try {
    await database.pool.query(`CREATE TABLE app_pricing_rules (
      id TEXT PRIMARY KEY, engine_id TEXT, resolution TEXT, mode TEXT, margin_percent NUMERIC,
      margin_flat_cents INTEGER, surcharge_audio_percent NUMERIC, surcharge_upscale_percent NUMERIC,
      currency TEXT, compatibility_profile TEXT, vendor_account_id TEXT, effective_from TIMESTAMPTZ,
      updated_at TIMESTAMPTZ, updated_by UUID);
      INSERT INTO app_pricing_rules (id, margin_percent, margin_flat_cents, surcharge_audio_percent,
        surcharge_upscale_percent, currency, vendor_account_id)
      VALUES ('default', 0.3, 0, 0.2, 0.5, 'USD', 'acct_model_route');`);
    for (const name of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await database.pool.query(readFileSync(`neon/migrations/${name}`, 'utf8'));
    }
    getDb().on('connect', (client: PoolClient) => {
      const original = client.query.bind(client) as (...args: unknown[]) => Promise<QueryResult>;
      client.query = (async (...args: unknown[]) => {
        if (!instrumentation) return original(...args);
        const command = args[0];
        const sql = typeof command === 'string' ? command : (command as { text?: string })?.text ?? '';
        const category = /^BEGIN/.test(sql) ? 'begin' : /^COMMIT/.test(sql) ? 'commit'
          : /^ROLLBACK/.test(sql) ? 'rollback' : sql.includes('app_pricing_rules') ? 'policy'
          : sql.includes('app_customer_tariff_cells') ? 'selected'
          : sql.includes('app_customer_tariff_state') ? 'state' : 'other';
        const ordinal = ++counts[category];
        await before?.(category, ordinal);
        const result = await original(...args);
        await after?.(category, ordinal);
        return result;
      }) as typeof client.query;
    });

    async function render(input: ReturnType<typeof pageInput>, scoped: boolean, capture = true) {
      const contexts: unknown[] = [], inputs: unknown[] = [], snapshots: unknown[] = [], quotes: unknown[] = [];
      const snapshot = async (context: Parameters<typeof computeCurrentPublicSnapshot>[0], read = computeCurrentPublicSnapshot) => {
        const index = contexts.push(clone(context)) - 1;
        try { const value = await read(context); snapshots[index] = clone(value); return value; }
        catch (error) { snapshots[index] = { unavailable: true }; throw error; }
      };
      const exact = async (input: Parameters<typeof pricing.quotePublicModelScenario>[0], read = pricing.quotePublicModelScenario) => {
        const index = inputs.push(clone(input)) - 1;
        const value = await read(input); quotes[index] = clone(value); return value;
      };
      h.configure(input);
      h.setQuote(capture ? snapshot : computeCurrentPublicSnapshot);
      h.setPublicQuote(capture ? exact : pricing.quotePublicModelScenario);
      h.setPricingReadersFactory(scoped ? () => {
        const scope = pricing.createScopedPublicPricingReaders();
        if (!capture) return scope;
        return { currentSnapshot: (context: Parameters<typeof snapshot>[0]) => snapshot(context, scope.currentSnapshot),
          quoteModel: (input: Parameters<typeof exact>[0]) => exact(input, scope.quoteModel) };
      } : () => ({ currentSnapshot: capture ? snapshot : computeCurrentPublicSnapshot,
        quoteModel: capture ? exact : pricing.quotePublicModelScenario }));
      const route = await h.page({ params: Promise.resolve({ slug: input.engine.modelSlug, locale: input.locale }) });
      const layout = await h.layout(route.props);
      if (!capture) return;
      return { props: clone(route.props), sections: clone(findModelLayoutElements(layout)), contexts, inputs, snapshots, quotes };
    }

    for (const modelId of ['veo-3-1', 'gpt-image-2']) for (const locale of locales) {
      await t.test(`${modelId}/${locale} healthy SQL/output parity`, async () => {
        const input = pageInput(modelId, locale);
        reset(); const reference = await render(input, false); const baseline = { ...counts };
        reset(); const candidate = await render(input, true); const current = { ...counts };
        assert.ok(baseline.policy > 1, 'measure actual reference policy SQL');
        assert.equal(current.policy, 1, 'one complete successful policy across route and layout');
        assert.deepEqual({ ...current, policy: baseline.policy }, baseline, 'all other SQL commands remain individual');
        assert.deepEqual(candidate, reference, 'contexts, inputs, full snapshots, prices, notes, specs, cards, offers and JSON-LD');
        assert.ok(candidate.snapshots.every((value: any) => value.vendorAccountId === 'acct_model_route'));
        assert.equal(current.begin, candidate.contexts.length + candidate.quotes.filter((quote: any) => quote.status === 'exact').length);
        const metadata = await h.generateMetadata({ params: Promise.resolve({ slug: input.engine.modelSlug, locale }) });
        assert.equal(metadata.alternates.canonical, candidate.props.canonicalUrl);
        assert.ok(Object.keys(metadata.alternates.languages).length >= 3);
        evidence.push({ mode: 'inactive manual tariffs / effective legacy policy', modelId, locale, baseline, candidate: current, denominator: {
          contextualAttempts: candidate.contexts.length, exactAttempts: candidate.inputs.length,
          admittedTransactions: current.begin }, output: candidate, metadata });
      });
    }

    await t.test('active distinct cells and one missing offer cell preserve complete localized route/layout parity', async () => {
      const sizes = ['1024x768', '1024x1024', '1024x1536', '1920x1080', '2560x1440', '3840x2160'];
      const missingByModel = new Map<string, ReturnType<typeof pricing.resolvePublicModelScenario>>();
      const fixtures: { input: Parameters<typeof pricing.quotePublicModelScenario>[0]; cents: number }[] = [];
      for (const seconds of [4, 6, 8]) for (const [index, resolution] of ['720p', '1080p', '4k'].entries()) for (const audio of [true, false]) {
        fixtures.push({ input: { modelId: 'veo-3-1', mode: 't2v', durationSec: seconds, resolution, audio },
          cents: seconds * (audio ? 100 : 50) + index * 10 });
      }
      for (const [index, resolution] of sizes.entries()) for (const [quality, cents] of [['low', 11], ['medium', 41], ['high', 91]] as const) {
        fixtures.push({ input: { modelId: 'gpt-image-2', mode: 't2i', durationSec: 1, resolution, quality, quantity: 1 }, cents: cents + index });
      }
      for (const fixture of fixtures) {
        const scenario = pricing.resolvePublicModelScenario(fixture.input)!;
        assert.ok(scenario);
        await database.pool.query(`INSERT INTO app_customer_tariff_cells
          (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
          VALUES ($1,$2,$3::jsonb,$4::jsonb,'USD',NOW()-INTERVAL '1 day',1,$5)`, [
          customerTariffCellId(scenario.id), JSON.stringify(Object.entries(scenario.selector).sort(([a], [b]) => a.localeCompare(b))),
          JSON.stringify(scenario.selector), JSON.stringify({ kind: 'fixed', customerCents: fixture.cents }), actor,
        ]);
        if ((fixture.input.modelId === 'veo-3-1' && fixture.input.durationSec === 8 && fixture.input.resolution === '1080p' && fixture.input.audio)
          || (fixture.input.modelId === 'gpt-image-2' && fixture.input.resolution === '1024x768' && fixture.input.quality === 'high')) {
          missingByModel.set(fixture.input.modelId, scenario);
        }
      }
      await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1');
      for (const partial of [false, true]) {
        if (partial) for (const scenario of missingByModel.values()) {
          await database.pool.query('DELETE FROM app_customer_tariff_cells WHERE id=$1', [customerTariffCellId(scenario!.id)]);
        }
        for (const modelId of ['veo-3-1', 'gpt-image-2']) for (const locale of locales) {
          const input = pageInput(modelId, locale);
          reset(); const baseline = await render(input, false); const baselineCounts = { ...counts };
          reset(); const candidate = await render(input, true); const candidateCounts = { ...counts };
          assert.deepEqual(candidate, baseline);
          assert.equal(counts.policy, 1);
          assert.deepEqual({ ...counts, policy: baselineCounts.policy }, baselineCounts);
          assert.equal(candidate.contexts.length, modelId === 'veo-3-1' ? 7 : 18);
          assert.equal(candidate.inputs.length, modelId === 'veo-3-1' ? 5 : 3);
          assert.ok(candidate.quotes.some((quote: any) => quote.status === 'exact'), 'other configured cells stay exact');
          const amount = modelId === 'veo-3-1' ? 810 : 91;
          const offer = candidate.sections.find((section: any) => section.name === 'ModelDecisionPricingCard')!.props.offer;
          if (partial) {
            assert.equal(offer, null);
            assert.equal(candidate.quotes.filter((quote: any) => quote.status === 'unavailable').length, 2);
            if (modelId === 'gpt-image-2') assert.equal(candidate.props.keySpecRows.find((row: any) => row.key === 'pricePerImage').valueLines.length, 17);
            else assert.ok(candidate.snapshots.every((snapshot: any) => !snapshot.unavailable));
          } else {
            assert.equal(offer.amountCents, amount, 'hand-authored active retail amount feeds the visible offer');
            assert.ok(candidate.quotes.every((quote: any) => quote.status === 'exact'));
            const product = candidate.sections.filter((section: any) => section.name === 'script')
              .map((section: any) => JSON.parse(section.props.dangerouslySetInnerHTML.__html))
              .find((schema: any) => schema['@type'] === 'Product');
            assert.equal(product.offers.price, (amount / 100).toFixed(2));
          }
          evidence.push({ mode: partial ? 'active manual tariffs / one missing offer cell per model' : 'active distinct manual tariff cells',
            modelId, locale, baseline: baselineCounts, candidate: candidateCounts,
            denominator: { contextualAttempts: candidate.contexts.length, exactAttempts: candidate.inputs.length, admittedTransactions: candidateCounts.begin }, output: candidate });
        }
      }
      await database.pool.query('UPDATE app_customer_tariff_state SET active=FALSE');
      await database.pool.query('DELETE FROM app_customer_tariff_cells');
    });

    await t.test('pricing engine overrides preserve contextual resolution/audio inputs', async () => {
      const input = { ...pageInput('veo-3-1'), override: { currency: 'USD', perSecondCents: { default: 10, '1080p': 11 }, addons: {} } };
      reset(); const baseline = await render(input, false); const baselineCounts = { ...counts };
      reset(); const candidate = await render(input, true);
      assert.deepEqual(candidate, baseline);
      assert.equal(counts.policy, 1);
      assert.deepEqual({ ...counts, policy: baselineCounts.policy }, baselineCounts);
      assert.equal(candidate.contexts.length, 4);
      assert.ok(candidate.contexts.every((context: any) => !context.engine.pricingDetails.addons.audio_off));
      assert.deepEqual(candidate.contexts.map((context: any) => context.resolution), ['720p', '720p', '1080p', '4k']);
    });

    await t.test('policy failure blocks tariff transactions, retries and recovers in a fresh render', async () => {
      const input = pageInput('veo-3-1');
      await database.pool.query('ALTER TABLE app_pricing_rules RENAME TO fixture_saved_pricing_rules');
      reset(); const reference = await render(input, false);
      reset(); const candidate = await render(input, true);
      assert.deepEqual(candidate, reference);
      assert.ok(counts.policy > 1); assert.equal(counts.begin, 0); assert.equal(counts.selected, 0);
      assert.equal(candidate.props.pricePerSecondLabel, null);
      await database.pool.query('ALTER TABLE fixture_saved_pricing_rules RENAME TO app_pricing_rules');
      reset(); const healthy = await render(input, true); assert.equal(counts.policy, 1);
      before = (category, ordinal) => { if (category === 'policy' && ordinal === 1) throw new Error('transient policy read'); };
      reset(); const recovering = await render(input, true);
      assert.equal(counts.policy, 2); assert.ok(counts.commit > 0);
      assert.notDeepEqual(recovering, healthy, 'the concurrent group sharing a failed attempt stays unavailable');
      before = undefined;
      reset(); assert.deepEqual(await render(input, true), healthy); assert.equal(counts.policy, 1);
    });

    await t.test('tariff state failure retains one rollback per quote and unavailable output', async () => {
      before = category => { if (category === 'state') throw new Error('tariff state read failed'); };
      for (const modelId of ['veo-3-1', 'gpt-image-2']) {
        const input = pageInput(modelId);
        reset(); const baseline = await render(input, false); const baselineCounts = { ...counts };
        reset(); const candidate = await render(input, true);
        assert.deepEqual(candidate, baseline);
        assert.equal(counts.policy, 1); assert.equal(counts.rollback, counts.begin);
        assert.equal(counts.commit, 0); assert.equal(counts.selected, 0);
        assert.deepEqual({ ...counts, policy: baselineCounts.policy }, baselineCounts);
      }
      before = undefined;
    });

    await t.test('successful scoped policy stays fresh per render and tariff amounts/revisions stay fresh per quote', async () => {
      const input = pageInput('veo-3-1');
      const prior = await render(input, true);
      await database.pool.query("UPDATE app_pricing_rules SET margin_percent = 0.8 WHERE id = 'default'");
      reset(); const changed = await render(input, true);
      assert.equal(counts.policy, 1); assert.notDeepEqual(changed.snapshots, prior.snapshots);
      await database.pool.query("UPDATE app_pricing_rules SET margin_percent = 0.3 WHERE id = 'default'");
      const scenario = pricing.resolvePublicModelScenario(pikaInput)!;
      const create = { operation: 'create' as const, scenarioId: scenario.id, customerCents: 37 };
      await confirmCustomerTariffChange(create, (await previewCustomerTariffChange(create)).fingerprint, actor, () => {});
      await database.pool.query('UPDATE app_customer_tariff_state SET active = TRUE');
      const scope = pricing.createScopedPublicPricingReaders();
      reset(); const first = await scope.quoteModel(pikaInput);
      assert.equal(first.status, 'exact'); if (first.status === 'exact') assert.equal(first.amountCents, 37);
      const update = { operation: 'update' as const, scenarioId: scenario.id, customerCents: 41 };
      await confirmCustomerTariffChange(update, (await previewCustomerTariffChange(update)).fingerprint, actor, () => {});
      reset(); const second = await scope.quoteModel(pikaInput);
      assert.equal(second.status, 'exact');
      if (first.status === 'exact' && second.status === 'exact') {
        assert.equal(second.amountCents, 41); assert.notEqual(second.revision, first.revision);
      }
      assert.deepEqual(counts, { policy: 0, begin: 1, state: 1, selected: 1, commit: 1, rollback: 0, other: 0 });
      const contextual = await scope.currentSnapshot(scenario.context);
      assert.equal(contextual.totalCents, 41);
      for (const modelId of ['veo-3-1', 'gpt-image-2']) for (const locale of locales) {
        const missing = pageInput(modelId, locale);
        reset(); const baseline = await render(missing, false); const baselineCounts = { ...counts };
        reset(); const candidate = await render(missing, true);
        assert.deepEqual(candidate, baseline);
        assert.equal(counts.policy, 1); assert.deepEqual({ ...counts, policy: baselineCounts.policy }, baselineCounts);
        assert.ok(candidate.quotes.every((quote: any) => quote.status === 'unavailable'));
        assert.equal(candidate.props.pricePerImageLabel ?? candidate.props.pricePerSecondLabel, null);
        const products = candidate.sections.filter((section: any) => section.name === 'script')
          .map((section: any) => JSON.parse(section.props.dangerouslySetInnerHTML.__html))
          .filter((schema: any) => schema['@type'] === 'Product');
        assert.ok(products.every((schema: any) => schema.offers === undefined));
      }
      await database.pool.query('UPDATE app_customer_tariff_state SET active = FALSE');
    });

    await t.test('overlapping full renders capture separate complete policies', async () => {
      const input = pageInput('veo-3-1');
      const healthy = await render(input, true);
      let release!: () => void, captured!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      const read = new Promise<void>(resolve => { captured = resolve; });
      reset();
      after = (category, ordinal) => {
        if (category === 'policy' && ordinal === 1) { captured(); return held; }
      };
      const first = render(input, true);
      try {
        await read;
        await database.pool.query("UPDATE app_pricing_rules SET margin_percent = 0.8 WHERE id = 'default'");
        const second = await render(input, true);
        release();
        assert.deepEqual(await first, healthy);
        assert.notDeepEqual(second.snapshots, healthy.snapshots);
        assert.equal(counts.policy, 2); assert.equal(counts.begin, 24); assert.equal(counts.commit, 24);
      } finally {
        release(); await first; after = undefined;
        await database.pool.query("UPDATE app_pricing_rules SET margin_percent = 0.3 WHERE id = 'default'");
      }
    });

    await t.test('metadata/archive/prelaunch remain zero pricing I/O', async () => {
      const input = pageInput('veo-3-1');
      for (const extra of [{}, { archive: true }, { prelaunch: true }]) {
        h.configure({ ...input, ...extra, localizedContent: { ...input.localizedContent, ...(extra.archive ? { archive: {} } : {}) } }); reset();
        if (!Object.keys(extra).length) await h.generateMetadata({ params: Promise.resolve({ slug: input.engine.modelSlug, locale: 'en' }) });
        else await h.page({ params: Promise.resolve({ slug: input.engine.modelSlug, locale: 'en' }) });
        assert.deepEqual(counts, emptyCounts());
      }
    });

    if (process.env.CWV_MODEL_POLICY_BENCHMARK === '1') {
      instrumentation = false;
      for (const modelId of ['veo-3-1', 'gpt-image-2']) {
        const input = pageInput(modelId);
        await render(input, false, false); await render(input, true, false);
        const samples = [];
        for (let pair = 0; pair < 24; pair++) for (const scoped of pair % 2 ? [true, false] : [false, true]) {
          const start = performance.now(); await render(input, scoped, false);
          samples.push({ scoped, durationMs: performance.now() - start, pair });
        }
        evidence.push({ modelId, benchmark: { fixture: 'same warm disposable PostgreSQL; full route + real layout; SQL instrumentation disabled', samples } });
      }
    }
    if (process.env.CWV_MODEL_POLICY_EVIDENCE_PATH) writeFileSync(process.env.CWV_MODEL_POLICY_EVIDENCE_PATH, JSON.stringify(evidence, null, 2) + '\n');
  } finally {
    before = undefined; after = undefined;
    await dispose(); await getDb().end().catch(() => undefined); await database.cleanup();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
