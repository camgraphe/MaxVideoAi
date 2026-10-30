import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

test('curated feeds retain workflow identity and guest detail reads only the selected public recipe', async () => {
  const recipe = { schemaVersion: 1, surface: 'video', engineId: 'kling-o3-pro', inputMode: 'v2v',
    operation: 'kling-edit', prompt: 'Change the setting', core: { resolution: '1080p', durationSec: 5 },
    refs: { videoUrls: ['https://media.example/marketing-media/source.mp4'] } };
  const video = { id: 'starter-edit', userId: null, engineId: 'kling-o3-pro', engineLabel: 'Kling',
    generationMode: 'v2v', operation: 'kling-edit', durationSec: 5, prompt: recipe.prompt,
    videoUrl: 'https://media.example/marketing-media/output.mp4', createdAt: '2026-10-22T00:00:00Z',
    visibility: 'public', indexable: true, hasAudio: true, canUpscale: false,
    settingsSnapshot: { privateProviderState: 'never-public' } };
  const fixture = { userId: null as string | null, detailReads: [] as string[], video,
    detail: { ...video, recreationSnapshot: recipe } as Record<string, unknown> };
  const globals = globalThis as typeof globalThis & { __curatedRecall?: typeof fixture };
  globals.__curatedRecall = fixture;
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const noWork = '()=>{throw new Error("Unexpected provider, database or mutation work")}';
  const mocks: Record<string, string> = {
    '@/lib/db': `export const isDatabaseConfigured=()=>true;export const query=${noWork};`,
    '@/lib/schema': `export const ensureBillingSchema=${noWork};`,
    '@/lib/supabase-ssr': 'export const getRouteAuthContext=async()=>({userId:globalThis.__curatedRecall.userId});',
    '@/lib/visitor-access': 'export const VISITOR_WORKSPACE_ENABLED=true;',
    '@/server/videos': `export const listStarterPlaylistVideos=async()=>[globalThis.__curatedRecall.video];
      export const getVideoById=async id=>{globalThis.__curatedRecall.detailReads.push(id);return globalThis.__curatedRecall.detail;};`,
    '@/server/membership/user-membership-status': `export const resolveAuthoritativeMembershipTier=${noWork};`,
    '@/server/media-library': `export const applyOutputsToJobPayload=${noWork};export const listJobOutputsByJobIds=${noWork};export const upsertLegacyJobOutputs=${noWork};`,
    '@/server/generations/recent-generations': `export const readRecentGenerationRecordsForWeb=async()=>[];
      export const mapRecentGenerationRecordToWeb=${noWork};export const readOwnedGenerationRecordsByIds=${noWork};export const formatRecentGenerationCursor=${noWork};`,
    './_lib/jobs-stale-audio': `export const expireStaleAudioJob=${noWork};export const isStaleAudioJob=()=>false;`,
    './_lib/jobs-fal-refresh': 'export const refreshStaleFalJobs=async ({rows})=>rows;',
    '@/server/generations/generation-status': `export const readOwnedGenerationRecord=async()=>null;export const mapGenerationStatusRecordToWeb=${noWork};`,
    '@/server/fal-job-queue': `export const resolveFalJobQueue=${noWork};`,
    '@/server/generation-poll-state': `export const claimGenerationPoll=${noWork};`,
    '@/server/refresh-direct-generation': `export const refreshDirectGeneration=${noWork};`,
    '@/server/seedance-workflow-terminal-recovery': `export const recoverTerminalSeedanceWorkflow=${noWork};`,
    '@/lib/fal-client': `export const getFalClient=${noWork};`,
    '@/server/thumbnails': `export const ensureJobThumbnail=${noWork};export const isPlaceholderThumbnail=${noWork};`,
    '@/server/video-faststart': `export const ensureFastStartVideo=${noWork};`,
    '@/server/fal-webhook-handler': `export const updateJobFromFalWebhook=${noWork};`,
  };
  try {
    const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      export { GET as list } from './frontend/app/api/jobs/route';
      export { GET as detail } from './frontend/app/api/jobs/[jobId]/route';
      export { getVisitorStarterJob } from './frontend/server/visitor-workspace';` },
      bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, tsconfig: 'frontend/tsconfig.json',
      plugins: [{ name: 'curated-boundaries', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'ts' }));
      } }],
    });
    const module = { exports: {} as any };
    new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(requireFrontend, module, module.exports);
    const routes = module.exports;
    for (const userId of [null, 'signed-in-account']) {
      fixture.userId = userId;
      const response = await routes.list(new Request('https://maxvideoai.com/api/jobs?type=video'));
      assert.equal(response.status, 200);
      const job = (await response.json()).jobs[0];
      assert.equal(job.generationMode, 'v2v');
      assert.equal(job.operation, 'kling-edit');
      assert.equal(job.settingsSnapshot, undefined, 'feed must not hydrate full recipes');
      assert.doesNotMatch(JSON.stringify(job), /never-public|privateProviderState|source\.mp4/);
    }
    assert.deepEqual(fixture.detailReads, []);
    fixture.userId = null;
    const response = await routes.detail(new Request('https://maxvideoai.com/api/jobs/starter-edit'),
      { params: Promise.resolve({ jobId: 'starter-edit' }) });
    assert.equal(response.status, 200);
    const detail = await response.json();
    assert.deepEqual(detail.settingsSnapshot, recipe);
    assert.equal(detail.generationMode, 'v2v');
    assert.equal(detail.operation, 'kling-edit');
    assert.doesNotMatch(JSON.stringify(detail), /never-public|privateProviderState/);
    assert.deepEqual(fixture.detailReads, ['starter-edit']);
    assert.equal(await routes.getVisitorStarterJob('not-in-starter'), null);
    assert.deepEqual(fixture.detailReads, ['starter-edit'], 'unlisted IDs never read a public recipe');
    fixture.detail = { ...fixture.detail, visibility: 'private' };
    assert.equal(await routes.getVisitorStarterJob('starter-edit'), null, 'publication access is rechecked after membership');
  } finally { delete globals.__curatedRecall; }
});
