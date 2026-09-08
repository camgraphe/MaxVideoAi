import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

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
  // The committed fixture remains the historical pre-retirement evidence.
  // Compare live stale-tier rows to the independently frozen standard-tier row,
  // preserving every other field and all scenarios without a tier dimension.
  if (process.argv.includes('--write')) {
    throw new Error('The historical public pricing fixture is frozen; do not regenerate it for membership retirement.');
  }
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as { rows: typeof rows };
  const audioChange = JSON.parse(await readFile(new URL('../../tests/fixtures/audio-pricing-change-2026-09-08.json', import.meta.url), 'utf8')) as { rows: Array<{ id: string; previousCents: number; totalCents: number }> };
  const audioChanges = new Map(audioChange.rows.map(row => [row.id, row]));
  if (audioChanges.size !== audioChange.rows.length || audioChanges.size !== 15) throw new Error('Invalid reviewed Audio pricing change matrix.');
  const appliedChanges = new Set<string>();
  const byId = new Map(fixture.rows.map((row) => [row.id, row]));
  const expected = fixture.rows.map((row) => {
    const standardId = row.id.replace(/:(plus|pro):/u, ':member:');
    const standard = byId.get(standardId);
    if (!standard) throw new Error(`Missing frozen standard scenario ${standardId}`);
    const audio = audioChanges.get(row.id);
    if (audio) {
      if (row.surface !== 'pricing-hub-audio' || row.customerTotalCents !== audio.previousCents) throw new Error(`Audio change does not match historical evidence: ${row.id}`);
      appliedChanges.add(row.id);
      return { ...standard, id: row.id, customerTotalCents: audio.totalCents, displayedAmount: `$${(audio.totalCents / 100).toFixed(2)}`, compatibilityProfile: 'audio-tripled-rounded' };
    }
    return { ...standard, id: row.id };
  });
  if (appliedChanges.size !== audioChanges.size) throw new Error('Missing Audio pricing change scenario.');
  if (!isDeepStrictEqual(rows, expected)) {
    const expectedById = new Map(expected.map((row) => [row.id, row]));
    const changed = rows.filter((row) => !isDeepStrictEqual(row, expectedById.get(row.id))).map((row) => row.id);
    console.error('[pricing-public-baseline] unexpected drift from standard pricing policy', changed);
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
