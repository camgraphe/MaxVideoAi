import assert from 'node:assert/strict';
import test from 'node:test';
import { recastHarness } from './helpers/character-recast-harness';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { withDbTransaction } from '../frontend/src/lib/db';
import { estimateImageGeneration } from '../frontend/src/server/images/estimate-image-generation';
import { resolveImageGenerationPricingSnapshot } from '../frontend/src/server/images/image-generation-pricing';
import { createInitialImageJobInExecutor } from '../frontend/src/server/images/image-initial-job';
import { buildCurrentOtherPricing } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/current-other-pricing';
import { buildPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';
import { formatCurrencyForLocale } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingPageContent';

test('new Character Studio images and looks use one Nano Banana 2.1 image with the same estimate, tariff revision and receipt', async (t) => {
  const f = await recastHarness(t);
  const engine = getFalEngineById('nano-banana-2-1')!.engine;
  for (const resolution of ['1k', '2k', '4k'])
    for (const mode of ['t2i', 'i2i'] as const)
      await t.test(`${mode}/${resolution}`, async () => {
        const estimate = await estimateImageGeneration({
          engineId: engine.id,
          mode,
          resolution,
          numImages: 1,
          aspectRatio: '3:4',
          referenceImageCount: mode === 'i2i' ? 1 : 0,
        });
        const { pricing } = await resolveImageGenerationPricingSnapshot({
          engine,
          mode,
          durationSec: 1,
          resolution,
          customImageSize: null,
          quality: null,
          combinedImageCount: mode === 'i2i' ? 1 : 0,
          enableWebSearch: false,
          numImages: 1,
          billingProductKey: null,
          billingQuantityMultiplier: 1,
          jobSurface: 'character',
          source: undefined,
          metadata: null,
          includedKlingFirstFrameParentJobId: null,
          resolvedAspectRatio: '3:4',
          trustedQuotedBilling: undefined,
          customerTariffRevision: String(estimate.pricing.meta?.customerTariffRevision),
        });
        assert.equal(estimate.pricing.totalCents, pricing.totalCents);
        assert.equal(estimate.pricing.meta?.customerTariffRevision, pricing.meta?.customerTariffRevision);
        const jobId = `character-${mode}-${resolution}`;
        const params = {
          userId: f.actor.userId,
          mode,
          jobId,
          surface: 'character' as const,
          billingProductKey: null,
          description: 'Character Studio',
          amountCents: pricing.totalCents,
          currency: 'USD',
          pricingSnapshotJson: JSON.stringify(pricing),
          auditPricingSnapshot: pricing,
          applicationFeeCents: null,
          vendorAccountId: null,
          engineId: engine.id,
          engineLabel: engine.label,
          durationSec: 0,
          prompt: 'Full dressed character',
          aspectRatio: '3:4',
          canUpscale: false,
          finalPriceCents: pricing.totalCents,
          costBreakdownJson: null,
          settingsSnapshotJson: JSON.stringify({ numImages: 1, resolution }),
          visibility: 'private' as const,
          indexable: false,
          preferredCurrency: 'usd',
          walletReservation: 'reserve' as const,
        };
        assert.equal(
          (await withDbTransaction((tx) => createInitialImageJobInExecutor(tx, params))).kind,
          'created',
        );
        assert.equal(
          (await withDbTransaction((tx) => createInitialImageJobInExecutor(tx, params))).kind,
          'existing_job',
        );
        const receipts = await f.receipts(jobId);
        assert.equal(receipts.length, 1);
        assert.equal(receipts[0].amount_cents, pricing.totalCents);
        assert.deepEqual(receipts[0].pricing_snapshot, pricing);
        assert.equal(estimate.normalized.numImages, 1);
        // Marketing reads the same native tariff as the estimate and reserved receipt.
        for (const locale of ['en', 'fr', 'es'] as const) {
          const publicRows = await buildCurrentOtherPricing(buildPricingHubData(locale).otherSurfaces, locale);
          const amount = formatCurrencyForLocale(locale, pricing.currency, pricing.totalCents / 100);
          const draft = publicRows.toolRows.find((row) => row.id === 'character-builder-draft')!;
          const final = publicRows.toolRows.find((row) => row.id === 'character-builder-final')!;
          if (resolution === '1k') assert.equal(draft.standardOutput, amount);
          if (resolution === '2k') assert.equal(final.standardOutput, amount);
          if (resolution === '4k') {
            assert.equal(draft.proOutput, `4K: ${amount}`);
            assert.equal(final.proOutput, `4K: ${amount}`);
          }
        }
      });
});
