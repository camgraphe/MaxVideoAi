import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { collectPricingCutoverSchema, loadPricingCutoverMigrations, pricingCutoverTarget } from './_lib/pricing-cutover-schema';
import { withPricingCutoverReadOnlyClient } from './_lib/pricing-cutover-client';

async function main() {
  const input = process.env.PRICING_SCHEMA_ENV_FILE?.trim();
  const output = process.env.PRICING_SCHEMA_OUTPUT?.trim();
  if (!input || !output) throw new Error('Explicit input and new private output paths are required.');
  const source = await readFile(resolve(input), 'utf8');
  const { config, databaseIdentity } = pricingCutoverTarget(parse(source));
  const git = (args: string[]) => {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    if (result.status !== 0) throw new Error('Git evidence unavailable.');
    return result.stdout.trim();
  };
  if (git(['status', '--porcelain'])) throw new Error('Commit the candidate before recording its schema evidence.');
  const codeRevision = git(['rev-parse', 'HEAD']);
  const migrations = await loadPricingCutoverMigrations(process.cwd());
  // This subprocess never inherits PostgreSQL target/auth/startup overrides.
  for (const key of Object.keys(process.env)) if (key.startsWith('PG')) delete process.env[key];
  const schema = await withPricingCutoverReadOnlyClient(config, connection =>
    collectPricingCutoverSchema({ async query<T>(sql: string, params?: ReadonlyArray<unknown>) {
      return (await connection.query<T>(sql, params)).rows;
    } }));
  if (git(['status', '--porcelain']) || git(['rev-parse', 'HEAD']) !== codeRevision
    || await readFile(resolve(input), 'utf8') !== source) throw new Error('Source changed during inventory.');
  await writeFile(resolve(output), `${JSON.stringify({ ...schema, codeRevision, databaseIdentity, migrations }, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ at: schema.at, codeRevision, readOnly: true, schemaHash: schema.schemaHash,
    missingPrerequisites: schema.missingPrerequisites, missingTrialFunctions: schema.missingTrialFunctions,
    trialRasterPredicate: schema.trialRasterPredicate,
    missingCutoverTables: schema.missingCutoverTables, schemaReviewRequired: true, activationReady: false }));
}
void main().catch(() => {
  console.error('Pricing schema inventory failed; no schema or tariff was changed. Driver details and credentials are omitted.');
  process.exitCode = 1;
});
