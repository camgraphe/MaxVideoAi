import { readFile, writeFile } from 'node:fs/promises';

import { collectCanonicalPricingOutputs } from '../frontend/src/lib/pricing-audit/canonical-collectors';
import type { FrozenPricingOutput } from '../frontend/src/lib/pricing-audit/types';

async function main(): Promise<void> {
  const frozenFixturePath = new URL('../tests/fixtures/pricing-parity.v1.json', import.meta.url);
  const additionsFixturePath = new URL('../tests/fixtures/pricing-shadow-additions.v1.json', import.meta.url);
  const frozen = JSON.parse(await readFile(frozenFixturePath, 'utf8')) as { rows: FrozenPricingOutput[] };
  const current = JSON.parse(await readFile(additionsFixturePath, 'utf8')) as {
    rows: FrozenPricingOutput[];
  };
  const frozenIds = new Set(frozen.rows.map((row) => row.scenarioId));
  const generatedRows = collectCanonicalPricingOutputs([...frozen.rows, ...current.rows])
    .filter((row) => !frozenIds.has(row.scenarioId))
    .map(({ engineId: _engineId, policySource: _policySource, policyRuleId: _policyRuleId, ...row }) => row);
  const expected = `${JSON.stringify(
    {
      version: 1,
      generatedFrom: 'registry-publication-shadow-additions',
      rows: generatedRows,
    },
    null,
    2,
  )}\n`;

  if (process.argv.includes('--write')) {
    await writeFile(additionsFixturePath, expected);
    console.log(`[pricing-shadow-additions] wrote ${generatedRows.length} rows`);
    return;
  }

  const actual = await readFile(additionsFixturePath, 'utf8').catch(() => '');
  if (actual !== expected) {
    console.error(
      '[pricing-shadow-additions] drift detected; run pnpm pricing:shadow-additions:generate after intentional review',
    );
    process.exitCode = 1;
    return;
  }
  console.log(`[pricing-shadow-additions] current (${generatedRows.length} rows)`);
}

void main().catch((error: unknown) => {
  console.error(
    '[pricing-shadow-additions] failed',
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  );
  process.exitCode = 1;
});
