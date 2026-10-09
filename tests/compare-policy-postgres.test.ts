import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { cpus, platform, release } from 'node:os';
import test from 'node:test';
import type { Pool, PoolClient, QueryResult } from 'pg';
import type { PricingContext } from '../frontend/lib/pricing-context';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { getDb } from '../frontend/src/lib/db';
import { CATALOG_BY_SLUG, PRICING_ENGINES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config';
import { computeComparePricingPoints } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-pricing-scenarios';
import { computeCurrentPublicSnapshot, createScopedCurrentPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { customerTariffCellId } from '../frontend/server/pricing/customer-tariff-seed';
import { confirmCustomerTariffChange, previewCustomerTariffChange } from '../frontend/server/pricing-admin/customer-tariff-service';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { makeComparePagePricingHarness } from './helpers/compare-page-pricing-harness';

type Counts = Record<'policy' | 'begin' | 'state' | 'selected' | 'commit' | 'rollback' | 'other', number>;
const emptyCounts = (): Counts => ({ policy: 0, begin: 0, state: 0, selected: 0, commit: 0, rollback: 0, other: 0 });
const healthyCounts = (policy: number): Counts => ({ policy, begin: 6, state: 6, selected: 6, commit: 6, rollback: 0, other: 0 });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const actor = '11111111-1111-4111-8111-111111111111';
const locales = ['en', 'fr', 'es'] as const;
const routeInput = (locale: typeof locales[number] = 'en', right = 'veo-3-1-fast') => ({
  activeLocale: locale, left: CATALOG_BY_SLUG.get('veo-3-1')!, right: CATALOG_BY_SLUG.get(right)!,
});
const policyRows = `INSERT INTO app_pricing_rules (id,engine_id,margin_percent,margin_flat_cents,
  surcharge_audio_percent,surcharge_upscale_percent,currency,vendor_account_id) VALUES
  ('default',NULL,0.3,0,0.2,0.5,'USD','acct_compare_default'),
  ('fast','veo-3-1-fast',0.4,3,0.2,0.5,'USD','acct_compare_fast');`;

// Break caught: the real route failing to supply one shared contextual reader
// repeats six effective-policy SELECTs; tariff/quote caching or context
// normalization breaks complete snapshot and localized output parity.
test('comparison owner shares effective policy, preserving real PG17 tariff transactions and localized output', async t => {
  const database = await startDisposablePostgres('compare-policy');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV,
    PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  let appPool: Pool | undefined;
  let dispose: (() => Promise<void>) | undefined;
  let counts = emptyCounts();
  let instrumentation = true;
  let before: ((category: keyof Counts, ordinal: number) => void | Promise<void>) | undefined;
  let after: ((category: keyof Counts, ordinal: number) => void | Promise<void>) | undefined;
  let commands: { category: keyof Counts; sql: string; parameters: unknown }[] = [];
  const evidence: unknown[] = [];
  const reset = () => { counts = emptyCounts(); commands = []; };
  try {
    Object.assign(process.env, { DATABASE_URL: database.databaseUrl, NODE_ENV: 'production', PRICING_SANDBOX: '0' });
    const fixture = await makeComparePagePricingHarness();
    dispose = fixture.dispose;
    const h = fixture.harness;
    await database.pool.query(`CREATE TABLE app_pricing_rules (
      id TEXT PRIMARY KEY, engine_id TEXT, resolution TEXT, mode TEXT, margin_percent NUMERIC,
      margin_flat_cents INTEGER, surcharge_audio_percent NUMERIC, surcharge_upscale_percent NUMERIC,
      currency TEXT, compatibility_profile TEXT, vendor_account_id TEXT, effective_from TIMESTAMPTZ,
      updated_at TIMESTAMPTZ, updated_by UUID); ${policyRows}`);
    for (const name of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await database.pool.query(readFileSync(`neon/migrations/${name}`, 'utf8'));
    }
    appPool = getDb();
    appPool.on('connect', (client: PoolClient) => {
      const original = client.query.bind(client) as (...args: unknown[]) => Promise<QueryResult>;
      client.query = (async (...args: unknown[]) => {
        if (!instrumentation) return original(...args);
        const sql = typeof args[0] === 'string' ? args[0] : (args[0] as { text?: string })?.text ?? '';
        const category = /^BEGIN/.test(sql) ? 'begin' : /^COMMIT/.test(sql) ? 'commit'
          : /^ROLLBACK/.test(sql) ? 'rollback' : sql.includes('app_pricing_rules') ? 'policy'
          : sql.includes('app_customer_tariff_cells') ? 'selected'
          : sql.includes('app_customer_tariff_state') ? 'state' : 'other';
        const ordinal = ++counts[category];
        commands.push({ category, sql, parameters: clone(args[1] ?? null) });
        await before?.(category, ordinal);
        const result = await original(...args);
        await after?.(category, ordinal);
        return result;
      }) as typeof client.query;
    });

    async function render(input: ReturnType<typeof routeInput>, scoped: boolean, capture = true) {
      const contexts: PricingContext[] = [], snapshots: (PricingSnapshot | { unavailable: true })[] = [];
      const snapshot = async (context: PricingContext, read = computeCurrentPublicSnapshot) => {
        const index = contexts.push(clone(context)) - 1;
        try { const value = await read(context); snapshots[index] = clone(value); return value; }
        catch (error) { snapshots[index] = { unavailable: true }; throw error; }
      };
      h.setSnapshotReader(capture ? snapshot : computeCurrentPublicSnapshot);
      h.setSnapshotFactory(() => {
        const scope = scoped ? createScopedCurrentPublicSnapshot() : computeCurrentPublicSnapshot;
        return capture ? context => snapshot(context, scope) : scope;
      });
      const output = await h.buildCompareRouteData(input);
      return { output: capture ? clone(output) : output, contexts, snapshots };
    }

    async function parity(input: ReturnType<typeof routeInput>, label: string, n = 6) {
      reset(); const baseline = await render(input, false); const baselineCounts = { ...counts }; const baselineCommands = [...commands];
      reset(); const candidate = await render(input, true); const candidateCounts = { ...counts }; const candidateCommands = [...commands];
      evidence.push({ label, locale: input.activeLocale, n, baseline: baselineCounts, candidate: candidateCounts,
        baselineCommands, candidateCommands, baselineOutput: baseline, candidateOutput: candidate });
      assert.equal(baseline.contexts.length, n, 'capture actual admitted scenario cardinality');
      assert.deepEqual(candidate, baseline, 'complete contexts, snapshots, route props and localized price/score rows');
      assert.equal(baselineCounts.policy, n);
      assert.equal(candidateCounts.policy, 1, 'one policy SELECT across both real pricing sides');
      assert.deepEqual({ ...candidateCounts, policy: n }, baselineCounts, 'every tariff SQL command remains independent');
      assert.equal(candidateCounts.begin, n); assert.equal(candidateCounts.commit, n);
      return candidate;
    }

    await t.test('six ordinary scenarios reduce pricing commands from 30 to 25', async () => {
      for (const locale of locales) {
        const result = await parity(routeInput(locale), 'inactive tariff state / distinct effective policy and routing');
        assert.deepEqual(counts, healthyCounts(1));
        assert.deepEqual(result.contexts.map(context => [context.engine.id, context.durationSec, context.resolution,
          context.mode, context.membershipTier, context.hasVideoInput, context.inputVideoDurationSec, context.aspectRatio, context.addons]),
        ['veo-3-1', 'veo-3-1-fast'].flatMap(id => ['720p', '1080p', '4k'].map(resolution =>
          [id, 4, resolution, 't2v', 'member', false, 0, '16:9', { audio: true }])));
        assert.ok(result.snapshots.every((snapshot, i) => 'vendorAccountId' in snapshot &&
          snapshot.vendorAccountId === (i < 3 ? 'acct_compare_default' : 'acct_compare_fast')));
        assert.equal(result.output.leftPricingDisplay.priceRows?.length, 3);
        assert.equal(result.output.rightPricingDisplay.priceRows?.length, 3);
      }
      await parity(routeInput('en', 'veo-3-1-lite'), 'Veo/Lite has five real scenarios', 5);
    });

    const cells = ['veo-3-1', 'veo-3-1-fast'].flatMap((modelId, modelIndex) => ['720p', '1080p', '4k'].map((resolution, index) => ({
      input: { modelId, mode: 't2v', durationSec: 4, resolution, audio: true, aspectRatio: '16:9' },
      cents: modelIndex ? [80, 120, 200][index] : [208, 244, 316][index],
    })));
    await t.test('active distinct and zero-price cells preserve localized totals; missing cells never fall back', async () => {
      try {
        for (const cell of cells) {
          const scenario = resolvePublicModelScenario(cell.input)!;
          assert.ok(scenario, 'fixture selects an admitted exact scenario');
          await database.pool.query(`INSERT INTO app_customer_tariff_cells
            (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
            VALUES ($1,$2,$3::jsonb,$4::jsonb,'USD',NOW()-INTERVAL '1 day',1,$5)`, [
            customerTariffCellId(scenario.id), JSON.stringify(Object.entries(scenario.selector).sort(([a], [b]) => a.localeCompare(b))),
            JSON.stringify(scenario.selector), JSON.stringify({ kind: 'fixed', customerCents: cell.cents }), actor,
          ]);
        }
        await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1');
        for (const locale of locales) {
          const result = await parity(routeInput(locale), 'active distinct cells');
          assert.deepEqual(result.snapshots.map(snapshot => 'totalCents' in snapshot ? snapshot.totalCents : null), [208, 244, 316, 80, 120, 200]);
          assert.deepEqual(result.output.rightPricingDisplay.prices, [0.2, 0.3, 0.5]);
        }
        const zeroCell = customerTariffCellId(resolvePublicModelScenario(cells[3].input)!.id);
        await database.pool.query('UPDATE app_customer_tariff_cells SET price_json=$2::jsonb WHERE id=$1', [zeroCell,
          JSON.stringify({ kind: 'fixed', customerCents: 0 })]);
        const fastEngine = h.pricingEngines.get('veo-3-1-fast')!;
        try {
          // Explicit synthetic supplier-zero engine: a free retail price is valid
          // only without violating the existing below-reference settlement guard.
          h.pricingEngines.set(fastEngine.id, { ...fastEngine, pricingDetails: { currency: 'USD', perSecondCents: { default: 1 },
            byMode: { t2v: { perSecondCents: { default: 0 } } }, addons: { audio_off: { perSecondCents: 0 } } },
            pricing: { ...fastEngine.pricing, base: 0.01, byResolution: {} } });
          for (const locale of locales) {
            const zero = await parity(routeInput(locale), 'synthetic zero supplier cost / valid zero retail');
            assert.deepEqual(zero.output.rightPricingDisplay.prices, [0, 0.3, 0.5]);
            assert.equal(zero.output.rightPricingDisplay.scenario?.amountCents, 0);
            assert.equal('totalCents' in zero.snapshots[3] && zero.snapshots[3].totalCents, 0);
          }
        } finally { h.pricingEngines.set(fastEngine.id, fastEngine); }
        const belowReference = await parity(routeInput(), 'zero retail with positive supplier cost fails closed');
        assert.deepEqual(belowReference.snapshots[3], { unavailable: true });
        await database.pool.query('UPDATE app_customer_tariff_cells SET price_json=$2::jsonb WHERE id=$1', [zeroCell,
          JSON.stringify({ kind: 'fixed', customerCents: cells[3].cents })]);
        const missing = resolvePublicModelScenario(cells[4].input)!;
        await database.pool.query('DELETE FROM app_customer_tariff_cells WHERE id=$1', [customerTariffCellId(missing.id)]);
        for (const locale of locales) {
          const result = await parity(routeInput(locale), 'one active cell missing');
          assert.deepEqual(result.output.rightPricingDisplay.priceRows?.map(row => row.resolution), ['720p', '4K']);
          assert.deepEqual(result.snapshots[4], { unavailable: true });
        }
        await database.pool.query('DELETE FROM app_customer_tariff_cells');
        for (const locale of locales) {
          const result = await parity(routeInput(locale), 'all active cells missing');
          assert.deepEqual(result.output.leftPricingDisplay.prices, []);
          assert.equal(result.output.leftPricingDisplay.quoteUnavailable, true);
          assert.equal(result.output.rightPricingDisplay.headline, locale === 'fr' ? 'Prix actuel indisponible'
            : locale === 'es' ? 'Precio actual no disponible' : 'Current price unavailable');
        }
      } finally {
        await database.pool.query('UPDATE app_customer_tariff_state SET active=FALSE');
        await database.pool.query('DELETE FROM app_customer_tariff_cells');
      }
    });

    await t.test('policy failure blocks all tariff reads; one transient shared failure has a bounded group and retry', async () => {
      await database.pool.query('ALTER TABLE app_pricing_rules RENAME TO fixture_saved_pricing_rules');
      try {
        for (const locale of locales) {
          reset(); const baseline = await render(routeInput(locale), false); const baselineCounts = { ...counts };
          reset(); const candidate = await render(routeInput(locale), true);
          assert.deepEqual(candidate, baseline);
          assert.deepEqual(baselineCounts, { ...emptyCounts(), policy: 6 });
          assert.deepEqual(counts, { ...emptyCounts(), policy: 1 });
          assert.equal(candidate.output.leftPricingDisplay.quoteUnavailable, true);
          evidence.push({ label: 'real missing policy table', locale, baseline: baselineCounts, candidate: { ...counts }, commands: [...commands] });
        }
      } finally { await database.pool.query('ALTER TABLE fixture_saved_pricing_rules RENAME TO app_pricing_rules'); }
      // Simulated first-attempt failure deliberately has different failure groups:
      // baseline's five independent successes versus candidate's six unavailable.
      before = (category, ordinal) => { if (category === 'policy' && ordinal === 1) throw new Error('simulated transient policy failure'); };
      try {
        reset(); const baseline = await render(routeInput(), false); const baselineCounts = { ...counts };
        assert.equal(baseline.snapshots.filter(snapshot => 'unavailable' in snapshot).length, 1);
        assert.equal(counts.commit, 5);
        reset(); const candidate = await render(routeInput(), true); const failedCounts = { ...counts };
        assert.ok(candidate.snapshots.every(snapshot => 'unavailable' in snapshot));
        assert.deepEqual(counts, { ...emptyCounts(), policy: 1 });
        const scope = h.scopes.at(-1)!;
        const recovered = await computeComparePricingPoints(PRICING_ENGINES.get('veo-3-1')!, 4, undefined, scope);
        assert.equal(recovered.length, 3);
        assert.deepEqual(counts, { policy: 2, begin: 3, state: 3, selected: 3, commit: 3, rollback: 0, other: 0 });
        evidence.push({ label: 'simulated first policy failure; bounded shared failure and same-scope recovery', baseline: baselineCounts,
          candidateFailed: failedCounts, afterSameScopeRetry: { ...counts } });
      } finally { before = undefined; }
      reset(); const next = await render(routeInput(), true);
      assert.deepEqual(counts, healthyCounts(1));
      assert.ok(next.snapshots.every(snapshot => 'totalCents' in snapshot));
    });

    await t.test('tariff state failures keep six rollback transactions and truthful unavailable output', async () => {
      await database.pool.query('ALTER TABLE app_customer_tariff_state RENAME TO fixture_saved_tariff_state');
      try {
        reset(); const baseline = await render(routeInput(), false); const baselineCounts = { ...counts };
        reset(); const candidate = await render(routeInput(), true);
        assert.deepEqual(candidate, baseline);
        assert.deepEqual(counts, { policy: 1, begin: 6, state: 6, selected: 0, commit: 0, rollback: 6, other: 0 });
        assert.deepEqual({ ...counts, policy: 6 }, baselineCounts);
        evidence.push({ label: 'real missing state table', baseline: baselineCounts, candidate: { ...counts }, commands: [...commands] });
      } finally { await database.pool.query('ALTER TABLE fixture_saved_tariff_state RENAME TO app_customer_tariff_state'); }
    });

    await t.test('a loaded empty policy is retained; fresh and overlapping renders capture independent policy', async () => {
      const original = await render(routeInput(), true);
      await database.pool.query('DELETE FROM app_pricing_rules');
      try {
        reset(); const empty = await parity(routeInput(), 'successfully loaded empty policy');
        assert.equal(counts.policy, 1);
        assert.ok(empty.snapshots.every(snapshot => 'totalCents' in snapshot));
      } finally { await database.pool.query(policyRows); }
      let releaseGate!: () => void, captured!: () => void;
      const held = new Promise<void>(resolve => { releaseGate = resolve; });
      const loaded = new Promise<void>(resolve => { captured = resolve; });
      reset();
      after = (category, ordinal) => { if (category === 'policy' && ordinal === 1) { captured(); return held; } };
      const first = render(routeInput(), true);
      try {
        await loaded;
        await database.pool.query("UPDATE app_pricing_rules SET margin_percent=0.8 WHERE id='default'");
        const second = await render(routeInput(), true);
        releaseGate();
        assert.deepEqual(await first, original, 'the first render keeps the complete policy already read');
        assert.notDeepEqual(second.snapshots, original.snapshots);
        assert.deepEqual(counts, { policy: 2, begin: 12, state: 12, selected: 12, commit: 12, rollback: 0, other: 0 });
        evidence.push({ label: 'overlapping scopes observe separate committed policies', counts: { ...counts }, first: await first, second });
      } finally {
        releaseGate(); await first; after = undefined;
        await database.pool.query("UPDATE app_pricing_rules SET margin_percent=0.3 WHERE id='default'");
      }
      reset(); assert.deepEqual(await render(routeInput(), true), original);
      assert.deepEqual(counts, healthyCounts(1));
    });

    await t.test('the same contextual scope observes a committed tariff update in a later quote', async () => {
      const input = cells[0].input;
      const scenario = resolvePublicModelScenario(input)!;
      const create = { operation: 'create' as const, scenarioId: scenario.id, customerCents: 208 };
      await confirmCustomerTariffChange(create, (await previewCustomerTariffChange(create)).fingerprint, actor, () => {});
      await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE');
      const scope = createScopedCurrentPublicSnapshot();
      const context: PricingContext = { engine: PRICING_ENGINES.get(input.modelId)!, mode: 't2v', durationSec: 4,
        resolution: '720p', aspectRatio: '16:9', membershipTier: 'member', hasVideoInput: false,
        inputVideoDurationSec: 0, addons: { audio: true } };
      reset(); const first = await scope(context);
      assert.equal(first.totalCents, 208);
      const update = { operation: 'update' as const, scenarioId: scenario.id, customerCents: 244 };
      await confirmCustomerTariffChange(update, (await previewCustomerTariffChange(update)).fingerprint, actor, () => {});
      reset(); const second = await scope(context);
      assert.equal(second.totalCents, 244);
      assert.notEqual(second.meta?.customerTariffRevision, first.meta?.customerTariffRevision);
      assert.deepEqual(counts, { policy: 0, begin: 1, state: 1, selected: 1, commit: 1, rollback: 0, other: 0 });
      evidence.push({ label: 'same scoped policy, fresh committed tariff', first, second, counts: { ...counts }, commands: [...commands] });
      await database.pool.query('UPDATE app_customer_tariff_state SET active=FALSE');
    });

    await t.test('prelaunch, disabled, missing engine and absent mode leave policy unread', async () => {
      const input = routeInput();
      for (const extra of [{ availability: 'waitlist' }, { surfaces: { app: { enabled: false } } }, { modelSlug: 'missing-engine' }]) {
        reset(); await render({ ...input, left: { ...input.left, ...extra }, right: { ...input.right, ...extra } }, true);
        assert.deepEqual(counts, emptyCounts());
      }
      reset(); assert.deepEqual(await computeComparePricingPoints({ ...PRICING_ENGINES.get('veo-3-1')!, id: 'missing-mode' },
        4, undefined, createScopedCurrentPublicSnapshot()), []);
      assert.deepEqual(counts, emptyCounts());
    });

    if (process.env.CWV_COMPARE_POLICY_BENCHMARK === '1') {
      instrumentation = false;
      const input = routeInput();
      await render(input, false, false); await render(input, true, false);
      const samples: { scoped: boolean; durationMs: number; block: number; position: number }[] = [];
      for (let block = 0; block < 3; block++) for (const [position, scoped] of [false, true, true, false].entries()) {
        const start = performance.now(); await render(input, scoped, false);
        samples.push({ scoped, durationMs: performance.now() - start, block, position });
      }
      evidence.push({ benchmark: { fixture: 'real comparison data owner, warm disposable PG17, effective policy uncached per render; ABBA; no imposed latency; SQL/capture instrumentation disabled for both variants',
        node: process.version, platform: platform(), osRelease: release(), cpu: cpus()[0]?.model, samples } });
    }
  } finally {
    before = undefined; after = undefined;
    // Always attempt all disposal stages, including if schema/harness setup fails.
    try {
      if (process.env.CWV_COMPARE_POLICY_EVIDENCE_PATH) writeFileSync(process.env.CWV_COMPARE_POLICY_EVIDENCE_PATH, JSON.stringify(evidence, null, 2) + '\n');
    } finally {
      try { await dispose?.(); } finally {
        try { await appPool?.end().catch(() => undefined); } finally {
          try { await database.cleanup(); } finally {
            for (const [key, value] of Object.entries(previous)) {
              if (value === undefined) delete process.env[key]; else process.env[key] = value;
            }
          }
        }
      }
    }
  }
});
