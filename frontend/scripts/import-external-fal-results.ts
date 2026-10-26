import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { externalFalImportInventory } from '../server/external-fal-import/inventory';
import { externalFalImportPlan, parseExternalFalImport } from '../server/external-fal-import/contract';

function flags(args: string[]) {
  const parsed: Record<string, string> = {};
  const allowed = new Set(['--mode','--manifest','--journal','--env-file','--fal-env-file','--native-source-config','--actor-user-id','--approve-plan-sha256','--expect-database-sha256','--out']);
  for (let index = 0; index < args.length; index += 2) {
    const [key, value] = args.slice(index, index + 2);
    if (!allowed.has(key) || !value || value.startsWith('--') || parsed[key]) throw new Error('INVALID_ARGUMENTS');
    parsed[key] = value;
  }
  return parsed;
}
function required(args: Record<string,string>, key: string) {
  if (!args[key]) throw new Error('REQUIRED_' + key.slice(2).replaceAll('-', '_').toUpperCase());
  return args[key];
}
async function main() {
  const args = flags(process.argv.slice(2));
  const mode = args['--mode'] ?? 'plan';
  if (!['plan','inventory','dry-run','apply'].includes(mode)) throw new Error('INVALID_MODE');
  const input = parseExternalFalImport(JSON.parse(await readFile(required(args, '--manifest'), 'utf8')));
  const plan = externalFalImportPlan(input);
  const report = async (value: unknown) => {
    const output = JSON.stringify(value, null, 2) + '\n';
    if (args['--out']) await writeFile(args['--out'], output, { flag: 'wx', mode: 0o600 });
    process.stdout.write(output);
  };
  if (mode === 'inventory') return report(externalFalImportInventory(input));
  if (mode === 'plan') return report({ ...plan, verified: false });
  const envFile = required(args, '--env-file');
  if (!path.isAbsolute(envFile)) throw new Error('ABSOLUTE_ENV_FILE_REQUIRED');
  const env = dotenv.parse(await readFile(envFile));
  // Explicit target only. Never load a nearby .env implicitly or print credentials.
  for (const key of ['DATABASE_URL','S3_BUCKET','S3_REGION','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','S3_PUBLIC_BASE_URL']) {
    if (!env[key]) throw new Error('IMPORT_ENV_MISSING_' + key);
    process.env[key] = env[key];
  }
  const falEnvFile = args['--fal-env-file'];
  if (falEnvFile && !path.isAbsolute(falEnvFile)) throw new Error('ABSOLUTE_FAL_ENV_FILE_REQUIRED');
  const falEnv = falEnvFile ? dotenv.parse(await readFile(falEnvFile)) : env;
  const key = falEnv.FAL_API_KEY || falEnv.FAL_KEY;
  if (!key) throw new Error('FAL_KEY_REQUIRED');
  const dbUrl = new URL(env.DATABASE_URL);
  const databaseSha256 = createHash('sha256').update(dbUrl.hostname + dbUrl.pathname).digest('hex');
  const actorUserId = required(args, '--actor-user-id');
  const nativeProfile = input.engineId === 'kling-v4' && input.evidenceProfile === 'nine01-native-v1';
  const nativeFiles = nativeProfile ? await import('../server/external-fal-import/nine01-evidence') : undefined;
  const journal = nativeProfile
    ? await nativeFiles!.readPrivateNativeFile(required(args, '--journal'), 1024 * 1024)
    : await readFile(required(args, '--journal'));
  const nativeSource = nativeProfile ? (await import('../server/external-fal-import/private-staging-source')).createNine01PrivateSourcePorts(
    nativeFiles!.parsePrivateNativeJson(await nativeFiles!.readPrivateNativeFile(required(args, '--native-source-config'), 64 * 1024)),
  ) : undefined;
  const [{ createFalClient }, db, owner, evidence] = await Promise.all([
    import('@fal-ai/client'), import('../src/lib/db'), import('../server/external-fal-import'), import('../server/external-fal-import/evidence'),
  ]);
  const recoveryResponses: import('../server/external-fal-import/evidence').ExternalFalRecoveryResponse[] = [];
  let providerEvidence: import('../server/external-fal-import/evidence').ExternalFalProviderEvidence | undefined;
  const provider = createFalClient({ credentials: key,
    fetch: evidence.createExternalFalRecoveryFetch(input, fetch, response => recoveryResponses.push(response)) });
  try {
    const client = await db.getDb().connect();
    let verified;
    try {
      await client.query('BEGIN READ ONLY');
      verified = await owner.verifyExternalFalImport(input, { actorUserId, executor: db.createQueryExecutor(client),
        verifyEvidence: (manifest, assets) => evidence.verifyExternalFalEvidence(manifest, assets, { journal, nativeSource,
          onProviderEvidence: value => { providerEvidence = value; },
          provider: { status: (endpoint, requestId) => provider.queue.status(endpoint, { requestId, logs: false }),
            result: (endpoint, requestId) => provider.queue.result(endpoint, { requestId }) } }) });
      await client.query('ROLLBACK');
    } finally { await client.query('ROLLBACK').catch(() => undefined); client.release(); }
    const providerRecovery = { ...providerEvidence, responses: recoveryResponses };
    if (mode === 'dry-run') return report({ ...plan, verified: true, planSha256: verified.planSha256, databaseSha256, providerRecovery,
      migrationReady: verified.migrationReady, applyBlockers: verified.migrationReady ? [] : ['IMPORT_MIGRATION_76_REQUIRED'],
      durableMedia: { videoUrl: verified.assets[0].url, posterUrl: verified.assets[0].thumb_url,
        ...(input.engineId === 'kling-v4' ? { previewUrl: input.media.preview.url, display: verified.evidence.display } : {}),
        references: input.references.map(ref => ({ assetId: ref.assetId, providerSha256: ref.sha256,
          durableSha256: ref.storedRepresentation?.sha256 ?? ref.sha256,
          proof: verified.evidence.referenceProofs?.find(proof => proof.assetId === ref.assetId),
          url: verified.assets.find(asset => asset.public_id === ref.assetId)!.url })) },
      ...(verified.evidence.nativeSourceEvidence ? { nativeSourceEvidence: verified.evidence.nativeSourceEvidence } : {}),
      measured: verified.evidence.video, resolvedSeed: verified.evidence.resolvedSeed ?? null });
    if (required(args, '--expect-database-sha256') !== databaseSha256) throw new Error('IMPORT_DATABASE_APPROVAL_MISMATCH');
    const result = await db.withDbTransaction(executor => owner.applyExternalFalImport(verified, {
      executor, actorUserId, approvedPlanSha256: required(args, '--approve-plan-sha256'),
    }));
    await report({ ...plan, ...result, verified: true, planSha256: verified.planSha256, databaseSha256, providerRecovery });
  } finally { nativeSource?.close?.(); await db.getDb().end(); }
}
main().catch(error => { process.stderr.write((error instanceof Error ? error.message : 'IMPORT_FAILED') + '\n'); process.exitCode = 1; });
