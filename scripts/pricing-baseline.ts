import { readFile, writeFile } from 'node:fs/promises';

import { collectLegacyPricingOutputs } from '../frontend/src/lib/pricing-audit/legacy-collectors';

async function main(): Promise<void> {
  const fixturePath = new URL('../tests/fixtures/pricing-parity.v1.json', import.meta.url);
  const rows = await collectLegacyPricingOutputs();
  const expected = `${JSON.stringify(
    {
      version: 1,
      generatedFrom: 'legacy-authoritative-pricing-paths',
      rows,
    },
    null,
    2
  )}\n`;

  if (process.argv.includes('--write')) {
    await writeFile(fixturePath, expected);
    console.log(`[pricing-baseline] wrote ${rows.length} rows`);
  } else {
    const current = await readFile(fixturePath, 'utf8').catch(() => '');
    if (current !== expected) {
      console.error('[pricing-baseline] drift detected; run pnpm pricing:baseline:generate after intentional review');
      process.exitCode = 1;
    } else {
      console.log(`[pricing-baseline] current (${rows.length} rows)`);
    }
  }
}

void main();
