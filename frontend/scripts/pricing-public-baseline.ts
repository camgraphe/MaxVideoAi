import { readFile, writeFile } from 'node:fs/promises';

const DETERMINISTIC_ENV_KEYS = [
  'DATABASE_URL',
  'LUMARAY2_BASE_5S_540P_USD',
  'LUMARAY2_FLASH_BASE_5S_540P_USD',
  'LUMARAY2_MODIFY_PER_SECOND_USD',
  'LUMARAY2_FLASH_MODIFY_PER_SECOND_USD',
  'LUMARAY2_REFRAME_PER_SECOND_USD',
  'LUMARAY2_FLASH_REFRAME_PER_SECOND_USD',
] as const;

async function main(): Promise<void> {
  for (const key of DETERMINISTIC_ENV_KEYS) delete process.env[key];
  const collector = await import('./pricing-public-baseline-collector');
  const rows = await collector.collectPublicPricingProjectionRows();
  const fixturePath = new URL('../../tests/fixtures/pricing-public-projections.v1.json', import.meta.url);
  const expected = `${JSON.stringify(
    {
      version: 1,
      generatedFrom: 'canonical-public-pricing-paths',
      rows,
    },
    null,
    2
  )}\n`;

  if (process.argv.includes('--write')) {
    await writeFile(fixturePath, expected);
    console.log(`[pricing-public-baseline] wrote ${rows.length} rows`);
    return;
  }

  const current = await readFile(fixturePath, 'utf8').catch(() => '');
  if (current !== expected) {
    console.error(
      '[pricing-public-baseline] drift detected; run pnpm pricing:public-baseline:generate after intentional review'
    );
    process.exitCode = 1;
    return;
  }
  console.log(`[pricing-public-baseline] current (${rows.length} rows)`);
}

void main().catch((error: unknown) => {
  console.error(
    '[pricing-public-baseline] failed',
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  );
  process.exitCode = 1;
});
