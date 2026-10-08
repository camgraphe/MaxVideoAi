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
import { customerTariffCellId } from '../frontend/server/pricing/customer-tariff-seed';
import { computeConfiguredPreflight } from '../frontend/src/server/engines';
import { priceCanonicalGeneration } from '../frontend/src/server/agent-api/generation-pricing';
import { quotePublicModelScenario, resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { confirmCustomerTariffChange, loadCustomerTariffScenarioDetail, previewCustomerTariffChange } from '../frontend/server/pricing-admin/customer-tariff-service';
import { quoteCurrentExamplePrice } from '../frontend/server/current-example-price';
import { resolveCurrentModelPublicOffer } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/current-model-public-offer';
import { buildPricePerImageLabel, buildPricePerImageRows, buildPricePerSecondLabel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing';
import { computeCurrentPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { mergeEngineLocalizedContent } from '../frontend/lib/models/i18n-normalization';
import { makeModelPagePricingHarness, findModelLayoutElements } from './helpers/model-page-pricing-harness';
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

test('GPT labels, rows and route use explicit image scenarios across effective policy and active tariffs', async () => {
  const database = await startDisposablePostgres('gpt-model-price-parity');
  const previous = {DATABASE_URL:process.env.DATABASE_URL,NODE_ENV:process.env.NODE_ENV,PRICING_SANDBOX:process.env.PRICING_SANDBOX};
  Object.assign(process.env,{DATABASE_URL:database.databaseUrl,NODE_ENV:'development',PRICING_SANDBOX:'1'});
  let current: Awaited<ReturnType<typeof makeModelPagePricingHarness>> | undefined;
  let prior: Awaited<ReturnType<typeof makeModelPagePricingHarness>> | undefined;
  const actor = '11111111-1111-4111-8111-111111111111';
  try {
    current=await makeModelPagePricingHarness();
    prior=await makeModelPagePricingHarness({legacyLabels:true});
    const currentHarness=current.harness;
    const priorHarness=prior.harness;
    await database.pool.query(`CREATE TABLE app_pricing_rules (
      id TEXT PRIMARY KEY, engine_id TEXT, resolution TEXT, mode TEXT,
      margin_percent NUMERIC, margin_flat_cents INTEGER, surcharge_audio_percent NUMERIC,
      surcharge_upscale_percent NUMERIC, currency TEXT, compatibility_profile TEXT,
      vendor_account_id TEXT, effective_from TIMESTAMPTZ, updated_at TIMESTAMPTZ, updated_by UUID);
      INSERT INTO app_pricing_rules (id,margin_percent,margin_flat_cents,surcharge_audio_percent,surcharge_upscale_percent,currency)
      VALUES ('default',0.3,0,0.2,0.5,'USD');`);
    for (const migration of ['27_pricing_admin_cockpit.sql','54_customer_tariff_cells.sql','55_customer_tariff_versions.sql']) {
      await database.pool.query(readFileSync(`neon/migrations/${migration}`,'utf8'));
    }
    const engine=getFalEngineById('gpt-image-2')!;
    const sizes=['1024x768','1024x1024','1024x1536','1920x1080','2560x1440','3840x2160'];
    const scenarios=new Map<string,ReturnType<typeof resolvePublicModelScenario>>();
    // Explicit retail fixture amounts exceed the supplier facts and distinguish
    // every size/quality. No commercial policy or catalogue amount is rewritten.
    for (const [index,resolution] of sizes.entries()) {
      for (const [quality,baseCents] of [['low',11],['medium',41],['high',91]] as const) {
        const scenario=resolvePublicModelScenario({modelId:engine.id,mode:'t2i',durationSec:1,resolution,quality,quantity:1})!;
        assert.ok(scenario,`${resolution}/${quality}`);
        scenarios.set(`${resolution}/${quality}`,scenario);
        await database.pool.query(`INSERT INTO app_customer_tariff_cells
          (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
          VALUES ($1,$2,$3::jsonb,$4::jsonb,'USD',NOW()-INTERVAL '1 day',1,$5)`,[
          customerTariffCellId(scenario.id),JSON.stringify(Object.entries(scenario.selector).sort(([a],[b])=>a.localeCompare(b))),
          JSON.stringify(scenario.selector),JSON.stringify({kind:'fixed',customerCents:baseCents+index}),actor,
        ]);
      }
    }
    await database.pool.query('UPDATE app_customer_tariff_state SET revision=1');
    assert.equal(customerTariffsEnabledByCode(),true);
    for (const h of [currentHarness,priorHarness]) {h.setQuote(computeCurrentPublicSnapshot);h.setPublicQuote(quotePublicModelScenario);}
    async function assertCurrentConsumers(minCents:2|3|11|12,firstPointCents:2|3|11|17,offerCents:20|45|91|101) {
      for (const locale of ['en','fr','es'] as const) {
        const base=JSON.parse(readFileSync(`content/models/en/${engine.modelSlug}.json`,'utf8'));
        const overlay=JSON.parse(readFileSync(`content/models/${locale}/${engine.modelSlug}.json`,'utf8'));
        const input={engine,locale,localizedContent:mergeEngineLocalizedContent(base,overlay),
          detailCopy:{backLabel:'Back',pricingLinkLabel:'Pricing',breadcrumb:{home:'Home',models:'Models'}}};
        const label=await buildPricePerImageLabel(engine.engine,locale);
        const cents=String(minCents).padStart(2,'0');
        assert.equal(label,{en:`$0.${cents}/image`,fr:`0,${cents}\u00a0$US/image`,es:`USD\u00a00.${cents}/image`}[locale]);
        const rows=await buildPricePerImageRows(engine.engine,locale,'Current image price');
        assert.equal(rows.length,1);
        assert.equal(rows[0].valueLines?.length,18);
        assert.ok(rows[0].valueLines?.[0].includes(`0${locale==='fr'?',':'.'}${String(firstPointCents).padStart(2,'0')}`));
        assert.equal((await resolveCurrentModelPublicOffer(engine,engine.engine))?.amountCents,offerCents);
        currentHarness.configure(input);priorHarness.configure(input);
        const result=await currentHarness.page({params:Promise.resolve({slug:engine.modelSlug,locale})});
        const original=await priorHarness.page({params:Promise.resolve({slug:engine.modelSlug,locale})});
        assert.equal(currentHarness.calls.length,36);
        assert.equal(priorHarness.calls.length,37);
        assert.equal(result.props.pricePerImageLabel,label);
        assert.equal(result.props.pricePerSecondLabel,null);
        assert.deepEqual(result.props.keySpecRows,original.props.keySpecRows);
        const priceRow=result.props.keySpecRows.find((row:any)=>row.key==='pricePerImage');
        assert.deepEqual(priceRow.valueLines,rows[0].valueLines);
        const elements=findModelLayoutElements(await currentHarness.layout(result.props));
        const product=elements.filter(row=>row.name==='script').map(row=>JSON.parse(row.props.dangerouslySetInnerHTML.__html))
          .find(row=>row['@type']==='Product');
        assert.equal(product.offers.price,(offerCents/100).toFixed(2));
        assert.equal(elements.find(row=>row.name==='ModelDecisionPricingCard')?.props.offer.amountCents,offerCents);
      }
    }
    // Before activation the real current-policy quote supplies all 18 image points.
    await assertCurrentConsumers(2,2,20);
    await database.pool.query('UPDATE app_pricing_rules SET margin_percent=2,updated_at=NOW() WHERE id=\'default\'');
    await assertCurrentConsumers(3,3,45);
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE');
    // These are actual supported t2i cells. Marketing must supply that mode at
    // its caller boundary; no quote adapter adds it on behalf of this test.
    await assertCurrentConsumers(11,11,91);
    for (const [key,customerCents] of [['1024x768/low',17],['1024x768/high',101]] as const) {
      const update={operation:'update' as const,scenarioId:scenarios.get(key)!.id,customerCents};
      await confirmCustomerTariffChange(update,(await previewCustomerTariffChange(update)).fingerprint,actor,()=>{});
    }
    await assertCurrentConsumers(12,17,101);
    const points=await computeMarketingPricePoints(engine.engine,{requireCurrentPolicy:true,limit:null});
    assert.equal(points.length,18);
    for (const point of points) {
      const index=sizes.indexOf(point.resolution);
      const expected=point.resolution==='1024x768' && point.quality==='low'?17
        :point.resolution==='1024x768' && point.quality==='high'?101
        :({low:11,medium:41,high:91}[point.quality as 'low'|'medium'|'high']+index);
      assert.equal(point.cents,expected);
      const scenario=scenarios.get(`${point.resolution}/${point.quality}`)!;
      assert.equal((await computeCanonicalBillingSnapshot(scenario.context)).totalCents,expected);
      const publicQuote=await quotePublicModelScenario({modelId:engine.id,mode:'t2i',durationSec:1,
        resolution:point.resolution,quality:point.quality,quantity:1});
      assert.equal(publicQuote.status,'exact');
      if(publicQuote.status==='exact') assert.equal(publicQuote.amountCents,expected);
    }
    // A missing active exact offer cell cannot fall back to an authored amount.
    const missing=scenarios.get('1024x768/high')!;
    await database.pool.query('DELETE FROM app_customer_tariff_cells WHERE selector_json=$1::jsonb',[JSON.stringify(missing.selector)]);
    const partial=await buildPricePerImageRows(engine.engine,'en','Current image price');
    assert.equal(partial[0].valueLines?.length,17);
    assert.equal(await resolveCurrentModelPublicOffer(engine,engine.engine),null);
    // Generic family coverage uses actual supported scenarios and current cells,
    // including Uni's reference-count projection; no model-specific mode branch.
    for (const [modelId,resolution] of [['nano-banana','square_hd'],['luma-uni-1','2K'],['seedream-5-0-pro','2K']] as const) {
      const entry=getFalEngineById(modelId)!;
      const scenario=resolvePublicModelScenario({modelId,mode:'t2i',durationSec:1,resolution,quantity:1})!;
      assert.ok(scenario,modelId);
      await database.pool.query(`INSERT INTO app_customer_tariff_cells
        (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
        VALUES ($1,$2,$3::jsonb,$4::jsonb,'USD',NOW()-INTERVAL '1 day',1,$5)`,[
        customerTariffCellId(scenario.id),JSON.stringify(Object.entries(scenario.selector).sort(([a],[b])=>a.localeCompare(b))),
        JSON.stringify(scenario.selector),JSON.stringify({kind:'fixed',customerCents:500}),actor,
      ]);
      const points=await computeMarketingPricePoints(entry.engine,{requireCurrentPolicy:true,limit:null});
      assert.equal(points.length,1,modelId);
      assert.equal(points[0].resolution,resolution);
      assert.equal(points[0].cents,500,modelId);
      assert.equal((await computeCanonicalBillingSnapshot(scenario.context)).totalCents,500,modelId);
      assert.equal((await quotePublicModelScenario({modelId,mode:'t2i',durationSec:1,resolution,quantity:1}) as
        {amountCents?:number}).amountCents,500,modelId);
    }
    // Required policy read failure cannot display authored historical fallback prices.
    await database.pool.query('DROP TABLE app_pricing_rules');
    assert.equal(await buildPricePerImageLabel(engine.engine,'en'),null);
    assert.deepEqual(await buildPricePerImageRows(engine.engine,'en','Current image price'),[]);
    const input={engine,locale:'en',localizedContent:mergeEngineLocalizedContent({},{}),detailCopy:{breadcrumb:{}}};
    currentHarness.configure(input);
    const unavailable=await currentHarness.render(input);
    assert.equal(unavailable.props.pricePerImageLabel,null);
    assert.equal(unavailable.props.keySpecValues.pricePerImage,'Data pending');
    assert.ok(unavailable.props.keySpecRows.every((row:any)=>!row.value.includes('$')));
  } finally {
    await current?.dispose();await prior?.dispose();
    await getDb().end().catch(()=>undefined);await database.cleanup();
    for (const [key,value] of Object.entries(previous)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});
