import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import reviewEnvironment from '../config/openai-review-environment.json';
import { byteDigest, bytePlusMarketingVideoId, parseBytePlusMarketingImport } from '../server/marketing-media/byteplus/contract';

async function main() {
  const args: Record<string, string> = {};
  const allowed = new Set(['--mode','--manifest','--env-file','--provider-env-file','--actor-user-id',
    '--approve-plan-sha256','--expect-database-sha256','--permission-confirmed','--out']);
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index], value = process.argv[index + 1];
    if (!allowed.has(key) || !value || value.startsWith('--') || args[key]) throw new Error('INVALID_ARGUMENTS');
    args[key] = value;
  }
  const required = (key: string) => {
    if (!args[key]) throw new Error('REQUIRED_' + key.slice(2).replaceAll('-', '_').toUpperCase());
    return args[key];
  };
  const read = async (file: string, maximum = 2 * 1024 ** 2) => {
    if (!path.isAbsolute(file)) throw new Error('ABSOLUTE_FILE_REQUIRED');
    if ((await stat(file)).size > maximum) throw new Error('INPUT_FILE_TOO_LARGE');
    return readFile(file, 'utf8');
  };
  const mode = args['--mode'] ?? 'plan';
  if (!['plan','dry-run','apply'].includes(mode)) throw new Error('INVALID_MODE');
  if (mode === 'apply' && args['--permission-confirmed'] !== 'true') throw new Error('BYTEPLUS_IMPORT_PERMISSION_REQUIRED');
  const parsed = parseBytePlusMarketingImport(JSON.parse(await read(required('--manifest'))));
  const summary = { provider: 'byteplus_modelark', engineId: parsed.input.engineId, mode: parsed.input.mode,
    videoId: bytePlusMarketingVideoId(parsed.input.providerTaskId), publication: 'private', indexable: false,
    referenceCount: parsed.input.references.length, manifestSha256: byteDigest(JSON.stringify(parsed.input)) };
  const report = async (value: unknown) => {
    const output = JSON.stringify(value, null, 2) + '\n';
    if (args['--out']) {
      if (!path.isAbsolute(args['--out'])) throw new Error('ABSOLUTE_FILE_REQUIRED');
      await writeFile(args['--out'], output, { flag: 'wx', mode: 0o600 });
    }
    process.stdout.write(output);
  };
  if (mode === 'plan') return report({ ...summary, verified: false });
  const env = dotenv.parse(await read(required('--env-file'), 128 * 1024));
  for (const key of ['DATABASE_URL','S3_BUCKET','S3_REGION','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','S3_PUBLIC_BASE_URL']) {
    if (!env[key]?.trim()) throw new Error('IMPORT_ENV_MISSING_' + key);
    process.env[key] = env[key];
  }
  const database = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || database.hash
    || [...database.searchParams.keys()].some(key => !['sslmode','channel_binding','application_name','connect_timeout'].includes(key)
      || database.searchParams.getAll(key).length !== 1)) throw new Error('BYTEPLUS_IMPORT_DATABASE_TARGET_INVALID');
  if (reviewEnvironment.databaseHosts.includes(database.hostname) || env.S3_BUCKET.trim() === reviewEnvironment.storageBucket)
    throw new Error('BYTEPLUS_IMPORT_OPENAI_REVIEW_TARGET_FORBIDDEN');
  const databaseSha256 = byteDigest(database.hostname + database.pathname);
  if (mode === 'apply') {
    if (required('--expect-database-sha256') !== databaseSha256) throw new Error('BYTEPLUS_IMPORT_DATABASE_APPROVAL_MISMATCH');
    required('--approve-plan-sha256');
  }
  const providerEnv = args['--provider-env-file'] ? dotenv.parse(await read(args['--provider-env-file'], 128 * 1024)) : env;
  if (!providerEnv.BYTEPLUS_ARK_API_KEY?.trim()) throw new Error('BYTEPLUS_IMPORT_API_KEY_REQUIRED');
  const actorId = required('--actor-user-id');
  if (!/^[a-f0-9-]{36}$/i.test(actorId)) throw new Error('BYTEPLUS_IMPORT_ACTOR_REQUIRED');
  // These modules capture storage configuration; load only after the explicit target file.
  const [db, importer, evidence] = await Promise.all([
    import('../src/lib/db'), import('../server/marketing-media/byteplus/import'), import('../server/marketing-media/byteplus/evidence'),
  ]);
  try {
    const client = await db.getDb().connect();
    let verified;
    try {
      await client.query('BEGIN READ ONLY');
      verified = await importer.verifyBytePlusMarketingImport(parsed.input, {
        db: db.createQueryExecutor(client), actorId,
        verifyMedia: (input, assets) => evidence.verifyBytePlusMarketingMedia(input, assets, { apiKey: providerEnv.BYTEPLUS_ARK_API_KEY }),
      });
    } finally { await client.query('ROLLBACK').catch(() => undefined); client.release(); }
    const baseReport = { ...summary, verified: true, planSha256: verified.fingerprint, databaseSha256,
      fileCount: verified.files.length, width: verified.plan.publication.marketing_output_width,
      height: verified.plan.publication.marketing_output_height, durationSec: verified.plan.publication.duration_sec };
    if (mode === 'dry-run') return report(baseReport);
    const result = await importer.importBytePlusMarketingVideo(verified, {
      actorId, approvedPlanSha256: args['--approve-plan-sha256'], permissionConfirmed: true,
    });
    await report({ ...baseReport, state: result.state });
  } finally { await db.getDb().end(); }
}
main().catch(error => {
  const message = error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)
    ? error.message : 'BYTEPLUS_MARKETING_IMPORT_FAILED';
  process.stderr.write(message + '\n'); process.exitCode = 1;
});
