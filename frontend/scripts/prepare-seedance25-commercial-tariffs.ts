import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { evaluateManualTariffPrice } from '@maxvideoai/pricing/manual-tariff-price';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { prepareSeedance25CommercialTariffs } from '../server/pricing/seedance25-commercial-tariffs';
import { prepareSeedanceAdminBatches } from '../server/pricing-admin/tariff-batches/seedance';
import { parseTariffBatchProposal } from '../server/pricing-admin/tariff-batches/input';

/** Offline, read-only proposal. Input is a bounded export of current Seedance 2.5 cells. */
async function main() {
  const [snapshotPath, outputDirectory] = process.argv.slice(2);
  if (!snapshotPath || !outputDirectory) throw new Error('Usage: prepare-seedance25-commercial-tariffs.ts CURRENT_SNAPSHOT_JSON OUTPUT_DIRECTORY');
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as { revision: number; cells: ManualTariffCell[] };
  snapshot.revision = Number(snapshot.revision);
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.cells.length !== 4860
    || snapshot.cells.some(cell => cell.selector.engineId !== 'seedance-2-5' || cell.currency !== 'USD')) {
    throw new Error('Expected the complete current 4,860-cell Seedance 2.5 USD snapshot.');
  }
  const key = (cell: ManualTariffCell) => JSON.stringify(Object.entries(cell.selector).sort(([a], [b]) => a.localeCompare(b)));
  const current = new Map(snapshot.cells.map(cell => [key(cell), cell]));
  if (current.size !== snapshot.cells.length) throw new Error('Duplicate current tariff selector.');
  const at = new Date().toISOString();
  const plans = ['seedance-2-5', 'seedance-2-5-flash'].map(modelId => prepareSeedance25CommercialTariffs({
    modelId: modelId as 'seedance-2-5' | 'seedance-2-5-flash', at, standardEditTransport: 'modelark',
  }));
  const counts = { lower: 0, higher: 0, unchanged: 0, created: 0 };
  const rows = plans.flatMap(plan => plan.scenarios.map(({ context, cell }) => {
    const before = current.get(key(cell));
    if (plan.modelId === 'seedance-2-5' && !before) throw new Error('Existing tariff scope changed.');
    const quantities = { input_video_seconds: 2 };
    const beforeCents = before ? evaluateManualTariffPrice(before.price, quantities).customerTotalCents : null;
    const afterCents = evaluateManualTariffPrice(cell.price, quantities).customerTotalCents;
    counts[beforeCents === null ? 'created' : afterCents < beforeCents ? 'lower' : afterCents > beforeCents ? 'higher' : 'unchanged']++;
    return { modelId: plan.modelId, mode: context.mode, stage: context.workflowStep ?? 'normal', resolution: context.resolution,
      durationSec: context.durationSec, aspectRatio: context.aspectRatio, inputVideoSeconds: context.hasVideoInput ? 2 : 0,
      beforeCents, afterCents, selector: cell.selector };
  }));
  const resolved = path.resolve(outputDirectory);
  await mkdir(resolved, { recursive: true });
  for (const plan of plans) await writeFile(path.join(resolved, `${plan.modelId}.json`), JSON.stringify({
    policy: plan.policy, modelId: plan.modelId, multiplier: plan.multiplier, transport: plan.transport,
    sourceRevision: snapshot.revision, fingerprint: plan.fingerprint, preparedAt: at,
    cells: plan.cells.map(cell => ({ ...cell, id: current.get(key(cell))?.id ?? cell.id })),
  }, null, 2) + '\n');
  const adminDirectory = path.join(resolved, 'admin-batches');
  await mkdir(adminDirectory, { recursive: true });
  const adminBatches: Array<{ modelId: string; file: string; classes: number }> = [];
  for (const plan of plans) for (const [index, proposal] of prepareSeedanceAdminBatches(plan.modelId).entries()) {
    const checked = parseTariffBatchProposal(proposal);
    const file = `${plan.modelId}-${String(index + 1).padStart(2, '0')}.json`;
    await writeFile(path.join(adminDirectory, file), JSON.stringify(checked, null, 2) + '\n');
    adminBatches.push({ modelId: plan.modelId, file: `admin-batches/${file}`, classes: proposal.intent === 'rollback' ? 0 : proposal.selections.length });
  }
  const summary = { preparedAt: at, sourceRevision: snapshot.revision, counts,
    caveat: 'Representative comparisons use 2 seconds of source video. Continuous prices cover all positive source durations through 30 seconds. No tariff was written or activated.',
    representatives: rows.filter(row => row.durationSec === 5 && row.aspectRatio === '16:9' && ['t2v', 'v2v'].includes(row.mode!)),
    models: plans.map(plan => ({ modelId: plan.modelId, multiplier: plan.multiplier, cells: plan.cells.length, fingerprint: plan.fingerprint })),
    adminBatches, adminProcedure: 'Import each JSON in Admin Pricing > Tariff batches > Exact batch JSON. Preview and confirm sequentially; each operation checks the latest global revision, retains versions and receipts, and refreshes price surfaces. A pending page refresh is retried without reapplying prices.' };
  await writeFile(path.join(resolved, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({ sourceRevision: snapshot.revision, counts, models: summary.models, outputDirectory: resolved }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
