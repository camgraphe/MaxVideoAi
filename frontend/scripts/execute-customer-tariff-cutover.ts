import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'dotenv';
import { pricingCutoverTarget } from '@/server/pricing/cutover-target';
import { LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS } from '@/server/pricing/cutover-factual-environment';

/** Manual maintenance entry point. No deploy/build hook invokes it. The authored
 * inactive flag blocks a production connection before this operation can run. */
async function main() {
  const mode = process.env.PRICING_CUTOVER_MODE;
  const operation = process.env.PRICING_CUTOVER_OPERATION;
  const envFile = process.env.PRICING_CUTOVER_ENV_FILE?.trim();
  const actorId = process.env.PRICING_CUTOVER_ACTOR?.trim();
  const fingerprint = process.env.PRICING_CUTOVER_CONFIRM?.trim();
  if (!['rehearsal','production'].includes(mode ?? '') || !['activate','rollback'].includes(operation ?? '')
    || !envFile || !actorId || !fingerprint) throw new Error('Explicit mode, operation, environment, actor and confirmation are required.');
  const git = (args: string[]) => execFileSync('git',args,{ encoding: 'utf8' }).trim();
  if (git(['status','--porcelain'])) throw new Error('Commit the reviewed operation before execution.');
  const codeRevision = git(['rev-parse','HEAD']);
  const environmentSource = await readFile(resolve(envFile),'utf8');
  const env = parse(environmentSource);
  const target = pricingCutoverTarget(env);
  const releaseFile = operation === 'activate' ? process.env.PRICING_CUTOVER_RELEASE?.trim() : undefined;
  const releaseSource = releaseFile ? await readFile(resolve(releaseFile),'utf8') : undefined;
  if (operation === 'activate' && !releaseSource) throw new Error('A prepared complete release is required.');
  const eventId = process.env.PRICING_CUTOVER_EVENT?.trim();
  if (operation === 'rollback' && !eventId) throw new Error('The immutable activation event is required.');
  for (const name of Object.keys(process.env)) if (name.startsWith('PG')) delete process.env[name];
  for (const name of LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS) {
    if (env[name]?.trim()) process.env[name] = env[name]; else delete process.env[name];
  }
  // Import quote/runtime owners only after installing the selected factual inputs.
  process.env.DATABASE_URL = env.DATABASE_URL_UNPOOLED?.trim() || env.DATABASE_URL;
  Object.assign(process.env,{ NODE_ENV: mode === 'rehearsal' ? 'development' : 'production' });
  if (mode === 'rehearsal' && env.PRICING_SANDBOX !== '1') throw new Error('Explicit sandbox environment required.');
  process.env.PRICING_SANDBOX = mode === 'rehearsal' ? '1' : '0';
  const { withPricingCutoverTransaction,activateInitialCustomerTariffGrid,rollbackInitialCustomerTariffGrid } =
    await import('@/server/pricing/customer-tariff-cutover');
  const result = await withPricingCutoverTransaction(env,mode as 'rehearsal' | 'production',async executor => {
    const input = { target,actorId,fingerprint,mode: mode as 'rehearsal' | 'production' };
    const receipt = operation === 'activate'
      ? await activateInitialCustomerTariffGrid(executor,{ ...input,release: JSON.parse(releaseSource!) })
      : await rollbackInitialCustomerTariffGrid(executor,{ ...input,eventId: eventId! });
    if (git(['status','--porcelain']) || git(['rev-parse','HEAD']) !== codeRevision
      || await readFile(resolve(envFile),'utf8') !== environmentSource
      || (releaseFile && await readFile(resolve(releaseFile),'utf8') !== releaseSource)) throw new Error('Operational source changed before commit.');
    return receipt;
  });
  const output = process.env.PRICING_CUTOVER_RECEIPT?.trim();
  // Database evidence is authoritative even if the optional local receipt fails.
  if (output) await writeFile(resolve(output),`${JSON.stringify(result,null,2)}\n`,{ flag: 'wx',mode: 0o600 }).catch(() => undefined);
  console.log(JSON.stringify({ operation,mode,...result }));
}
void main().catch(() => {
  console.error('Pricing cutover did not report completion. Inspect the immutable target event before retrying; credentials and driver details are omitted.');
  process.exitCode = 1;
});
