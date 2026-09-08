import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { createPaidGenerationTestSchema, missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';
import { prepareAudioRun, assertExpectedAudioQuote } from '../frontend/src/server/audio/prepare-audio';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const userId = '00000000-0000-4000-8000-000000000062';

test('web Audio still reserves once then executes the same runtime, preserving original output and exact failure refund', { timeout: 60_000 }, async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const database = await startDisposablePostgres('audio-web-seam');
  const folder = mkdtempSync(join(tmpdir(), 'audio-web-seam-'));
  const previousUrl = process.env.DATABASE_URL;
  const prepared = await prepareAudioRun({ pack: 'song', prompt: 'Warm acoustic folk', lyrics: '[Verse]\nKeep these words' }, userId, {
    env: { FAL_KEY: 'fixture' }, pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }) },
  });
  const fixture = { prepared, assertExpectedAudioQuote, submitted: 0, persistCalls: 0, failed: false };
  const globals = globalThis as typeof globalThis & { __audioWebFixture?: typeof fixture };
  globals.__audioWebFixture = fixture;
  let end: (() => Promise<void>) | undefined;
  t.after(async () => { await end?.(); if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    delete globals.__audioWebFixture; rmSync(folder, { recursive: true, force: true }); await database.cleanup(); });
  await createPaidGenerationTestSchema(database.pool);
  await database.pool.query('ALTER TABLE app_jobs ALTER COLUMN duration_sec SET NOT NULL');
  await database.pool.query('CREATE TABLE profiles(id uuid PRIMARY KEY,preferred_currency text)');
  await database.pool.query("INSERT INTO profiles VALUES ($1,'usd')", [userId]);
  await database.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ($1,'topup',1000,'USD')", [userId]);
  const output = join(folder, 'audio.cjs');
  const mocks: Record<string, string> = {
    './prepare-audio': `export const assertExpectedAudioQuote=globalThis.__audioWebFixture.assertExpectedAudioQuote; export async function prepareAudioRun(){ return globalThis.__audioWebFixture.prepared; }`,
    '@/lib/schema': `export async function ensureBillingSchema(){}`,
    './providers/standalone': `export async function generateSongTrack(input){ const f=globalThis.__audioWebFixture; f.submitted++; if(f.failed) throw new Error('Fixture provider failure'); if(input.lyrics!==f.prepared.normalized.lyrics) throw new Error('Lyrics changed'); return {url:'https://fixture.example/original.mp3',model:'fixture-song',providerKey:'fixture',providerLabel:'Fixture'}; } export const generateAmbienceTrack=()=>{throw new Error('Wrong provider')}; export const generateMinimaxVoiceTrack=generateAmbienceTrack;`,
    '@/server/audio/media': `export async function persistOriginalAudio(input){const f=globalThis.__audioWebFixture;f.persistCalls++;if(input.url!=='https://fixture.example/original.mp3')throw new Error('Original changed');return {audioUrl:'https://fixture.example/stored-original.mp3',durationSec:123.4};} export const mixAudioTracks=()=>{throw new Error('Unexpected transcode')}; export const mixAudioIntoVideo=mixAudioTracks; export const uploadAudioRenderAudio=mixAudioTracks; export const uploadAudioRenderVideo=mixAudioTracks;`,
    '@/server/audio/providers': `export const generateClonedVoiceTrack=()=>{throw new Error('Wrong provider')};export const generateMusicTrack=generateClonedVoiceTrack;export const generateSoundDesignTrack=generateClonedVoiceTrack;export const generateStandardVoiceTrack=generateClonedVoiceTrack;`,
    '@/server/media/detect-has-audio': `export const detectMediaBufferDuration=()=>{throw new Error('Unexpected transcode probe')};`,
    '@/server/media-library': `export async function upsertLegacyJobOutputs(){}`,
  };
  await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `export {generateAudioRun} from './frontend/src/server/audio/generate-audio'; export {getDb} from '@/lib/db';` },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'audio-seam-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : /^(pg|stripe|next\/server)$/.test(args.path) ? { path: requireFrontend.resolve(args.path), external: true } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'ts', resolveDir: process.cwd() }));
    } }],
  });
  process.env.DATABASE_URL = database.databaseUrl;
  const runtime = requireFrontend(output) as { generateAudioRun: typeof import('../frontend/src/server/audio/generate-audio').generateAudioRun; getDb(): { end(): Promise<void> } };
  end = () => runtime.getDb().end();
  const response = await runtime.generateAudioRun({ userId, body: { expectedQuote: { inputKey: prepared.inputKey, totalCents: 45, currency: 'USD', expiresAt: Date.now() + 60_000 } } });
  assert.equal(response.status, 'completed'); assert.equal(response.durationSec, 123.4); assert.equal(response.audioUrl, 'https://fixture.example/stored-original.mp3');
  assert.equal(fixture.submitted, 1); assert.equal(fixture.persistCalls, 1);
  assert.deepEqual((await database.pool.query("SELECT type,amount_cents FROM app_receipts WHERE job_id=$1", [response.jobId])).rows, [{ type: 'charge', amount_cents: 45 }]);
  const job = (await database.pool.query('SELECT duration_sec,settings_snapshot,status FROM app_jobs WHERE job_id=$1', [response.jobId])).rows[0];
  assert.equal(Number(job.duration_sec), 124); assert.equal(job.settings_snapshot.measuredDurationSec, 123.4); assert.deepEqual(job.settings_snapshot.mediaFacts, { source: 'probe', durationSec: 123.4 }); assert.equal(job.settings_snapshot.lyrics, prepared.normalized.lyrics); assert.equal(job.status, 'completed');
  await assert.rejects(runtime.generateAudioRun({ userId, body: { expectedQuote: { inputKey: prepared.inputKey, totalCents: 44, currency: 'USD', expiresAt: Date.now() + 60_000 } } }), /quote changed/);
  assert.equal(fixture.submitted, 1);
  fixture.failed = true;
  await assert.rejects(runtime.generateAudioRun({ userId, body: {} }), /Fixture provider failure/);
  assert.equal(fixture.submitted, 2); assert.equal(fixture.persistCalls, 1);
  assert.deepEqual((await database.pool.query("SELECT type,amount_cents FROM app_receipts WHERE job_id <> $1 AND type IN ('charge','refund') ORDER BY id", [response.jobId])).rows,
    [{ type: 'charge', amount_cents: 45 }, { type: 'refund', amount_cents: 45 }]);
});
