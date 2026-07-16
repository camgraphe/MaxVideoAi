import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  PAYG_PARITY_LOCALES,
  PAYG_SHOWCASE_FIXTURE,
  captureCurrentPaygManifest,
} from './helpers/payg-page-parity.ts';

const fixturesRoot = join(process.cwd(), 'tests/fixtures/payg-page-parity');

for (const locale of PAYG_PARITY_LOCALES) {
  test(`${locale} Pay-as-you-go semantics match the captured implementation`, async () => {
    const expected = JSON.parse(readFileSync(join(fixturesRoot, `${locale}.json`), 'utf8'));
    assert.deepEqual(await captureCurrentPaygManifest(locale, []), expected.empty);
    assert.deepEqual(await captureCurrentPaygManifest(locale, PAYG_SHOWCASE_FIXTURE), expected.showcase);
  });
}
