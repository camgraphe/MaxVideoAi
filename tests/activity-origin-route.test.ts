import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

test('jobs GET attaches bounded accepted origins and keeps history available when enrichment fails', async t => {
  const row = (jobId: string) => ({
    id: jobId, job_id: jobId, user_id: 'owner', surface: 'video', engine_label: 'Fixture', duration_sec: 5,
    prompt: 'Exact stored prompt', created_at: '2026-11-10T10:00:00.000Z',
    settings_snapshot: { schemaVersion: 1, surface: 'video' }, video_url: `https://media.example/${jobId}.mp4`,
    thumb_url: `https://media.example/${jobId}.webp`, status: 'completed', final_price_cents: 25, currency: 'USD',
  });
  const fixture = {
    userId: 'owner' as string | null,
    rows: [row('mcp-job'), row('studio-job'), row('next-page')],
    queries: [] as Array<{ sql: string; params: unknown[] }>,
    failOrigins: false,
  };
  const globals = globalThis as typeof globalThis & { __activityOrigins?: typeof fixture };
  globals.__activityOrigins = fixture;
  t.after(() => { delete globals.__activityOrigins; });
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const noWork = '()=>{throw new Error("Unexpected provider or mutation work")}';
  const mocks: Record<string, string> = {
    '@/lib/db': `export const isDatabaseConfigured=()=>true;
      export async function query(sql,params){const f=globalThis.__activityOrigins;f.queries.push({sql,params});
        if(f.failOrigins)throw new Error('optional quote table unavailable');
        return [{job_id:'mcp-job',auth_origin:'oauth',studio_project_id:null},
          {job_id:'studio-job',auth_origin:'studio-session',studio_project_id:'project-123'}];}`,
    '@/lib/supabase-ssr': 'export const getRouteAuthContext=async()=>({userId:globalThis.__activityOrigins.userId});',
    '@/lib/visitor-access': 'export const VISITOR_WORKSPACE_ENABLED=false;',
    '@/server/videos': 'export const listStarterPlaylistVideos=async()=>[];',
    '@/server/visitor-workspace': `export const listVisitorImageLikeJobs=${noWork};export const listVisitorStarterJobs=${noWork};`,
    '@/server/media-library': `export const listJobOutputsByJobIds=async()=>new Map();
      export const applyOutputsToJobPayload=job=>job;`,
    '@/server/generations/recent-generations': `export {mapRecentGenerationRecordToWeb} from ${JSON.stringify(resolve('frontend/src/server/generations/recent-generation-web-mapper.ts'))};
      export const readRecentGenerationRecordsForWeb=async()=>globalThis.__activityOrigins.rows;
      export const readOwnedGenerationRecordsByIds=${noWork};export const formatRecentGenerationCursor=row=>row.job_id;`,
    './_lib/jobs-stale-audio': `export const expireStaleAudioJob=${noWork};export const isStaleAudioJob=()=>false;`,
    './_lib/jobs-fal-refresh': 'export const refreshStaleFalJobs=async ({rows})=>rows;',
  };
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: 'ts', contents: "export { GET } from './frontend/app/api/jobs/route';" },
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'activity-origin-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'ts', resolveDir: process.cwd() }));
    } }],
  });
  const module = { exports: {} as { GET: (request: Request) => Promise<Response> } };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(requireFrontend, module, module.exports);
  const request = (flag = '1') => new Request(`https://maxvideoai.com/api/jobs?limit=2${flag ? `&includeActivityOrigin=${flag}` : ''}`);
  const response = await module.exports.GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const payload = await response.json();
  assert.deepEqual(payload.jobs.map((value: { activityOrigin: unknown }) => value.activityOrigin), [
    { kind: 'mcp' }, { kind: 'studio', projectId: 'project-123' },
  ]);
  assert.equal(payload.nextCursor, 'studio-job');
  assert.equal(fixture.queries.length, 1);
  assert.deepEqual(fixture.queries[0].params, ['owner', ['mcp-job', 'studio-job']]);
  assert.equal(payload.jobs[0].videoUrl, 'https://media.example/mcp-job.mp4');
  assert.equal(payload.jobs[0].finalPriceCents, 25);

  fixture.queries.length = 0;
  for (const flag of ['', '0', 'true']) {
    const ordinary = await module.exports.GET(request(flag));
    assert.equal(ordinary.status, 200);
    assert.deepEqual((await ordinary.json()).jobs, payload.jobs.map(({ activityOrigin: _origin, ...value }: Record<string, unknown>) => value));
    assert.equal(fixture.queries.length, 0, 'ordinary workspace feeds never query Activity provenance');
  }

  fixture.failOrigins = true;
  const warnings: unknown[][] = [];
  const warn = console.warn;
  console.warn = (...values) => { warnings.push(values); };
  try {
    const fallback = await module.exports.GET(request());
    assert.equal(fallback.status, 200);
    const body = await fallback.json();
    assert.deepEqual(body.jobs, payload.jobs.map((value: Record<string, unknown>) => ({ ...value, activityOrigin: null })));
    assert.equal(warnings.length, 1, 'optional origin failures remain observable');
  } finally { console.warn = warn; }

  fixture.userId = null;
  fixture.queries.length = 0;
  assert.equal((await module.exports.GET(request())).status, 401);
  assert.equal(fixture.queries.length, 0, 'unauthenticated reads never query provenance');

  fixture.userId = 'owner';
  fixture.rows = [];
  assert.deepEqual((await (await module.exports.GET(request())).json()).jobs, []);
  assert.equal(fixture.queries.length, 0, 'empty pages never query provenance');
});
