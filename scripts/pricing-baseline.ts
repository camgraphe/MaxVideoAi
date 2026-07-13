import { readFile } from 'node:fs/promises';

import { validateFrozenPricingBaseline } from '../frontend/src/lib/pricing-audit/matrix';
import type { FrozenPricingOutput } from '../frontend/src/lib/pricing-audit/types';

async function main(): Promise<void> {
  if (process.argv.includes('--write')) {
    throw new Error('The pre-canonical pricing baseline is immutable and cannot be regenerated.');
  }
  const fixturePath = new URL('../tests/fixtures/pricing-parity.v1.json', import.meta.url);
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as {
    version: number;
    generatedFrom: string;
    rows: FrozenPricingOutput[];
  };
  if (fixture.version !== 1 || fixture.generatedFrom !== 'legacy-authoritative-pricing-paths') {
    throw new Error('Unexpected pre-canonical pricing baseline provenance.');
  }
  validateFrozenPricingBaseline(fixture.rows);
  if (fixture.rows.length !== 178) {
    throw new Error(`Expected 178 frozen pricing rows, found ${fixture.rows.length}.`);
  }
  console.log(`[pricing-baseline] immutable (${fixture.rows.length} rows)`);
}

void main().catch((error: unknown) => {
  console.error('[pricing-baseline] failed', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
