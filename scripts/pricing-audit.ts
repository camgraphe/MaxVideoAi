import { readFile } from 'node:fs/promises';

import { buildPricingAuditMatrix } from '../frontend/src/lib/pricing-audit/matrix';
import type { FrozenPricingOutput } from '../frontend/src/lib/pricing-audit/types';

async function main(): Promise<void> {
  const fixturePath = new URL('../tests/fixtures/pricing-parity.v1.json', import.meta.url);
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as { rows: FrozenPricingOutput[] };
  const matrix = await buildPricingAuditMatrix(fixture.rows);
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(matrix, null, 2)}\n`);
  } else {
    console.log(
      `[pricing-audit] ${matrix.summary.scenarios} scenarios; ${matrix.summary.matches} matches; ${matrix.summary.mismatches} mismatches; ${matrix.summary.compatibilityProfiles} compatibility profiles`
    );
    for (const row of matrix.rows.filter((candidate) => candidate.status === 'mismatch')) {
      console.error(
        `[pricing-audit] ${row.scenarioId}: current=${row.currentTotalCents} canonical=${row.canonicalTotalCents} delta=${row.deltaCents}`
      );
    }
  }
  if (matrix.summary.mismatches > 0) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(
    '[pricing-audit] failed',
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  );
  process.exitCode = 1;
});
