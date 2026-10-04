import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS, localTariffFactualEnvironment,
  localTariffReleaseConnection } from './_lib/local-tariff-release-input';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
async function main() {
  const directory = process.env.PRICING_RELEASE_OUTPUT?.trim();
  const fingerprint = process.env.PRICING_RELEASE_CONFIRM?.trim();
  if (!directory || !fingerprint) throw new Error('A prepared local release and its reviewed fingerprint are required.');
  const source = await readFile(resolve('frontend/.env.local'), 'utf8');
  const env = parse(source);
  const databaseUrl = localTariffReleaseConnection(env);
  if (env.LOCAL_ADMIN_BYPASS !== '1' || !env.LOCAL_ADMIN_BYPASS_USER_ID) throw new Error('A configured local admin actor is required.');
  const git = (args: string[]) => {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    if (result.status !== 0) throw new Error('Git evidence unavailable.');
    return result.stdout.trim();
  };
  if (git(['status', '--porcelain'])) throw new Error('Commit reviewed code before local activation.');
  const codeRevision = git(['rev-parse', 'HEAD']);
  const registrySource = await readFile(resolve('frontend/config/model-registry.json'), 'utf8');
  const release = { seed: JSON.parse(await readFile(resolve(directory, 'customer-tariffs.json'), 'utf8')),
    report: JSON.parse(await readFile(resolve(directory, 'report.json'), 'utf8')) };
  const address = new URL(databaseUrl);
  const currentBindings = { ...release.report.bindings, codeRevision, registryHash: hash(registrySource),
    databaseIdentity: hash(`${address.hostname}|${address.pathname}|${address.username}`),
    factualEnvironmentHash: hash(JSON.stringify(Object.entries(localTariffFactualEnvironment(env)).sort())) };
  Object.assign(process.env, { DATABASE_URL: databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  for (const key of LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS) {
    if (env[key]?.trim()) process.env[key] = env[key]; else delete process.env[key];
  }
  const { getDb, withDbTransaction } = await import('@/lib/db');
  const { activateLocalCustomerTariffs } = await import('@/server/pricing/activate-local-customer-tariffs');
  try {
    const result = await withDbTransaction(async executor => {
      const committed = await activateLocalCustomerTariffs(executor, { release, fingerprint, currentBindings, actorId: env.LOCAL_ADMIN_BYPASS_USER_ID });
      if (git(['status', '--porcelain']) || git(['rev-parse','HEAD']) !== codeRevision
        || await readFile(resolve('frontend/.env.local'), 'utf8') !== source
        || await readFile(resolve('frontend/config/model-registry.json'), 'utf8') !== registrySource) throw new Error('Local code or environment changed during activation.');
      return committed;
    });
    // The immutable transaction event is the authoritative receipt even if this
    // optional local file cannot be written after a successful database commit.
    await writeFile(resolve(directory, 'activation-receipt.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o600 }).catch(() => undefined);
    console.log(JSON.stringify({ ...result, environment: 'isolated_local_sandbox', productionActivated: false }));
  } finally { await getDb().end(); }
}
void main().catch(() => { console.error('Local tariff activation failed. Inspect the local activation event before retrying; production was not targeted.'); process.exitCode = 1; });
