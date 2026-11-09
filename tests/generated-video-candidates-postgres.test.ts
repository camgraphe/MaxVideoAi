import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { exerciseGeneratedVideoPickers } from './helpers/generated-video-picker-flow';
import { startDisposablePostgres } from './helpers/disposable-postgres';
test('generated-video candidates apply exact current organization and availability before pagination, keeping Activity', { timeout: 120000 }, async (t) => {
    const pg = await startDisposablePostgres('generated-video-candidates'), previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = pg.databaseUrl;
    const db = await import('../frontend/src/lib/db');
    t.after(async () => { await db.getDb().end(); if (previous === undefined)
        delete process.env.DATABASE_URL;
    else
        process.env.DATABASE_URL = previous; await pg.cleanup(); });
    const schema = await import('../frontend/src/lib/schema');
    await schema.ensureMediaLibrarySchema();
    await schema.ensureAssetSchema();
    await (await import('../frontend/src/lib/schema/media-library-organization-schema')).ensureMediaLibraryOrganizationSchema();
    await pg.pool.query('CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,hidden boolean DEFAULT false)');
    const { RECENT_GENERATIONS_SELECT, readRecentGenerationRecordsForWeb } = await import('../frontend/src/server/generations/recent-generations');
    for (const c of RECENT_GENERATIONS_SELECT.split(', ').filter(c => !['job_id', 'user_id'].includes(c))) {
        const type = ['settings_snapshot', 'pricing_snapshot', 'render_ids'].includes(c) ? 'jsonb' : ['created_at', 'updated_at'].includes(c) ? 'timestamptz' : ['has_audio', 'can_upscale', 'indexable'].includes(c) ? 'boolean' : ['id', 'duration_sec', 'final_price_cents', 'iteration_index', 'iteration_count', 'eta_seconds', 'progress'].includes(c) ? 'integer' : 'text';
        await pg.pool.query(`ALTER TABLE app_jobs ADD COLUMN ${c} ${type}`);
    }
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,id,surface,video_url,status,created_at,updated_at) VALUES
 ('trash','alice',9,'video','https://media.test/trash.mp4','completed',now(),now()),
 ('unsaved','alice',8,'video','https://media.test/unsaved.mp4','completed',now()-interval '1 second',now()),
 ('historical','alice',7,'video','https://media.test/historical.mp4','  SUCCEEDED  ',now()-interval '2 seconds',now()),
 ('foreign','bob',6,'video','https://media.test/foreign.mp4','completed',now(),now()),
 ('sibling','alice',5,'video','https://media.test/shared.mp4','completed',now()-interval '3 seconds',now()),
 ('deleted','alice',4,'video','https://media.test/deleted.mp4','completed',now(),now()),
 ('pending','alice',3,'video','https://media.test/pending.mp4','running',now(),now());
 INSERT INTO job_outputs(id,job_id,user_id,kind,url,status,position) VALUES
 ('trash-out','trash','alice','video','https://media.test/trash.mp4','ready',0),
 ('unsaved-out','unsaved','alice','video','https://media.test/unsaved.mp4','ready',0),
 ('sibling-trash','sibling','alice','video','https://media.test/shared.mp4','ready',0),
 ('sibling-live','sibling','alice','video','https://media.test/shared.mp4','ready',1),
 ('deleted-out','deleted','alice','video','https://media.test/deleted.mp4','deleted',0);`);
    const { mutateLibraryOrganization: mutate } = await import('../frontend/server/media-library/organization');
    const ref = (jobId: string, outputId: string) => ({ type: 'job-output' as const, jobId, outputId, kind: 'video' as const });
    await mutate({ userId: 'alice', operation: 'trash', references: [ref('trash', 'trash-out'), ref('sibling', 'sibling-trash')] });
    for (const name of ['32_mcp_reference_uploads.sql', '34_mcp_reference_upload_media_kind.sql', '35_mcp_reference_upload_hardening.sql', '36_mcp_reference_upload_replay_safety.sql', '37_mcp_reference_upload_recovery_state.sql', '43_mcp_reference_asset_deletion.sql', '44_mcp_reference_staging_storage_namespace.sql'])
        await pg.pool.query(readFileSync('neon/migrations/' + name, 'utf8'));
    const { listGeneratedVideoCandidates: list } = await import('../frontend/server/media-library/generated-video-candidates');
    const read = async (options: any = {}) => { await db.query('SET default_transaction_read_only=on'); try {
        return await list({ userId: 'alice', ...options });
    }
    finally {
        await db.query('SET default_transaction_read_only=off');
    } };
    const first = await read({ limit: 1 });
    assert.deepEqual(first.jobs.map(j => j.jobId), ['unsaved'], 'Trash excluded before limit');
    assert.equal(first.hasMore, true);
    const second = await read({ limit: 1, cursor: first.nextCursor });
    assert.deepEqual(second.jobs.map(j => j.jobId), ['historical']);
    assert.equal(second.jobs[0].sourceOutputId, undefined, 'historical proof invents no output identity');
    const third = await read({ limit: 1, cursor: second.nextCursor });
    assert.deepEqual(third.jobs.map(j => j.sourceOutputId), ['sibling-live'], 'same-URL sibling has independent Trash state');
    assert.equal(third.hasMore, false);
    await pg.pool.query(`UPDATE app_jobs SET duration_sec=6,aspect_ratio='16:9',has_audio=true;
      UPDATE job_outputs SET duration_sec=6,width=1920,height=1080,metadata='{"mediaFacts":{"source":"probe","hasAudio":true}}' WHERE id='unsaved-out';
      INSERT INTO job_outputs(id,job_id,user_id,kind,url,status,position,duration_sec,width,height,metadata) VALUES
        ('unsaved-long','unsaved','alice','video','https://media.test/long.mp4','ready',10,14,1080,1920,'{"mediaFacts":{"source":"probe","hasAudio":false}}'),
        ('unsaved-unknown','unsaved','alice','video','https://media.test/unsaved.mp4','ready',11,NULL,NULL,NULL,'{}');`);
    const factsPage = await read();
    await t.test('output facts never inherit the primary job, including unknown same-URL siblings', () => {
      const facts = (id: string) => {
        const output = factsPage.jobs.find(j => j.sourceOutputId === id)!;
        return ['durationSec', 'aspectRatio', 'hasAudio', 'width', 'height'].map(key => (output as any)[key]);
      };
      assert.deepEqual([facts('unsaved-long'), facts('unsaved-unknown')],
        [[14, '9:16', false, 1080, 1920], [null, null, null, null, null]]);
    });
    const directory = mkdtempSync(join(tmpdir(), 'generated-video-route-')), requester = createRequire(resolve('frontend/package.json'));
    const fixture = { userId: null as string | null };
    (globalThis as any).__generatedRoute = fixture;
    const outfile = join(directory, 'route.cjs');
    await build({ stdin: { loader: 'ts', resolveDir: process.cwd(), contents: "export {GET} from './frontend/app/api/media-library/generated-videos/route';export {POST as validate} from './frontend/app/api/media-library/selection/validate/route';export {POST as historical} from './frontend/app/api/media-library/selection/validate-job-video/route';export {getDb} from '@/lib/db';" }, outfile, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json', plugins: [{ name: 'auth-boundary', setup(b) { b.onResolve({ filter: /^@\/lib\/supabase-ssr$/ }, () => ({ path: 'auth', namespace: 'fixture' })); b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const getRouteAuthContext=async()=>({userId:globalThis.__generatedRoute.userId});', loader: 'ts' })); b.onResolve({ filter: /^(next\/server|pg)$/ }, a => ({ path: requester.resolve(a.path), external: true })); } }] });
    const route = requester(outfile), { NextRequest } = requester('next/server');
    delete process.env.DATABASE_URL;
    assert.equal((await route.GET(new NextRequest('http://localhost/api/media-library/generated-videos'))).status, 401, 'auth precedes SQL');
    const ro = new URL(pg.databaseUrl);
    ro.searchParams.set('options', '-c default_transaction_read_only=on');
    process.env.DATABASE_URL = ro.toString();
    fixture.userId = 'alice';
    try {
        const { listLibraryAssetPage } = await import('../frontend/server/media-library/asset-listing');
        const { listRecentOutputPage } = await import('../frontend/server/media-library/job-outputs');
        const routes: Record<string, (req: unknown) => Promise<Response>> = { '/api/media-library/generated-videos': route.GET, '/api/media-library/assets': async () => { const p = await listLibraryAssetPage({ userId: 'alice', kind: 'video', limit: 30 }, { ensureSchema: false }); return Response.json({ ok: true, assets: p.items, hasMore: p.hasMore, nextCursor: p.nextCursor }); }, '/api/media-library/recent-outputs': async (req: any) => { const p = await listRecentOutputPage({ userId: 'alice', kind: 'video', jobId: req.nextUrl.searchParams.get('jobId'), limit: 100 }, { ensureSchema: false }); return Response.json({ ok: true, outputs: p.items, hasMore: p.hasMore, nextCursor: p.nextCursor }); }, '/api/media-library/selection/validate': route.validate, '/api/media-library/selection/validate-job-video': route.historical };
        const requests: string[] = [];
        const transport: typeof fetch = async (url, init) => { const absolute = new URL(String(url), 'http://localhost'); requests.push(absolute.pathname); assert.ok(routes[absolute.pathname], absolute.pathname); return routes[absolute.pathname](new NextRequest(absolute, init)); };
        const response = await transport('/api/media-library/generated-videos');
        assert.equal(response.status, 200);
        assert.match(response.headers.get('cache-control')!, /private, no-store/);
        await db.query('SET default_transaction_read_only=on');
        try { await exerciseGeneratedVideoPickers(transport); } finally { await db.query('SET default_transaction_read_only=off'); }
        assert.equal(requests.filter(p => p.endsWith('validate-job-video')).length, 2, 'both historical receivers run positive proof');
        assert.equal(requests.filter(p => p.endsWith('/validate')).length, 4, 'both persisted receivers revalidate primary and sibling exact outputs');
        assert.equal((await transport('/api/media-library/generated-videos?surface=audio')).status, 400);
        await pg.pool.query('ALTER TABLE library_organization RENAME TO absent_organization');
        assert.equal((await transport('/api/media-library/generated-videos')).status, 500);
        assert.equal((await pg.pool.query("SELECT to_regclass('public.library_organization') AS n")).rows[0].n, null);
        await pg.pool.query('ALTER TABLE absent_organization RENAME TO library_organization');
    }
    finally {
        await route.getDb().end();
        process.env.DATABASE_URL = pg.databaseUrl;
        delete (globalThis as any).__generatedRoute;
        rmSync(directory, { recursive: true, force: true });
    }
    await t.test('probe facts belong to the exact stored original and outrank legacy duration', async () => {
      const measured = { source: 'probe', durationSec: 8, width: 720, height: 1280, hasAudio: false };
      const update = async (mediaFacts: unknown) => pg.pool.query("UPDATE job_outputs SET duration_sec=99,metadata=$1 WHERE id='unsaved-unknown'", [JSON.stringify({ mediaFacts })]);
      const facts = async () => {
        const output = (await read()).jobs.find(j => j.sourceOutputId === 'unsaved-unknown')!;
        return [output.durationSec, output.aspectRatio, output.hasAudio, output.width, output.height];
      };
      await update(measured);
      assert.deepEqual(await facts(), [8, '9:16', false, 720, 1280]);
      const bound = { ...measured, version: 1, probe: 'ffprobe', original: {url:'https://media.test/different.mp4',sha256:'a'.repeat(64),sizeBytes:100},videoDurationSec:8,audioDurationSec:null,containerDurationSec:8 };
      await update(bound);
      assert.deepEqual(await facts(), [null, null, null, null, null], 'another original cannot contribute probe facts or revive the legacy duration');
      await update({ ...bound, original:{ ...bound.original,url:'https://media.test/unsaved.mp4' } });
      assert.deepEqual(await facts(), [8, '9:16', false, 720, 1280]);
    });
    const history = await readRecentGenerationRecordsForWeb({ userId: 'alice', feedType: 'video', requestedSurface: null, limit: 30 });
    assert.ok(history.some(j => j.job_id === 'trash'), 'Activity preserved');
    await mutate({ userId: 'alice', operation: 'restore', references: [ref('trash', 'trash-out')] });
    assert.equal((await read({ limit: 1 })).jobs[0].jobId, 'trash');
    await mutate({ userId: 'alice', operation: 'trash', references: [ref('trash', 'trash-out')] });
    await pg.pool.query("UPDATE job_outputs SET url='https://media.test/new.mp4' WHERE id='trash-out'; UPDATE app_jobs SET video_url='https://media.test/new.mp4' WHERE job_id='trash'");
    assert.equal((await read({ limit: 1 })).jobs[0].videoUrl, 'https://media.test/new.mp4', 'old version Trash does not hide replacement');
    await pg.pool.query("UPDATE app_jobs SET hidden=true WHERE job_id='trash'; INSERT INTO job_outputs(id,job_id,user_id,kind,url,status) VALUES ('foreign-output','historical','bob','video','https://media.test/historical.mp4','deleted')");
    assert.ok(!(await read()).jobs.some(j => j.jobId === 'historical'), 'any persisted output blocks historical fallback');
    await assert.rejects(read({ userId: 'bob', cursor: first.nextCursor }), /INVALID_CURSOR/);
    assert.equal((await read({ userId: 'bob' })).jobs[0].jobId, 'foreign');
    await assert.rejects(read({ limit: 0 }), /INVALID_LIMIT/);
    await pg.pool.query("DELETE FROM job_outputs WHERE id='foreign-output'");
    const historicalRef = { type: 'asset' as const, assetId: 'ma_' + '8'.repeat(32), kind: 'video' as const };
    await pg.pool.query("INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id) VALUES('historical-saved',$1,'alice','video','https://media.test/historical.mp4','saved_job_output','historical')", [historicalRef.assetId]);
    await mutate({ userId: 'alice', operation: 'trash', references: [historicalRef] });
    assert.ok(!(await read()).jobs.some(j => j.jobId === 'historical'), 'historical job cannot bypass a trashed exact saved projection');
    const { validateHistoricalJobVideo: validateHistorical } = await import('../frontend/server/media-library/historical-job-video-validation');
    await assert.rejects(validateHistorical('alice', { jobId: 'historical', originalUrl: 'https://media.test/historical.mp4' }), /SOURCE_TRASHED/);
    await mutate({ userId: 'alice', operation: 'restore', references: [historicalRef] });
    assert.ok((await read()).jobs.some(j => j.jobId === 'historical'), 'restored historical projection returns');
    await pg.pool.query("INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata) VALUES('historical-legacy','alice','https://media.test/historical.mp4','video/mp4','generated','{\"jobId\":\"historical\"}')");
    await mutate({ userId: 'alice', operation: 'trash', references: [{ type: 'legacy', assetId: 'historical-legacy', kind: 'video' }] });
    assert.ok(!(await read()).jobs.some(j => j.jobId === 'historical'), 'legacy exact saved projection also controls historical visibility');
    await pg.pool.query("UPDATE app_jobs SET video_url='https://media.test/historical-new.mp4' WHERE job_id='historical'");
    assert.ok((await read()).jobs.some(j => j.jobId === 'historical'), 'old historical projection must not hide new job URL');
    await pg.pool.query("UPDATE app_jobs SET render_ids='[]'::jsonb,status=E'\\t SUCCEEDED ' WHERE job_id='historical'");
    assert.ok((await read()).jobs.some(j => j.jobId === 'historical'), 'empty historical renders and normalized completed status preserve video proof');
    await pg.pool.query("UPDATE app_jobs SET surface=' IMAGE ',render_ids=null WHERE job_id='historical'");
    assert.ok(!(await read()).jobs.some(j => j.jobId === 'historical'), 'normalized non-video surface cannot become historical video');
    await pg.pool.query("UPDATE app_jobs SET surface='video' WHERE job_id='historical'");
    const samples = [
        ['plain', 'video', null, null, 'completed'], ['spaced', ' VIDEO ', null, [], '  SUCCEEDED  '],
        ['image', ' IMAGE ', null, null, 'completed'], ['snapshot', 'video', { surface: ' Audio ' }, null, 'completed'],
        ['upscale_old', null, null, null, 'completed'], ['angleX', 'video', null, null, 'finished'],
        ['render', 'video', null, [{ url: 'https://media.test/frame.png' }], 'completed'],
        ['empty', 'video', null, [{ url: '  ' }], 'success'], ['serialized', 'video', null, JSON.stringify(['image.png']), 'completed'],
        ['invalid-json', 'video', null, 'invalid json', 'completed'], ['not-ready', 'video', null, null, 'running'],
    ];
    for (const [id, surface, snapshot, renders, status] of samples)
        await pg.pool.query('INSERT INTO app_jobs(job_id,user_id,id,surface,settings_snapshot,render_ids,status,video_url,created_at,updated_at) VALUES($1,\'surface-owner\',100,$2,$3,$4,$5,$6,now(),now())', [id, surface, JSON.stringify(snapshot), JSON.stringify(renders), status, 'https://media.test/' + id + '.mp4']);
    const { mapRecentGenerationRecordToWeb, readOwnedGenerationRecordsByIds } = await import('../frontend/src/server/generations/recent-generations');
    const { mapGenerationStatusRecordToAgent } = await import('../frontend/src/server/generations/agent-generation-policy');
    const records = await readOwnedGenerationRecordsByIds({ userId: 'surface-owner', jobIds: samples.map(s => s[0] as string) });
    const expected = records.filter(r => mapRecentGenerationRecordToWeb(r).surface === 'video' && mapGenerationStatusRecordToAgent(r)?.status === 'completed').map(r => r.job_id).sort();
    assert.deepEqual((await read({ userId: 'surface-owner' })).jobs.map(j => j.jobId).sort(), expected, 'candidate SQL has historical proof surface/status parity');
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,id,surface,status,video_url,created_at,updated_at) SELECT 'bounded-'||i,'bounded',i,'video','completed','https://media.test/'||i||'.mp4',now(),now() FROM generate_series(1,105) i");
    assert.equal((await read({ userId: 'bounded' })).jobs.length, 30, 'default candidate page bounded to 30');
    assert.equal((await read({ userId: 'bounded', limit: 999 })).jobs.length, 100, 'maximum candidate page bounded to 100');
    await pg.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url,status) VALUES('upscale-output','upscale_old','surface-owner','video','https://media.test/upscale_old.mp4','ready')");
    assert.equal((await read({userId:'surface-owner',surface:'upscale'})).jobs[0].sourceOutputId,'upscale-output');
    await mutate({userId:'surface-owner',operation:'trash',references:[ref('upscale_old','upscale-output')]});
    assert.equal((await read({userId:'surface-owner',surface:'upscale',limit:1})).jobs.length,0,'Finishing outputs obey Trash before pagination');
    await pg.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url,status,position) VALUES('different-sibling','unsaved','alice','video','https://media.test/other-original.mp4','ready',1)");
    assert.ok((await read()).jobs.some(j=>j.sourceOutputId==='different-sibling'&&j.videoUrl==='https://media.test/other-original.mp4'),'distinct ready sibling keeps its own original even when job primary differs');
    await mutate({userId:'alice',operation:'trash',references:[ref('unsaved','different-sibling')]});
    assert.ok((await read()).jobs.some(j=>j.sourceOutputId==='unsaved-out'),'sibling Trash cannot hide the primary output');
    await pg.pool.query("UPDATE job_outputs SET storage_url='https://durable.test/unsaved.mp4' WHERE id='unsaved-out'");
    assert.ok((await read()).jobs.some(j=>j.sourceOutputId==='unsaved-out'&&j.videoUrl==='https://durable.test/unsaved.mp4'),'persisted original does not depend on stale job URL');
    await pg.pool.query("UPDATE job_outputs SET storage_url=null WHERE id='unsaved-out'");
    const key = 'user-assets/by-content/' + 'c'.repeat(32) + '/' + 'a'.repeat(64) + '.mp4';
    await pg.pool.query("UPDATE app_jobs SET video_url=$1 WHERE job_id='unsaved'", ['https://unrecognized.test/' + key]);
    await pg.pool.query("UPDATE job_outputs SET url=$1 WHERE id='unsaved-out'", ['https://unrecognized.test/' + key]);
    await pg.pool.query("INSERT INTO mcp_reference_upload_object_fences(object_key,state,created_at,updated_at) VALUES($1,'deleted',now(),now())", [key]);
    assert.ok(!(await read()).jobs.some(j => j.sourceOutputId === 'unsaved-out'), 'recorded unavailable storage excluded before limit');
    await pg.pool.query('ALTER TABLE library_organization RENAME TO missing_organization');
    await assert.rejects(read());
    assert.equal((await pg.pool.query("SELECT to_regclass('public.library_organization') AS n")).rows[0].n, null, 'GET cannot repair schema');
});
