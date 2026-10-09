import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { PoolClient, QueryResult } from 'pg';

import { getDb } from '../frontend/src/lib/db';
import { buildCurrentPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/currentPricingHubData';
import { createScopedPublicModelQuoter, quotePublicModelScenario, resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { confirmCustomerTariffChange, previewCustomerTariffChange } from '../frontend/server/pricing-admin/customer-tariff-service';
import { startDisposablePostgres, type DisposablePostgres } from './helpers/disposable-postgres';

type Counts = Record<'policy' | 'begin' | 'state' | 'selected' | 'commit' | 'rollback' | 'other', number>;
type Observation = {
  counts: Counts;
  reset(): void;
  before?: (category: keyof Counts, ordinal: number) => void | Promise<void>;
  after?: (category: keyof Counts, ordinal: number) => void | Promise<void>;
};
const freshCounts = (): Counts => ({ policy: 0, begin: 0, state: 0, selected: 0, commit: 0, rollback: 0, other: 0 });
const unavailableOther = {
  audio: async () => { throw new Error('Audio is outside the model SQL fixture'); },
  product: async () => { throw new Error('Products are outside the model SQL fixture'); },
};

const pikaInput = { modelId: 'pika-text-to-video', mode: 't2v', durationSec: 5, resolution: '720p' };
const actor = '11111111-1111-4111-8111-111111111111';
const pikaAmount = (data: Awaited<ReturnType<typeof buildCurrentPricingHubData>>) =>
  data.video.rows.find(row => row.id === pikaInput.modelId)!.quotes['5s-720p'].amountCents;

async function fixture(run: (database: DisposablePostgres, observe: Observation) => Promise<void>) {
  const database = await startDisposablePostgres('pricing-hub-policy');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV,
    PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: database.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await database.pool.query(`CREATE TABLE app_pricing_rules (
      id TEXT PRIMARY KEY, engine_id TEXT, resolution TEXT, mode TEXT, margin_percent NUMERIC,
      margin_flat_cents INTEGER, surcharge_audio_percent NUMERIC, surcharge_upscale_percent NUMERIC,
      currency TEXT, compatibility_profile TEXT, vendor_account_id TEXT, effective_from TIMESTAMPTZ,
      updated_at TIMESTAMPTZ, updated_by UUID);
      INSERT INTO app_pricing_rules (id, margin_percent, margin_flat_cents, surcharge_audio_percent,
        surcharge_upscale_percent, currency) VALUES ('default', 0.3, 0, 0.2, 0.5, 'USD');`);
    for (const name of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await database.pool.query(readFileSync(`neon/migrations/${name}`, 'utf8'));
    }
    const observe: Observation = { counts: freshCounts(), reset() { this.counts = freshCounts(); } };
    getDb().on('connect', (client: PoolClient) => {
      const original = client.query.bind(client) as (...args: unknown[]) => Promise<QueryResult>;
      client.query = (async (...args: unknown[]) => {
        const command = args[0];
        const sql = typeof command === 'string' ? command : (command as { text?: string })?.text ?? '';
        const category = /^BEGIN/.test(sql) ? 'begin' : /^COMMIT/.test(sql) ? 'commit'
          : /^ROLLBACK/.test(sql) ? 'rollback' : sql.includes('app_pricing_rules') ? 'policy'
          : sql.includes('app_customer_tariff_cells') ? 'selected'
          : sql.includes('app_customer_tariff_state') ? 'state' : 'other';
        const ordinal = ++observe.counts[category];
        await observe.before?.(category, ordinal);
        const result = await original(...args);
        await observe.after?.(category, ordinal);
        return result;
      }) as typeof client.query;
    });
    await run(database, observe);
  } finally {
    await getDb().end().catch(() => undefined);
    await database.cleanup();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test('default Pricing shares one successful policy read while preserving every individual tariff transaction', async () => {
  await fixture(async (_database, observe) => {
    for (const locale of ['en', 'fr', 'es'] as const) {
      observe.reset();
      let attempts = 0;
      const baseline = await buildCurrentPricingHubData(locale, async input => {
        attempts++;
        return quotePublicModelScenario(input);
      }, unavailableOther);
      assert.equal(attempts, 132);
      assert.deepEqual(observe.counts, { policy: 126, begin: 126, state: 126, selected: 126,
        commit: 126, rollback: 0, other: 0 });
      observe.reset();
      const current = await buildCurrentPricingHubData(locale, undefined, unavailableOther);
      assert.deepEqual(current, baseline, 'complete localized hub output must preserve stable canonical prices and fallbacks');
      assert.deepEqual(observe.counts, { policy: 1, begin: 126, state: 126, selected: 126,
        commit: 126, rollback: 0, other: 0 });
    }
  });
});

test('custom public quote injection performs no default policy I/O and retains all model, audio and product attempts', async () => {
  await fixture(async (_database, observe) => {
    let models = 0;
    let audio = 0;
    let products = 0;
    const data = await buildCurrentPricingHubData('en', async () => {
      models++;
      return { status: 'exact', amountCents: 333, currency: 'USD', revision: 'injected', scenarioLabel: 'Injected' };
    }, {
      audio: async () => { audio++; return { totalCents: 444, currency: 'USD' }; },
      product: async () => { products++; return { totalCents: 555, currency: 'USD' }; },
    });
    assert.deepEqual({ models, audio, products }, { models: 132, audio: 9, products: 12 });
    assert.deepEqual(observe.counts, freshCounts(), 'an injected reader must remain entirely in control');
    assert.equal(pikaAmount(data), 333);
  });
});

test('active and missing tariff cells preserve complete EN/FR/ES hub output and the same selected transactions', async () => {
  await fixture(async (database, observe) => {
    const scenario = resolvePublicModelScenario(pikaInput)!;
    const create = { operation: 'create' as const, scenarioId: scenario.id, customerCents: 37 };
    await confirmCustomerTariffChange(create, (await previewCustomerTariffChange(create)).fingerprint, actor, () => {});
    await database.pool.query('UPDATE app_customer_tariff_state SET active = TRUE');
    for (const hasCell of [true, false]) {
      if (!hasCell) await database.pool.query('DELETE FROM app_customer_tariff_cells');
      for (const locale of ['en', 'fr', 'es'] as const) {
        observe.reset();
        const baseline = await buildCurrentPricingHubData(locale, quotePublicModelScenario, unavailableOther);
        assert.deepEqual(observe.counts, { policy: 126, begin: 126, state: 126, selected: 126,
          commit: 126, rollback: 0, other: 0 });
        observe.reset();
        const current = await buildCurrentPricingHubData(locale, undefined, unavailableOther);
        assert.deepEqual(current, baseline);
        assert.equal(pikaAmount(current), hasCell ? 37 : undefined, 'missing active cells must not fall back to legacy prices');
        assert.deepEqual(observe.counts, { policy: 1, begin: 126, state: 126, selected: 126,
          commit: 126, rollback: 0, other: 0 });
      }
    }
  });
});

test('an unavailable policy remains unavailable across the whole hub and a fresh render recovers', async () => {
  await fixture(async (database, observe) => {
    for (const locale of ['en', 'fr', 'es'] as const) {
      const healthy = await buildCurrentPricingHubData(locale, undefined, unavailableOther);
      await database.pool.query('ALTER TABLE app_pricing_rules RENAME TO fixture_saved_pricing_rules');
      observe.reset();
      const baseline = await buildCurrentPricingHubData(locale, quotePublicModelScenario, unavailableOther);
      assert.equal(observe.counts.policy, 126);
      assert.equal(observe.counts.begin, 0);
      observe.reset();
      const current = await buildCurrentPricingHubData(locale, undefined, unavailableOther);
      assert.deepEqual(current, baseline, 'a failed policy read cannot turn versioned amounts into current prices');
      assert.ok(observe.counts.policy > 1 && observe.counts.policy <= 126, 'unavailable loads must remain retryable in this render');
      assert.equal(observe.counts.begin, 0);
      await database.pool.query('ALTER TABLE fixture_saved_pricing_rules RENAME TO app_pricing_rules');
      observe.reset();
      assert.deepEqual(await buildCurrentPricingHubData(locale, undefined, unavailableOther), healthy);
      assert.equal(observe.counts.policy, 1);
      assert.equal(observe.counts.commit, 126);
    }
  });
});

test('a rejected default policy read can recover during the same hub without poisoning the next render', async () => {
  await fixture(async (_database, observe) => {
    const healthy = await buildCurrentPricingHubData('en', undefined, unavailableOther);
    observe.reset();
    observe.before = (category, ordinal) => {
      if (category === 'policy' && ordinal === 1) throw new Error('Transient policy query rejection');
    };
    const recovering = await buildCurrentPricingHubData('en', undefined, unavailableOther);
    assert.equal(observe.counts.policy, 2);
    assert.ok(observe.counts.commit > 0 && observe.counts.commit < 126, 'affected quotes stay unavailable; later admitted inputs recover');
    assert.notDeepEqual(recovering, healthy);
    observe.before = undefined;
    observe.reset();
    assert.deepEqual(await buildCurrentPricingHubData('en', undefined, unavailableOther), healthy);
    assert.equal(observe.counts.policy, 1);
    assert.equal(observe.counts.commit, 126);
  });
});

test('overlapping default hubs keep their captured policies isolated and the next hub sees persisted policy updates', async () => {
  await fixture(async (database, observe) => {
    const baseline = await buildCurrentPricingHubData('en', undefined, unavailableOther);
    assert.equal(pikaAmount(baseline), 26);
    observe.reset();
    let release!: () => void;
    let captured!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const firstRead = new Promise<void>(resolve => { captured = resolve; });
    observe.after = (category, ordinal) => {
      if (category === 'policy' && ordinal === 1) { captured(); return held; }
    };
    const first = buildCurrentPricingHubData('en', undefined, unavailableOther);
    try {
      await firstRead;
      await database.pool.query("UPDATE app_pricing_rules SET margin_percent = 0.8 WHERE id = 'default'");
      const second = await buildCurrentPricingHubData('en', undefined, unavailableOther);
      assert.equal(pikaAmount(second), 36);
      release();
      assert.deepEqual(await first, baseline, 'the first hub must retain the complete successful result captured before the update');
      assert.deepEqual(observe.counts, { policy: 2, begin: 252, state: 252, selected: 252,
        commit: 252, rollback: 0, other: 0 });
      observe.after = undefined;
      observe.reset();
      assert.deepEqual(await buildCurrentPricingHubData('en', undefined, unavailableOther), second);
      assert.equal(observe.counts.policy, 1);
    } finally {
      release();
      await first;
    }
  });
});

test('a captured policy does not capture tariff state: later quotes see a confirmed admin tariff update', async () => {
  await fixture(async (database, observe) => {
    const scenario = resolvePublicModelScenario(pikaInput)!;
    const create = { operation: 'create' as const, scenarioId: scenario.id, customerCents: 37 };
    await confirmCustomerTariffChange(create, (await previewCustomerTariffChange(create)).fingerprint, actor, () => {});
    await database.pool.query('UPDATE app_customer_tariff_state SET active = TRUE');
    observe.reset();
    const quote = createScopedPublicModelQuoter();
    const before = await quote(pikaInput);
    assert.equal(before.status, 'exact');
    if (before.status === 'exact') assert.equal(before.amountCents, 37);
    assert.equal(observe.counts.policy, 1);
    const update = { operation: 'update' as const, scenarioId: scenario.id, customerCents: 41 };
    const refreshes: string[] = [];
    await confirmCustomerTariffChange(update, (await previewCustomerTariffChange(update)).fingerprint, actor,
      id => refreshes.push(id));
    assert.deepEqual(refreshes, [pikaInput.modelId]);
    observe.reset();
    const after = await quote(pikaInput);
    assert.equal(after.status, 'exact');
    if (before.status === 'exact' && after.status === 'exact') {
      assert.equal(after.amountCents, 41);
      assert.notEqual(after.revision, before.revision);
    }
    assert.deepEqual(observe.counts, { policy: 0, begin: 1, state: 1, selected: 1,
      commit: 1, rollback: 0, other: 0 });
  });
});

test('tariff read failures retain independent rollback and truthful complete hub fallbacks, with fresh-render recovery', async () => {
  await fixture(async (_database, observe) => {
    for (const locale of ['en', 'fr', 'es'] as const) {
      const healthy = await buildCurrentPricingHubData(locale, undefined, unavailableOther);
      observe.before = category => { if (category === 'state') throw new Error('Tariff state unavailable'); };
      observe.reset();
      const baseline = await buildCurrentPricingHubData(locale, quotePublicModelScenario, unavailableOther);
      assert.deepEqual(observe.counts, { policy: 126, begin: 126, state: 126, selected: 0,
        commit: 0, rollback: 126, other: 0 });
      observe.reset();
      const current = await buildCurrentPricingHubData(locale, undefined, unavailableOther);
      assert.deepEqual(current, baseline);
      assert.notDeepEqual(current, healthy);
      assert.deepEqual(observe.counts, { policy: 1, begin: 126, state: 126, selected: 0,
        commit: 0, rollback: 126, other: 0 });
      observe.before = undefined;
      observe.reset();
      assert.deepEqual(await buildCurrentPricingHubData(locale, undefined, unavailableOther), healthy);
      assert.equal(observe.counts.policy, 1);
      assert.equal(observe.counts.commit, 126);
    }
  });
});
