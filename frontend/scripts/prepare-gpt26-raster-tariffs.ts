import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { GPT_IMAGE_2_6_ENGINE_REGISTRY } from '@/config/fal-engines/gpt-image-2-6';
import { GPT_IMAGE_26_SIZE_LIMITS } from '@/lib/image/gptImage26Dimensions';
import { gpt26RasterEnvelope, gpt26RasterProposal } from '@/server/pricing-admin/tariff-batches/gpt26';
import { buildTariffBatchPlan } from '@/server/pricing-admin/tariff-batches/planner';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';
import type { PricingContext } from '@/lib/pricing-context';

/** Offline proposal authoring only: no environment loading, target access, preview persistence or apply path. */
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--out' || !args[1]) throw new Error('Usage: prepare-gpt26-raster-tariffs.ts --out NEW_DIRECTORY');
  const output = resolve(args[1]);
  const state = { status: 'loaded' as const, active: true, revision: 0, databaseCells: [] as ManualTariffCell[], versionedCells: [] as ManualTariffCell[] };
  const policy = { status: 'loaded' as const, rules: [] };
  const files: { name: string; content: string }[] = [];
  const examples: unknown[] = [];
  const batches: unknown[] = [];
  for (const modelId of ['gpt-image-2-6-flare', 'gpt-image-2-6-sunburst'] as const) {
    const proposal = gpt26RasterProposal(modelId);
    const plan = await buildTariffBatchPlan({ proposal, state, policy });
    if (plan.counts.conflict || plan.counts.create !== 24) throw new Error('Raster proposal qualification failed.');
    const content = `${JSON.stringify(proposal, null, 2)}\n`, name = `${modelId}-raster.json`;
    files.push({ name, content });
    batches.push({ file: name, classes: plan.rows.length, sha256: createHash('sha256').update(content).digest('hex'),
      conservativeAutoClasses: plan.rows.filter(row => row.rasterDomain?.conservativeOutput).length });
    const engine = GPT_IMAGE_2_6_ENGINE_REGISTRY.find(entry => entry.id === modelId)!.engine;
    const cases: Omit<PricingContext, 'engine'>[] = [
      ...['1536x864', '864x1536', '2048x2048', '2048x1152', '1152x2048', '3840x2160', '2160x3840'].map(resolution => ({ mode: 't2i' as const, resolution, durationSec: 1, quality: 'high' })),
      { mode: 't2i', resolution: 'custom', customImageSize: { width: 1600, height: 896 }, durationSec: 10, quality: 'high' },
      { mode: 'i2i', resolution: 'custom', customImageSize: { width: 1536, height: 864 }, durationSec: 10, quality: 'high', referenceImageCount: 16 },
      { mode: 't2i', resolution: '1536x864', durationSec: 1, quality: 'auto' },
      { mode: 't2i', resolution: 'auto', durationSec: 1, quality: 'high' },
      { mode: 't2i', resolution: 'auto', durationSec: 1, quality: 'auto' },
    ];
    for (const scenario of cases) {
      const quote = await computeCanonicalBillingSnapshot({ ...scenario, engine }, {
        loadCustomerTariffState: async () => ({ ...state, databaseCells: plan.rows.map(row => row.proposedCell!) }),
        pricingPolicy: { loadOverrides: async () => policy },
      });
      examples.push({ modelId, ...scenario, proposedCustomerCents: quote.totalCents, currency: quote.currency,
        outputEstimateKind: quote.meta?.providerCostKind, estimatedOutputTokens: quote.meta?.providerOutputImageTokens,
        conservativeOutputTokens: quote.meta?.providerConservativeOutputImageTokens ?? null });
    }
  }
  const report = { schemaVersion: 1, status: 'offline_proposal_not_applied', currentDatabaseRevision: null,
    releaseReviewRequired: true, existingExactCellsRequiredToRemainUnchanged: 2040, newClasses: 48, batches,
    retailRule: '(output LIST estimate + USD 0.01 per output + USD 0.02 per reference per output) × 1.50, final ceil cents',
    autoReview: '28 distinct auto classes use conservative output quantities, preserve provider auto settings, and require deliberate review.',
    supplierDisclosure: 'Output estimates only; reserves are not bounds on text/reference input cost, total provider invoice or margin.',
    limits: { ...GPT_IMAGE_26_SIZE_LIMITS, minOutputs: 1, maxOutputs: 10, maxReferences: 16 },
    envelope: gpt26RasterEnvelope(), examples,
    activation: 'Import each model proposal separately through the deployed native admin preview/confirm protocol only after explicit authorization. Review current-state fingerprint; preserve existing exact cells and receipts. No apply command exists in this script.' };
  files.push({ name: 'review.json', content: `${JSON.stringify(report, null, 2)}\n` });
  await mkdir(output, { recursive: false, mode: 0o700 });
  for (const file of files) await writeFile(join(output, file.name), file.content, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ status: report.status, newClasses: report.newClasses, files: files.map(file => join(output, file.name)) }));
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
