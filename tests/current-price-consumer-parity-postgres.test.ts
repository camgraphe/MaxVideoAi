import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getDb } from '../frontend/src/lib/db';
import { computeMarketingPricePoints, computeMarketingPriceRange } from '../frontend/src/lib/pricing-marketing';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { customerTariffsEnabledByCode } from '../frontend/server/pricing/customer-tariff-store';
import { computeConfiguredPreflight } from '../frontend/src/server/engines';
import { priceCanonicalGeneration } from '../frontend/src/server/agent-api/generation-pricing';
import { quotePublicModelScenario, resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { confirmCustomerTariffChange, loadCustomerTariffScenarioDetail, previewCustomerTariffChange } from '../frontend/server/pricing-admin/customer-tariff-service';
import { quoteCurrentExamplePrice } from '../frontend/server/current-example-price';
import { resolveCurrentModelPublicOffer } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/current-model-public-offer';
import { buildPricePerSecondLabel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing';
import { buildSpecValues } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-values';
import { refreshModelDecisionPricingScenarios } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/current-model-decision-pricing';
import { buildCurrentPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/currentPricingHubData';
import { buildHomePriceDemo } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-price-demo-data';
import { buildCurrentHomePriceDemo } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/current-home-price-demo-data';
import { CATALOG_BY_SLUG } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config';
import { resolvePricingDisplay } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-pricing';
import { buildCompareSpecRows } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-rows';
import { buildSpecValues as buildCompareSpecValues } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values';
import { startDisposablePostgres } from './helpers/disposable-postgres';

const require = createRequire(import.meta.url);
// Next maps this boundary marker to its empty implementation for server rendering.
// Keep all catalogue reads and pricing owners real in this Node server fixture.
const serverMarker = registerHooks({ resolve(specifier, context, nextResolve) {
  return specifier === 'server-only'
    ? { url: pathToFileURL(require.resolve('../frontend/node_modules/next/dist/compiled/server-only/empty')).href,
        shortCircuit: true }
    : nextResolve(specifier, context);
} });
let buildModelsCatalogCards: typeof import('../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-cards')['buildModelsCatalogCards'];
try {
  ({ buildModelsCatalogCards } = require('../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-cards'));
} finally {
  serverMarker.deregister();
}

test('confirmed admin tariffs propagate to billing, public quotes, Pricing, model cards/specs, comparisons, examples and home', async () => {
  const database = await startDisposablePostgres('price-parity');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: database.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  const actor = '11111111-1111-4111-8111-111111111111';
  try {
    await database.pool.query(`CREATE TABLE app_pricing_rules (
      id TEXT PRIMARY KEY, engine_id TEXT, resolution TEXT, mode TEXT,
      margin_percent NUMERIC, margin_flat_cents INTEGER, surcharge_audio_percent NUMERIC,
      surcharge_upscale_percent NUMERIC, currency TEXT, compatibility_profile TEXT,
      vendor_account_id TEXT, effective_from TIMESTAMPTZ, updated_at TIMESTAMPTZ, updated_by UUID);
      INSERT INTO app_pricing_rules (id, margin_percent, margin_flat_cents, surcharge_audio_percent,
        surcharge_upscale_percent, currency) VALUES ('default', 0.3, 0, 0.2, 0.5, 'USD');`);
    for (const migration of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await database.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    const input = { modelId: 'pika-text-to-video', mode: 't2v', durationSec: 5, resolution: '720p' };
    const scenario = resolvePublicModelScenario(input)!;
    assert.ok(scenario);
    const [home] = buildHomePriceDemo('en');
    assert.ok(home);
    const homeScenarios = home.steps.map(step => resolvePublicModelScenario({ modelId: home.engine.id,
      mode: 't2v', durationSec: step.seconds, resolution: step.resolution, audio: true })!);
    assert.ok(homeScenarios.every(Boolean));
    const homeInitialCents: number[] = [];
    for (const row of [scenario, ...homeScenarios]) {
      const cents = (await computeCanonicalBillingSnapshot(row.context)).totalCents;
      const proposal = { operation: 'create' as const, scenarioId: row.id, customerCents: cents };
      await confirmCustomerTariffChange(proposal, (await previewCustomerTariffChange(proposal)).fingerprint, actor, () => {});
      if (row !== scenario) homeInitialCents.push(cents);
    }
    // Activation is confined to this disposable Unix-socket fixture.
    await database.pool.query('UPDATE app_customer_tariff_state SET active = TRUE');
    assert.equal(customerTariffsEnabledByCode(), true);
    const entry = getFalEngineById(input.modelId)!;
    const video = { id: 'historical', engineId: entry.id, durationSec: 5, finalPriceCents: 999,
      currency: 'USD', settingsSnapshot: { inputMode: 't2v', core: { durationSec: 5,
        resolution: '720p', aspectRatio: '16:9', audio: false } } } as never;
    const unavailable = async () => { throw new Error('unrelated product fixture absent'); };
    async function assertPikaConsumers(cents: number) {
      const unitUsd = cents / 500;
      assert.equal((await loadCustomerTariffScenarioDetail(entry.id, scenario.selector)).currentCents, cents);
      assert.equal((await computeCanonicalBillingSnapshot(scenario.context)).totalCents, cents);
      const live = await computeConfiguredPreflight({ engine: entry.id, mode: 't2v', durationSec: 5,
        resolution: '720p', aspectRatio: '16:9', fps: 24, user: { memberTier: 'member' } },
      { resolvedEngine: entry.engine, bootstrap: false });
      assert.equal(live.ok, true);
      assert.equal(live.total, cents);
      const mcp = await priceCanonicalGeneration({ schemaVersion: 1, surface: 'video',
        engineId: entry.id, mode: 't2v', prompt: 'Local quote parity fixture',
        settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' }, references: [], outputCount: 1 },
      'member', undefined, { resolvedEngine: entry.engine });
      assert.equal(mcp.priceCents, cents);
      const current = await quotePublicModelScenario(input);
      assert.equal(current.status, 'exact');
      if (current.status !== 'exact') throw new Error('Public quote unavailable');
      assert.equal(current.amountCents, cents);
      assert.equal((await resolveCurrentModelPublicOffer(entry, entry.engine))?.amountCents, cents);
      const examples = await quoteCurrentExamplePrice(video);
      assert.equal(examples.kind, 'exact');
      if (examples.kind === 'unavailable') throw new Error('Current example unavailable');
      assert.equal(examples.amountCents, cents);
      const cards = await refreshModelDecisionPricingScenarios(entry, 'en',
        [{ id: 'same', label: 'Same scenario', value: '$9.99' }],
        [{ id: 'same', seconds: 5, resolution: '720p', labelKey: 'standardPreview' }]);
      assert.equal(cards[0].value, `$${(cents / 100).toFixed(2)}`);
      const points = await computeMarketingPricePoints(entry.engine, { requireCurrentPolicy: true });
      assert.equal(points.find(point => point.resolution === '720p')?.cents, cents / 5,
        'catalogue cards preserve the exact unit amount from the scenario total');
      assert.equal((await computeMarketingPriceRange(entry.engine, { requireCurrentPolicy: true }))?.min.cents, cents / 5);
      const catalogueCards = await buildModelsCatalogCards({ activeLocale: 'en', engineMetaCopy: {},
        galleryCopy: {} as never, scope: 'video' });
      assert.equal(catalogueCards.find(card => card.engineId === entry.id)?.stats.priceFrom, `$${unitUsd}/s`);
      const label = await buildPricePerSecondLabel(entry.engine, 'en');
      assert.equal(label, `$${unitUsd}/s`);
      assert.equal(buildSpecValues(entry, { pricePerSecond: '$9.99/s' }, { pricePerSecond: label }).pricePerSecond, label);
      const comparison = await resolvePricingDisplay(CATALOG_BY_SLUG.get(entry.modelSlug)!, 'en', entry.engine);
      assert.equal(comparison.headline, `720p: $${unitUsd}/s`);
      assert.equal(comparison.scorePrices?.length, 1);
      assert.ok(Math.abs(comparison.scorePrices![0] - unitUsd) < 1e-12);
      const compareEntry = CATALOG_BY_SLUG.get(entry.modelSlug)!;
      const specRows = buildCompareSpecRows({ left: compareEntry, right: compareEntry,
        leftSpecs: buildCompareSpecValues(compareEntry), rightSpecs: buildCompareSpecValues(compareEntry),
        leftPricingDisplay: comparison, rightPricingDisplay: comparison,
        pairHasNativeAudio: false, specLabels: {} });
      assert.equal(specRows[0].left, comparison.headline);
      const pricing = await buildCurrentPricingHubData('en', undefined, { audio: unavailable, product: unavailable });
      const pricingRow = pricing.video.rows.find(row => row.id === entry.id)!;
      assert.ok(Object.values(pricingRow.quotes).some(quote => quote.status === 'exact' && quote.amountCents === cents));
      assert.ok(Object.values(pricingRow.quotes).some(quote => quote.status === 'exact'
        && quote.amountCents === cents && quote.rateDisplay === `$${unitUsd}/s`));
      assert.equal((video as { finalPriceCents: number }).finalPriceCents, 999);
      return current.revision;
    }
    const initialRevision = await assertPikaConsumers(26);
    const update = { operation: 'update' as const, scenarioId: scenario.id, customerCents: 31 };
    const refreshes: string[] = [];
    const preview = await previewCustomerTariffChange(update);
    assert.equal(preview.active, true);
    await confirmCustomerTariffChange(update, preview.fingerprint, actor,
      modelId => refreshes.push(modelId));
    assert.deepEqual(refreshes, [entry.id]);
    assert.notEqual(await assertPikaConsumers(31), initialRevision);
    assert.deepEqual((await buildCurrentHomePriceDemo('en'))[0].steps.map(step => step.amountCents), homeInitialCents);
    const homeUpdate = { operation: 'update' as const, scenarioId: homeScenarios[0].id, customerCents: homeInitialCents[0] + 5 };
    await confirmCustomerTariffChange(homeUpdate, (await previewCustomerTariffChange(homeUpdate)).fingerprint, actor, () => {});
    assert.deepEqual((await buildCurrentHomePriceDemo('en'))[0].steps.map(step => step.amountCents),
      [homeInitialCents[0] + 5, ...homeInitialCents.slice(1)]);
    assert.equal((await database.pool.query('SELECT count(*) FROM app_customer_tariff_cell_versions')).rows[0].count, '2');
  } finally {
    await getDb().end().catch(() => undefined);
    await database.cleanup();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
