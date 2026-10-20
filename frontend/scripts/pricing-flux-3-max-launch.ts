import { readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

async function main() {
  // The public collector is an offline canonical projection, never a live tariff activation.
  delete process.env.DATABASE_URL;
  const { collectPublicPricingProjectionRows } = await import('./pricing-public-baseline-collector');
  const rows = (await collectPublicPricingProjectionRows()).filter((row) => row.engineId === 'flux-3-max');
  if (rows.length !== 12 || new Set(rows.map((row) => row.id)).size !== 12) {
    throw new Error('FLUX.3 Max launch must cover its 12 distinct public projection scenarios.');
  }
  const fixture = { version: 1, generatedFrom: 'reviewed-flux-3-max-normal-list-launch', reviewedAt: '2026-10-20', rows };
  const fixturePath = new URL('../../tests/fixtures/flux-3-max-public-pricing-launch-2026-10-20.json', import.meta.url);
  if (process.argv.includes('--write')) {
    await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
    console.log(`[flux-3-max-public-pricing] wrote ${rows.length} rows`);
    return;
  }
  const expected = JSON.parse(await readFile(fixturePath, 'utf8'));
  if (!isDeepStrictEqual(fixture, expected)) throw new Error('FLUX.3 Max public pricing launch projection drift.');
  console.log(`[flux-3-max-public-pricing] current (${rows.length} rows)`);
}

void main().catch((error: unknown) => {
  console.error('[flux-3-max-public-pricing] failed', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
