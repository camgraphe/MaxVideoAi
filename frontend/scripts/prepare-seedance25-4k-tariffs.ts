import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareSeedanceAdminBatches } from '../server/pricing-admin/tariff-batches/seedance';
import { parseTariffBatchProposal } from '../server/pricing-admin/tariff-batches/input';

/** Offline only. Each import previews missing cells and confirms under the current tariff revision. */
async function main() {
  const [directory, ...extra] = process.argv.slice(2);
  if (!directory || extra.length) throw new Error('Usage: prepare-seedance25-4k-tariffs.ts OUTPUT_DIRECTORY');
  const proposals = prepareSeedanceAdminBatches('seedance-2-5').filter(proposal => proposal.intent === 'create_missing'
    && proposal.selections.every(selection => selection.selector.resolution === '4k'));
  const checked = proposals.map(parseTariffBatchProposal);
  if (checked.length !== 9 || checked.some(proposal => proposal.intent !== 'create_missing')
    || checked.reduce((count, proposal) => count + (proposal.intent === 'rollback' ? 0 : proposal.selections.length), 0) !== 1944) {
    throw new Error('Unexpected 4K tariff scope.');
  }
  const output = path.resolve(directory);
  await mkdir(output, { recursive: true });
  for (const [index, proposal] of checked.entries()) {
    await writeFile(path.join(output, `seedance-2-5-4k-${String(index + 1).padStart(2, '0')}.json`), JSON.stringify(proposal, null, 2) + '\n');
  }
  console.log(JSON.stringify({ modelId: 'seedance-2-5', resolution: '4k', multiplier: 2, cells: 1944,
    batches: checked.length, intent: 'create_missing', output, activated: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
