import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAYG_PARITY_LOCALES, PAYG_SHOWCASE_FIXTURE, captureCurrentPaygManifest } from '../tests/helpers/payg-page-parity.ts';

async function main(): Promise<void> {
  if (process.argv[2] !== '--write') throw new Error('Pass --write to capture Pay-as-you-go parity fixtures.');
  const output = join(process.cwd(), 'tests/fixtures/payg-page-parity');
  mkdirSync(output, { recursive: true });
  for (const locale of PAYG_PARITY_LOCALES) {
    const fixture = {
      empty: await captureCurrentPaygManifest(locale, []),
      showcase: await captureCurrentPaygManifest(locale, PAYG_SHOWCASE_FIXTURE),
    };
    writeFileSync(join(output, `${locale}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
