import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

// Real presigning, with fixture credentials only; no provider, database or S3 calls.
process.env.S3_BUCKET = 'audio-private-input-fixture';
process.env.S3_REGION = 'eu-central-1';
process.env.S3_ACCESS_KEY_ID = 'fixture-access';
process.env.S3_SECRET_ACCESS_KEY = 'fixture-secret';
process.env.S3_PUBLIC_BASE_URL = 'https://audio-private-input-fixture.s3.eu-central-1.amazonaws.com';
const base = process.env.S3_PUBLIC_BASE_URL;
const owner = 'audio-owner';
const video = `${base}/media-assets/${owner}/source.mp4`;
const voice = `${base}/media-assets/${owner}/voice.mp3`;
const facts = { durationSec: 5, width: 1920, height: 1080, hasAudio: true };
const pricingPolicy = { loadOverrides: async () => ({ status: 'loaded' as const, rules: [], routingRules: [] }) };
const preparedModule = import('../frontend/src/server/audio/prepare-audio');

function assertReadable(url: string, original: string) {
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, original);
  assert.ok(parsed.searchParams.get('X-Amz-Signature'), 'private original needs a transient signed read');
  assert.ok(Number(parsed.searchParams.get('X-Amz-Expires')) <= 3600);
}

test('Audio quotation probes an owned private video without persisting its temporary read grant', async () => {
  const { prepareAudioRun } = await preparedModule;
  const prepared = await prepareAudioRun({ pack: 'cinematic', prompt: 'Soft keyboard typing', mood: 'documentary', sourceVideoUrl: video, musicEnabled: false }, owner, {
    pricingPolicy,
    inspectSourceVideo: async url => { assertReadable(url, video); return facts; },
  });
  assert.equal(prepared.sourceVideoUrl, video);
  assert.equal(prepared.normalized.sourceVideoUrl, video);
  assert.equal(prepared.durationSec, 5);
  assert.ok(!JSON.stringify(prepared).includes('X-Amz-'));
});

test('Audio quotation refuses another account storage before attempting a source download', async () => {
  const { prepareAudioRun } = await preparedModule;
  let downloads = 0;
  await assert.rejects(prepareAudioRun({ pack: 'cinematic', prompt: 'Soft keyboard typing', mood: 'documentary', sourceVideoUrl: video, musicEnabled: false }, 'other-owner', {
    pricingPolicy,
    inspectSourceVideo: async () => { downloads++; return facts; },
  }), /MEDIA_NOT_AVAILABLE/);
  assert.equal(downloads, 0);
});

test('Audio quotation preserves an external provider URL and its existing signature', async () => {
  const { prepareAudioRun } = await preparedModule;
  const url = 'https://provider.example/source.mp4?signature=existing%2Fgrant';
  const prepared = await prepareAudioRun({ pack: 'cinematic', prompt: 'Soft keyboard typing', mood: 'documentary', sourceVideoUrl: url, musicEnabled: false }, owner, {
    pricingPolicy, inspectSourceVideo: async input => { assert.equal(input, url); return facts; },
  });
  assert.equal(prepared.sourceVideoUrl, url);
});

test('reserved Audio signs private video and voice inputs at execution without changing canonical snapshots', async t => {
  const { prepareAudioRun } = await preparedModule;
  const prepared = await prepareAudioRun({
    pack: 'cinematic_voice', prompt: 'Soft keyboard typing', mood: 'documentary', sourceVideoUrl: video, voiceSampleUrl: voice,
    voiceModel: 'seed', script: 'A quiet creative moment at the desk.', musicEnabled: false,
  }, owner, { pricingPolicy, inspectSourceVideo: async () => facts });
  const { buildAudioRunReservation } = await import('../frontend/src/server/audio/audio-run-reservation');
  const reservation = buildAudioRunReservation(prepared, owner);
  const originalReservation = JSON.stringify(reservation);
  const observed = { video: [] as string[], voice: [] as string[], snapshots: [] as string[] };
  const globals = globalThis as typeof globalThis & { __audioPrivateInputs?: typeof observed };
  globals.__audioPrivateInputs = observed;
  const folder = mkdtempSync(join(tmpdir(), 'audio-private-inputs-'));
  t.after(() => { delete globals.__audioPrivateInputs; rmSync(folder, { recursive: true, force: true }); });
  const mocks: Record<string, string> = {
    './prepare-audio': `export async function prepareAudioRun(){throw Error('Unexpected preparation');};export function assertExpectedAudioQuote(){};export function assertAudioProviderConfigured(){};`,
    '@/server/audio/audio-generate-jobs': `export async function updateAudioJob(){};export async function createInitialAudioJob(){throw Error('Unexpected reservation');};export async function completeAudioJob(id,input){globalThis.__audioPrivateInputs.snapshots.push(input.settingsSnapshotJson);return true;};export async function failAudioJob(){return true;};`,
    '@/server/audio/audio-generate-receipts': `export async function refundAudioCharge(){throw Error('Unexpected refund');}`,
    '@/server/audio/providers': `const track={url:'https://provider.example/track.mp3',model:'fixture',providerKey:'fixture',providerLabel:'Fixture'};export async function generateSoundDesignTrack(input){globalThis.__audioPrivateInputs.video.push(input.sourceVideoUrl);return track;};export async function generateClonedVoiceTrack(input){globalThis.__audioPrivateInputs.voice.push(input.voiceSampleUrl);return track;};export async function generateMusicTrack(){throw Error('Unexpected music');};export async function generateStandardVoiceTrack(){throw Error('Unexpected standard voice');}`,
    '@/server/audio/media': `export async function mixAudioIntoVideo(input){globalThis.__audioPrivateInputs.video.push(input.sourceVideoUrl);return {videoBuffer:Buffer.from('video'),audioBuffer:Buffer.from('audio')};};export async function uploadAudioRenderVideo(){return {videoUrl:'https://output.example/video.mp4',thumbUrl:null};};export async function uploadAudioRenderAudio(){return {audioUrl:'https://output.example/audio.m4a'};};export async function mixAudioTracks(){throw Error('Unexpected standalone mix');};export async function persistOriginalAudio(){throw Error('Unexpected original');};`,
    '@/server/media/detect-has-audio': `export async function detectMediaBufferDuration(){return 5;}`,
    '@/server/media-library': `export async function upsertLegacyJobOutputs(){}`,
  };
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const output = join(folder, 'runtime.cjs');
  await build({
    stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `export {executeReservedAudioRun} from './frontend/src/server/audio/generate-audio';` },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'external-audio-effects', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : /^(?![./]|@\/)/.test(args.path) ? { path: requireFrontend.resolve(args.path), external: true } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'ts', resolveDir: process.cwd() }));
    } }],
  });
  const runtime = requireFrontend(output) as typeof import('../frontend/src/server/audio/generate-audio');
  const result = await runtime.executeReservedAudioRun(reservation.execution);
  assert.equal(result.status, 'completed');
  assert.equal(observed.video.length, 2, 'provider and final mix both need readable video');
  for (const url of observed.video) assertReadable(url, video);
  assert.equal(observed.voice.length, 1);
  assertReadable(observed.voice[0]!, voice);
  assert.equal(JSON.stringify(reservation), originalReservation);
  assert.equal(observed.snapshots.length, 1);
  assert.ok(!observed.snapshots[0]!.includes('X-Amz-'));
  assert.deepEqual(JSON.parse(observed.snapshots[0]!).refs, { sourceVideoUrl: video, voiceSampleUrl: voice });
});
