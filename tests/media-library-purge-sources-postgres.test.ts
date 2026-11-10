import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { LibraryMediaReference } from '../frontend/lib/media-library-organization';
import type { QueryExecutor, TransactionQueryExecutor } from '../frontend/src/lib/db';
import { parseStoredImageRenders } from '../frontend/lib/image-renders';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('purge source plans remove only proven projections and retain independent media', { timeout: 120000 }, async t => {
  const pg = await startDisposablePostgres('library-purge-sources');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  const db = await import('../frontend/src/lib/db');
  t.after(async () => {
    await db.getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await pg.cleanup();
  });
  const schema = await import('../frontend/src/lib/schema');
  await schema.ensureAssetSchema();
  await schema.ensureMediaLibrarySchema();
  await schema.ensureMediaLibraryOrganizationSchema();
  await pg.pool.query(`CREATE TABLE app_jobs (
    job_id text PRIMARY KEY,user_id text,status text DEFAULT 'completed',hidden boolean DEFAULT false,
    prompt text,surface text,settings_snapshot jsonb,duration_sec integer,aspect_ratio text,
    created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
    video_url text,audio_url text,thumb_url text,preview_video_url text,preview_frame text,keyframe_urls jsonb,
    render_ids jsonb,hero_render_id text,final_price_cents integer DEFAULT 123, payment_status text DEFAULT 'paid');
    CREATE TABLE profiles(id uuid PRIMARY KEY);`);
  await pg.pool.query(readFileSync('neon/migrations/93_character_studio.sql', 'utf8'));
  const purge = await import('../frontend/server/media-library/purge-sources');
  const { resolveOrganizationBatch } = await import('../frontend/server/media-library/organization-resolver');
  const owner = randomUUID(), foreign = randomUUID();
  await pg.pool.query('INSERT INTO profiles(id) VALUES($1),($2)', [owner, foreign]);
  const sourceUrl = (name: string) => `https://cdn.maxvideoai.com/user-assets/${owner}/${name}`;
  const outputRef = (jobId: string, outputId: string, kind: 'image' | 'video' | 'audio' = 'image') => ({ type: 'job-output', jobId, outputId, kind } as const);
  const resolvedSources = async (reference: LibraryMediaReference, tx: TransactionQueryExecutor) => {
    const [resolved] = await resolveOrganizationBatch(owner, [reference], tx, { lockSources: false });
    assert.equal(resolved.error, undefined);
    assert.ok(resolved.identity);
    return resolved.identity.sources;
  };
  const tombstone = (reference: LibraryMediaReference) => db.withDbTransaction(async tx =>
    purge.tombstonePurgeSources(owner, await resolvedSources(reference, tx), tx));
  const tombstoneWithFreshPlan = (reference: LibraryMediaReference) => db.withDbTransaction(async tx => {
    const sources = await resolvedSources(reference, tx);
    const plan = await purge.readPurgeSourcePlan(owner, sources, tx);
    return purge.applyPurgeSourcePlan(owner, plan, tx);
  });

  await t.test('structured image projections retain an independent same-URL output and foreign records', async () => {
    const url = sourceUrl('shared-image.png'), keepThumb = sourceUrl('keep-thumb.webp'), removeThumb = sourceUrl('remove-thumb.webp');
    const keptEntry = { url, sourceOutputId: 'image-keep', thumb_url: keepThumb, caption: 'keep this metadata' };
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,render_ids,hero_render_id,thumb_url,preview_frame)
      VALUES('image-job',$1,$2,$3,$4,$4),('foreign-image-job',$5,$2,$3,$4,$4)`,
      [owner, JSON.stringify([{ url, sourceOutputId: 'image-remove', thumb_url: removeThumb }, keptEntry]), url, keepThumb, foreign]);
    await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,thumb_url,position) VALUES
      ('image-remove','image-job',$1,'image',$2,$3,0),('image-keep','image-job',$1,'image',$2,$4,1),
      ('image-foreign','foreign-image-job',$5,'image',$2,$4,0)`, [owner, url, removeThumb, keepThumb, foreign]);
    const files = await tombstone(outputRef('image-job', 'image-remove'));
    const job = (await pg.pool.query("SELECT * FROM app_jobs WHERE job_id='image-job'")).rows[0];
    assert.deepEqual(job.render_ids, [keptEntry]);
    assert.equal(job.hero_render_id, url, 'the independent sibling still owns this job presentation');
    assert.equal(job.thumb_url, keepThumb);
    assert.equal(job.preview_frame, keepThumb);
    assert.equal(job.final_price_cents, 123);
    assert.equal(job.payment_status, 'paid');
    assert.deepEqual((await pg.pool.query("SELECT id,status FROM job_outputs WHERE job_id='image-job' ORDER BY id")).rows,
      [{ id: 'image-keep', status: 'ready' }, { id: 'image-remove', status: 'deleted' }]);
    assert.equal((await pg.pool.query("SELECT status FROM job_outputs WHERE id='image-foreign'")).rows[0].status, 'ready');
    assert.equal((await pg.pool.query("SELECT jsonb_array_length(render_ids) AS n FROM app_jobs WHERE job_id='foreign-image-job'")).rows[0].n, 2);
    assert.ok(files.some(file => file.url === removeThumb));
    assert.ok(files.every(file => file.url !== keepThumb));
  });

  await t.test('unique legacy image render strings cannot repopulate a deleted image', async () => {
    const removed = sourceUrl('legacy-remove.png'), kept = sourceUrl('legacy-keep.png'), thumb = sourceUrl('legacy-remove.webp');
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,render_ids,hero_render_id,thumb_url,preview_frame)
      VALUES('legacy-image-job',$1,to_jsonb($2::text),$3,$4,$4)`, [owner, JSON.stringify([removed, kept]), removed, thumb]);
    await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,thumb_url,position) VALUES
      ('legacy-image-remove','legacy-image-job',$1,'image',$2,$3,0),('legacy-image-keep','legacy-image-job',$1,'image',$4,$4,1)`, [owner, removed, thumb, kept]);
    await tombstone(outputRef('legacy-image-job', 'legacy-image-remove'));
    const job = (await pg.pool.query("SELECT * FROM app_jobs WHERE job_id='legacy-image-job'")).rows[0];
    assert.deepEqual(parseStoredImageRenders(job.render_ids).entries.map(entry => entry.url), [kept]);
    assert.notEqual(job.hero_render_id, removed);
    assert.notEqual(job.thumb_url, thumb);
    assert.notEqual(job.preview_frame, thumb);
    assert.equal((await pg.pool.query("SELECT status FROM job_outputs WHERE id='legacy-image-keep'")).rows[0].status, 'ready');
  });

  for (const kind of ['image', 'video', 'audio'] as const) {
    await t.test(`sequential ${kind} purges preserve a same-URL sibling then clear the final job projection`, async () => {
      const jobId = `sequential-${kind}-job`, firstId = `sequential-${kind}-first`, lastId = `sequential-${kind}-last`;
      const url = sourceUrl(`sequential-${kind}.${kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'wav'}`);
      const thumb = sourceUrl(`sequential-${kind}.webp`), frame = sourceUrl(`sequential-${kind}-frame.jpg`);
      const preview = kind === 'video' ? sourceUrl('sequential-video-preview.mp4') : null;
      const keyframes = kind === 'video' ? { start: sourceUrl('sequential-video-start.jpg'), end: sourceUrl('sequential-video-end.jpg') } : null;
      const renders = kind === 'image' ? [{ url, sourceOutputId: firstId }, { url, sourceOutputId: lastId }] : null;
      await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,video_url,audio_url,hero_render_id,render_ids,thumb_url,preview_video_url,preview_frame,keyframe_urls)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [jobId, owner, kind === 'video' ? url : null, kind === 'audio' ? url : null, kind === 'image' ? url : null,
          renders === null ? null : JSON.stringify(renders), thumb, preview, frame, keyframes]);
      await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,thumb_url,preview_url,position) VALUES
        ($1,$2,$3,$4,$5,$6,$7,0),($8,$2,$3,$4,$5,$6,$7,1)`, [firstId, jobId, owner, kind, url, thumb, preview, lastId]);
      await tombstoneWithFreshPlan(outputRef(jobId, firstId, kind));
      const readJob = async () => (await pg.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
      const afterFirst = await readJob();
      const primary = kind === 'image' ? 'hero_render_id' : kind === 'video' ? 'video_url' : 'audio_url';
      assert.equal(afterFirst[primary], url, 'a surviving independent output still owns the primary projection');
      assert.equal(afterFirst.thumb_url, thumb);
      assert.equal(afterFirst.preview_frame, frame);
      assert.equal(afterFirst.preview_video_url, preview);
      assert.deepEqual(afterFirst.keyframe_urls, keyframes);
      if (kind === 'image') assert.deepEqual(afterFirst.render_ids, [{ url, sourceOutputId: lastId }]);
      assert.equal((await pg.pool.query('SELECT status FROM job_outputs WHERE id=$1', [lastId])).rows[0].status, 'ready');
      const files = await tombstoneWithFreshPlan(outputRef(jobId, lastId, kind));
      const afterLast = await readJob();
      assert.equal(afterLast[primary], null, 'the deleted first sibling must not keep the final projection alive');
      assert.notEqual(afterLast.thumb_url, thumb);
      assert.equal(afterLast.preview_frame, null);
      assert.equal(afterLast.preview_video_url, null);
      assert.ok(afterLast.keyframe_urls === null || Object.keys(afterLast.keyframe_urls).length === 0);
      if (kind === 'image') assert.deepEqual(afterLast.render_ids, []);
      assert.deepEqual((await pg.pool.query('SELECT status FROM job_outputs WHERE job_id=$1 ORDER BY id', [jobId])).rows,
        [{ status: 'deleted' }, { status: 'deleted' }]);
      for (const derivative of [thumb, frame, ...(preview ? [preview] : []), ...Object.values(keyframes ?? {})]) {
        assert.ok(files.some(file => file.url === derivative), `missing final owned derivative ${derivative}`);
      }
    });
  }

  for (const kind of ['image', 'video', 'audio'] as const) {
    await t.test(`a stored ${kind} output clears legacy projections of its exact recorded provider URL`, async () => {
      const jobId = `provider-${kind}-job`, outputId = `provider-${kind}-output`, siblingId = `provider-${kind}-sibling`;
      const extension = kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'wav';
      const provider = `https://provider.example/selected-${kind}.${extension}`;
      const siblingProvider = `https://provider.example/independent-${kind}.${extension}`;
      const stored = sourceUrl(`provider-selected-${kind}.${extension}`), siblingStored = sourceUrl(`provider-independent-${kind}.${extension}`);
      const thumb = sourceUrl(`provider-selected-${kind}.webp`), frame = sourceUrl(`provider-selected-${kind}-frame.jpg`);
      const preview = kind === 'video' ? sourceUrl('provider-selected-preview.mp4') : null;
      const keyframes = kind === 'video' ? { start: sourceUrl('provider-selected-start.jpg'), end: sourceUrl('provider-selected-end.jpg') } : null;
      await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,video_url,audio_url,hero_render_id,render_ids,thumb_url,preview_video_url,preview_frame,keyframe_urls)
        VALUES($1,$2,$3,$4,$5,to_jsonb($6::text),$7,$8,$9,$10)`,
        [jobId, owner, kind === 'video' ? provider : null, kind === 'audio' ? provider : null, kind === 'image' ? provider : null,
          kind === 'image' ? JSON.stringify([provider, siblingProvider]) : null, thumb, preview, frame, keyframes]);
      await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,storage_url,thumb_url,preview_url,position) VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,0),($9,$2,$3,$4,$10,$11,NULL,NULL,1)`,
        [outputId, jobId, owner, kind, provider, stored, thumb, preview, siblingId, siblingProvider, siblingStored]);
      const files = await tombstoneWithFreshPlan(outputRef(jobId, outputId, kind));
      const job = (await pg.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
      if (kind === 'image') assert.deepEqual(parseStoredImageRenders(job.render_ids).entries.map(entry => entry.url), [siblingProvider]);
      const primary = kind === 'image' ? 'hero_render_id' : kind === 'video' ? 'video_url' : 'audio_url';
      assert.equal(job[primary], null, 'the exact provider alias must not keep a deleted output projected');
      assert.notEqual(job.thumb_url, thumb);
      assert.equal(job.preview_frame, null);
      assert.equal(job.preview_video_url, null);
      assert.ok(job.keyframe_urls === null || Object.keys(job.keyframe_urls).length === 0);
      assert.equal((await pg.pool.query('SELECT status FROM job_outputs WHERE id=$1', [outputId])).rows[0].status, 'deleted');
      assert.equal((await pg.pool.query('SELECT status FROM job_outputs WHERE id=$1', [siblingId])).rows[0].status, 'ready');
      for (const original of [provider, stored]) assert.ok(files.some(file => file.url === original && file.role === 'original'), `missing recorded original ${original}`);
      for (const derivative of [thumb, frame, ...(preview ? [preview] : []), ...Object.values(keyframes ?? {})]) {
        assert.ok(files.some(file => file.url === derivative), `missing selected derivative ${derivative}`);
      }
      assert.ok(files.every(file => file.url !== siblingProvider && file.url !== siblingStored));
    });
  }

  await t.test('a proven primary video clears its own previews and keyframes without touching independent audio or video', async () => {
    const video = sourceUrl('primary.mp4'), sibling = sourceUrl('sibling.mp4'), audio = sourceUrl('independent.wav');
    const thumb = sourceUrl('primary.webp'), preview = sourceUrl('primary-preview.mp4'), frame = sourceUrl('primary-frame.jpg');
    const keyframes = { start: sourceUrl('key-start.jpg'), middle: sourceUrl('key-middle.jpg'), end: sourceUrl('key-end.jpg') };
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,video_url,audio_url,thumb_url,preview_video_url,preview_frame,keyframe_urls)
      VALUES('video-job',$1,$2,$3,$4,$5,$6,$7)`, [owner, video, audio, thumb, preview, frame, keyframes]);
    await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,thumb_url,preview_url,position) VALUES
      ('primary-video','video-job',$1,'video',$2,$3,$4,0),('sibling-video','video-job',$1,'video',$5,$5,$5,1),
      ('independent-audio','video-job',$1,'audio',$6,NULL,NULL,0)`, [owner, video, thumb, preview, sibling, audio]);
    const files = await tombstone(outputRef('video-job', 'primary-video', 'video'));
    const job = (await pg.pool.query("SELECT * FROM app_jobs WHERE job_id='video-job'")).rows[0];
    assert.equal(job.video_url, null);
    assert.equal(job.preview_video_url, null);
    assert.equal(job.preview_frame, null);
    assert.ok(job.keyframe_urls === null || Object.keys(job.keyframe_urls).length === 0);
    assert.notEqual(job.thumb_url, thumb);
    assert.equal(job.audio_url, audio);
    assert.equal(job.status, 'completed');
    assert.equal(job.payment_status, 'paid');
    assert.deepEqual((await pg.pool.query("SELECT id,status FROM job_outputs WHERE id IN ('sibling-video','independent-audio') ORDER BY id")).rows,
      [{ id: 'independent-audio', status: 'ready' }, { id: 'sibling-video', status: 'ready' }]);
    for (const url of [video, thumb, preview, frame, ...Object.values(keyframes)]) assert.ok(files.some(file => file.url === url), `missing owned derivative ${url}`);
    assert.ok(files.every(file => file.url !== sibling && file.url !== audio));
  });

  await t.test('deleting an audio output leaves the independent primary video presentation intact', async () => {
    const video = sourceUrl('audio-case-video.mp4'), audio = sourceUrl('audio-case-remove.wav');
    const thumb = sourceUrl('audio-case-video.webp'), preview = sourceUrl('audio-case-preview.mp4'), frame = sourceUrl('audio-case-frame.jpg');
    const keyframes = { start: sourceUrl('audio-case-start.jpg'), end: sourceUrl('audio-case-end.jpg') };
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,video_url,audio_url,thumb_url,preview_video_url,preview_frame,keyframe_urls)
      VALUES('audio-case-job',$1,$2,$3,$4,$5,$6,$7)`, [owner, video, audio, thumb, preview, frame, keyframes]);
    await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,thumb_url,preview_url) VALUES
      ('audio-case-video','audio-case-job',$1,'video',$2,$3,$4),('audio-case-remove','audio-case-job',$1,'audio',$5,NULL,NULL)`,
      [owner, video, thumb, preview, audio]);
    const files = await tombstone(outputRef('audio-case-job', 'audio-case-remove', 'audio'));
    const job = (await pg.pool.query("SELECT video_url,audio_url,thumb_url,preview_video_url,preview_frame,keyframe_urls FROM app_jobs WHERE job_id='audio-case-job'")).rows[0];
    assert.deepEqual(job, { video_url: video, audio_url: null, thumb_url: thumb, preview_video_url: preview, preview_frame: frame, keyframe_urls: keyframes });
    assert.ok(files.every(file => file.url !== video && file.url !== thumb && file.url !== preview && file.url !== frame && !Object.values(keyframes).includes(file.url)));
    assert.equal((await pg.pool.query("SELECT status FROM job_outputs WHERE id='audio-case-video'")).rows[0].status, 'ready');
  });

  await t.test('Character base deletion does not cascade to independent looks, and deleting one look preserves its siblings', async () => {
    const base = sourceUrl('character-base.png'), look = sourceUrl('character-look.png'), otherLook = sourceUrl('character-other.png');
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,render_ids,surface,settings_snapshot) VALUES
      ('character-base-job',$1,$2,'character-builder','{"schemaVersion":1,"surface":"character-builder","builder":{"traits":{}}}'),
      ('character-look-job',$1,$3,'character-builder','{"schemaVersion":1,"surface":"character-builder","builder":{"traits":{}}}'),
      ('character-other-job',$1,$4,'character-builder','{"schemaVersion":1,"surface":"character-builder","builder":{"traits":{}}}')`,
      [owner, JSON.stringify([base]), JSON.stringify([look]), JSON.stringify([otherLook])]);
    await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES
      ('character-base-output','character-base-job',$1,'image',$2),('character-look-output','character-look-job',$1,'image',$3),
      ('character-other-output','character-other-job',$1,'image',$4)`, [owner, base, look, otherLook]);
    const character = (await pg.pool.query(`INSERT INTO character_studio_characters(user_id,name,source_job_id,image_url,thumb_url,settings_snapshot)
      VALUES($1,'Identity','character-base-job',$2,$2,'{}') RETURNING id`, [owner, base])).rows[0].id;
    await pg.pool.query(`INSERT INTO character_studio_looks(character_id,user_id,name,source_job_id,image_url,thumb_url,settings_snapshot) VALUES
      ($1,$2,'Chosen look','character-look-job',$3,$3,'{}'),($1,$2,'Independent look','character-other-job',$4,$4,'{}')`, [character, owner, look, otherLook]);
    await tombstone(outputRef('character-base-job', 'character-base-output'));
    const remainingBase = (await pg.pool.query('SELECT image_url FROM character_studio_characters WHERE id=$1', [character])).rows[0];
    assert.ok(remainingBase, 'the parent row must survive its real cascading FK');
    assert.notEqual(remainingBase.image_url, base);
    assert.deepEqual((await pg.pool.query('SELECT image_url FROM character_studio_looks WHERE character_id=$1 ORDER BY image_url', [character])).rows.map(row => row.image_url), [look, otherLook].sort());
    await tombstone(outputRef('character-look-job', 'character-look-output'));
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM character_studio_looks WHERE character_id=$1 AND image_url=$2', [character, look])).rows[0].n, 0);
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM character_studio_looks WHERE character_id=$1 AND image_url=$2', [character, otherLook])).rows[0].n, 1);
    assert.equal((await pg.pool.query("SELECT status FROM job_outputs WHERE id='character-other-output'")).rows[0].status, 'ready');
  });

  await t.test('distinct images and Character looks from one job can be purged sequentially', async () => {
    const base = sourceUrl('sequential-character-base.png'), first = sourceUrl('sequential-character-first.png'), last = sourceUrl('sequential-character-last.png');
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,render_ids,hero_render_id,thumb_url,surface,settings_snapshot) VALUES
      ('sequential-character-base-job',$1,$2,$3,$3,'character-builder','{"schemaVersion":1,"surface":"character-builder","builder":{"traits":{}}}'),
      ('sequential-character-looks-job',$1,$4,$5,$5,'character-builder','{"schemaVersion":1,"surface":"character-builder","builder":{"traits":{}}}')`,
      [owner, JSON.stringify([base]), base, JSON.stringify([first, last]), first]);
    await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,position) VALUES
      ('sequential-character-base-output','sequential-character-base-job',$1,'image',$2,0),
      ('sequential-character-first-output','sequential-character-looks-job',$1,'image',$3,0),
      ('sequential-character-last-output','sequential-character-looks-job',$1,'image',$4,1)`, [owner, base, first, last]);
    const character = (await pg.pool.query(`INSERT INTO character_studio_characters(user_id,name,source_job_id,image_url,thumb_url,settings_snapshot)
      VALUES($1,'Sequential identity','sequential-character-base-job',$2,$2,'{}') RETURNING id`, [owner, base])).rows[0].id;
    await pg.pool.query(`INSERT INTO character_studio_looks(character_id,user_id,name,source_job_id,image_url,thumb_url,settings_snapshot) VALUES
      ($1,$2,'First look','sequential-character-looks-job',$3,$3,'{}'),
      ($1,$2,'Last look','sequential-character-looks-job',$4,$4,'{}')`, [character, owner, first, last]);
    await tombstoneWithFreshPlan(outputRef('sequential-character-looks-job', 'sequential-character-first-output'));
    assert.deepEqual((await pg.pool.query("SELECT render_ids FROM app_jobs WHERE job_id='sequential-character-looks-job'")).rows[0].render_ids, [last]);
    const readLooks = async () => (await pg.pool.query('SELECT image_url,thumb_url FROM character_studio_looks WHERE character_id=$1 ORDER BY id', [character])).rows;
    const afterFirst = await readLooks();
    assert.ok(afterFirst.every(look => look.image_url !== first && look.thumb_url !== first));
    assert.ok(afterFirst.some(look => look.image_url === last && look.thumb_url === last));
    assert.equal((await pg.pool.query("SELECT status FROM job_outputs WHERE id='sequential-character-last-output'")).rows[0].status, 'ready');
    await tombstoneWithFreshPlan(outputRef('sequential-character-looks-job', 'sequential-character-last-output'));
    assert.deepEqual((await pg.pool.query("SELECT render_ids FROM app_jobs WHERE job_id='sequential-character-looks-job'")).rows[0].render_ids, []);
    assert.ok((await readLooks()).every(look => ![first, last].includes(look.image_url) && ![first, last].includes(look.thumb_url)));
    assert.deepEqual((await pg.pool.query('SELECT image_url,thumb_url FROM character_studio_characters WHERE id=$1', [character])).rows[0], { image_url: base, thumb_url: base });
    assert.equal((await pg.pool.query("SELECT status FROM job_outputs WHERE id='sequential-character-base-output'")).rows[0].status, 'ready');
  });

  await t.test('a file plan retains conflicting nonnull size evidence from canonical and legacy copies', async () => {
    const publicId = `ma_${randomUUID().replaceAll('-', '')}`, url = sourceUrl('conflicting-size.wav');
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,source)
      VALUES('conflicting-size',$1,$2,'audio',$3,'audio/wav',100,'upload')`, [publicId, owner, url]);
    await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,size_bytes,source)
      VALUES('conflicting-size',$1,$2,'audio/wav',200,'upload')`, [owner, url]);
    const reference = { type: 'asset', assetId: publicId, kind: 'audio' } as const;
    const plan = await db.withDbTransaction(async tx => purge.readPurgeSourcePlan(owner, await resolvedSources(reference, tx), tx));
    assert.deepEqual(plan.sources.map(source => source.type).sort(), ['asset', 'legacy']);
    assert.deepEqual(plan.files.filter(file => file.url === url).map(file => file.sizeBytes).sort((a, b) => (a ?? 0) - (b ?? 0)), [100, 200],
      'the planner must expose contradictory sizes to storage accounting instead of silently choosing one');
    assert.equal((await pg.pool.query("SELECT status FROM media_assets WHERE id='conflicting-size'")).rows[0].status, 'ready');
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM user_assets WHERE asset_id='conflicting-size'")).rows[0].n, 1);
  });

  await t.test('a changed accepted derivative projection fails before any source tombstones', async () => {
    const video = sourceUrl('frozen.mp4'), oldPreview = sourceUrl('frozen-old.mp4'), newPreview = sourceUrl('frozen-new.mp4');
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,video_url,preview_video_url) VALUES('frozen-job',$1,$2,$3)", [owner, video, oldPreview]);
    await pg.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES('frozen-output','frozen-job',$1,'video',$2)", [owner, video]);
    const reference = outputRef('frozen-job', 'frozen-output', 'video');
    const accepted = await db.withDbTransaction(async tx => purge.readPurgeSourcePlan(owner, await resolvedSources(reference, tx), tx));
    await pg.pool.query("UPDATE app_jobs SET preview_video_url=$1 WHERE job_id='frozen-job'", [newPreview]);
    await assert.rejects(db.withDbTransaction(async tx => purge.tombstonePurgeSources(owner, await resolvedSources(reference, tx), tx, accepted)), /CHANGED|MISMATCH/);
    assert.equal((await pg.pool.query("SELECT status FROM job_outputs WHERE id='frozen-output'")).rows[0].status, 'ready');
    assert.equal((await pg.pool.query("SELECT preview_video_url FROM app_jobs WHERE job_id='frozen-job'")).rows[0].preview_video_url, newPreview);
  });

  await t.test('applying a source plan requires its original transaction locks and cannot be replayed', async () => {
    const publicId = `ma_${randomUUID().replaceAll('-', '')}`;
    const reference = { type: 'asset', assetId: publicId, kind: 'image' } as const;
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,source)
      VALUES('prelocked-source',$1,$2,'image',$3,'image/png','upload')`, [publicId, owner, sourceUrl('prelocked-source.png')]);
    const oldPlan = await db.withDbTransaction(async tx => purge.readPurgeSourcePlan(owner, await resolvedSources(reference, tx), tx));
    await assert.rejects(db.withDbTransaction(tx => purge.applyPurgeSourcePlan(owner, oldPlan, tx)), /PURGE_SOURCE_PLAN_NOT_LOCKED/);
    assert.equal((await pg.pool.query("SELECT status FROM media_assets WHERE id='prelocked-source'")).rows[0].status, 'ready');
    await db.withDbTransaction(async tx => {
      const plan = await purge.readPurgeSourcePlan(owner, await resolvedSources(reference, tx), tx);
      await assert.rejects(purge.applyPurgeSourcePlan(owner, JSON.parse(JSON.stringify(plan)), tx), /PURGE_SOURCE_PLAN_NOT_LOCKED/);
      assert.equal((await tx.query<{ status: string }>("SELECT status FROM media_assets WHERE id='prelocked-source'"))[0].status, 'ready');
      await purge.applyPurgeSourcePlan(owner, plan, tx);
      await assert.rejects(purge.applyPurgeSourcePlan(owner, plan, tx), /PURGE_SOURCE_PLAN_NOT_LOCKED/);
    });
    assert.equal((await pg.pool.query("SELECT status FROM media_assets WHERE id='prelocked-source'")).rows[0].status, 'deleted');
  });

  await t.test('prepared copies need exact typed lineage and a matching producer fingerprint; generated results remain independent', async () => {
    const parentId = `ma_${randomUUID().replaceAll('-', '')}`, childId = `ma_${randomUUID().replaceAll('-', '')}`;
    const parent = { type: 'asset', assetId: parentId, kind: 'video' } as const;
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,source,metadata)
      VALUES('prepared-parent',$1,$2,'video',$3,'video/mp4',100,'upload','{"durationSec":8}')`, [parentId, owner, sourceUrl('prepared-parent.mp4')]);
    const { resolveStudioMedia } = await import('../frontend/src/server/studio/media-resolver');
    const original = await resolveStudioMedia(owner, parent);
    const fingerprint = createHash('sha256').update(JSON.stringify(original)).digest('hex');
    const lineage = { version: 3, source: parent, range: { startSec: 0, endSec: 4 }, sourceFingerprint: fingerprint };
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,source,metadata) VALUES
      ('prepared-child',$1,$2,'video',$3,'video/mp4',40,'import',$4),
      ('prepared-mismatch',$5,$2,'video',$6,'video/mp4',40,'import',$7),
      ('prepared-generated',$8,$2,'video',$9,'video/mp4',40,'saved_job_output',$10)`,
      [childId, owner, sourceUrl('prepared-child.mp4'), { videoExcerpt: lineage, durationSec: 4 }, `ma_${randomUUID().replaceAll('-', '')}`, sourceUrl('prepared-mismatch.mp4'),
        { videoExcerpt: { ...lineage, sourceFingerprint: 'f'.repeat(64) }, durationSec: 4 }, `ma_${randomUUID().replaceAll('-', '')}`, sourceUrl('prepared-generated.mp4'),
        { creator: { version: 1, source: parent, sourceFingerprint: fingerprint, generation: { jobId: 'independent-generation' } } }]);
    await pg.pool.query("INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,size_bytes) VALUES('prepared-child',$1,$2,'video/mp4','upload','{}',40)", [owner, sourceUrl('prepared-child.mp4')]);
    await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,size_bytes)
      SELECT id,user_id,url,mime_type,'upload',metadata,size_bytes FROM media_assets WHERE id='prepared-mismatch'`);
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,source,metadata)
      VALUES('foreign-prepared-child',$1,$2,'video',$3,'video/mp4',40,'import',$4)`,
      [`ma_${randomUUID().replaceAll('-', '')}`, foreign, sourceUrl('foreign-prepared.mp4'), { videoExcerpt: lineage }]);
    const accepted = await db.withDbTransaction(async tx => purge.readPurgeSourcePlan(owner, await resolvedSources(parent, tx), tx));
    assert.ok(accepted.sources.some(source => source.type === 'asset' && source.id === 'prepared-child'));
    assert.ok(accepted.sources.some(source => source.type === 'legacy' && source.id === 'prepared-child'));
    assert.ok(accepted.sources.every(source => source.id !== 'foreign-prepared-child'));
    assert.deepEqual(accepted.retainedPrepared.map(({ id, sizeBytes, reason }) => ({ id, sizeBytes, reason })),
      [{ id: 'prepared-mismatch', sizeBytes: 40, reason: 'PREPARATION_SOURCE_VERSION_UNPROVEN' }]);
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM media_assets WHERE id LIKE 'prepared-%' AND status='ready'")).rows[0].n, 4, 'freezing the plan does not tombstone media');
    const { preparedLibraryMediaSql } = await import('../frontend/server/media-library/prepared-media-sql');
    const readRetained = async () => (await pg.pool.query(`SELECT status,metadata,${preparedLibraryMediaSql('metadata', 'kind')} AS prepared
      FROM media_assets WHERE id='prepared-mismatch'`)).rows[0];
    const retainedBefore = await readRetained();
    assert.equal(retainedBefore.prepared, true, 'the original preparation starts excluded from browse discovery');
    const { libraryIdentityCtes } = await import('../frontend/server/media-library/browse-identity-sql');
    const readRetainedGroup = async () => (await pg.pool.query(`WITH ${libraryIdentityCtes('$1')}
      SELECT type,internal_group FROM library_identities WHERE id='prepared-mismatch' ORDER BY type`, [owner])).rows;
    assert.deepEqual(await readRetainedGroup(), [{ type: 'asset', internal_group: true }, { type: 'legacy', internal_group: true }]);
    const legacyBefore = (await pg.pool.query("SELECT url,metadata,size_bytes FROM user_assets WHERE asset_id='prepared-mismatch'")).rows[0];
    await db.withDbTransaction(async tx => purge.tombstonePurgeSources(owner, await resolvedSources(parent, tx), tx, accepted));
    assert.deepEqual((await pg.pool.query("SELECT id,status FROM media_assets WHERE id LIKE 'prepared-%' ORDER BY id")).rows,
      [{ id: 'prepared-child', status: 'deleted' }, { id: 'prepared-generated', status: 'ready' }, { id: 'prepared-mismatch', status: 'ready' }, { id: 'prepared-parent', status: 'deleted' }]);
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM user_assets WHERE asset_id='prepared-child'")).rows[0].n, 0);
    assert.equal((await pg.pool.query("SELECT status FROM media_assets WHERE id='foreign-prepared-child'")).rows[0].status, 'ready');
    const retainedAfter = await readRetained();
    assert.equal(retainedAfter.status, 'ready');
    assert.equal(retainedAfter.metadata.libraryPurgeRetained?.version, 1);
    assert.equal(retainedAfter.metadata.libraryPurgeRetained?.reason, 'PREPARATION_SOURCE_VERSION_UNPROVEN');
    assert.deepEqual(retainedAfter.metadata.videoExcerpt, retainedBefore.metadata.videoExcerpt, 'retaining the copy must not rewrite its lineage');
    assert.equal(retainedAfter.prepared, false, 'the retained copy must become discoverable so it can be reviewed and deleted independently');
    assert.deepEqual((await pg.pool.query("SELECT url,metadata,size_bytes FROM user_assets WHERE asset_id='prepared-mismatch'")).rows[0], legacyBefore,
      'the unproved legacy mirror remains intact');
    assert.deepEqual(await readRetainedGroup(), [{ type: 'asset', internal_group: false }, { type: 'legacy', internal_group: false }],
      'an unchanged internal legacy mirror must not hide the retained identity group');
  });

  await t.test('audio excerpts and Creator images follow their producer fingerprints, never a coincident original URL', async () => {
    const { resolveStudioMedia } = await import('../frontend/src/server/studio/media-resolver');
    const { creatorSourceFingerprint } = await import('../frontend/src/server/tools/creator-sources');
    for (const kind of ['audio', 'image'] as const) {
      const id = `producer-${kind}`, originalUrl = sourceUrl(`${id}.${kind === 'audio' ? 'wav' : 'png'}`);
      const reference = outputRef(`${id}-job`, id, kind);
      const independentReference = outputRef(`${id}-job`, `${id}-independent`, kind);
      const mime = kind === 'audio' ? 'audio/wav' : 'image/png';
      await pg.pool.query('INSERT INTO app_jobs(job_id,user_id) VALUES($1,$2)', [`${id}-job`, owner]);
      await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,mime_type,position) VALUES
        ($1,$2,$3,$4,$5,$6,0),($7,$2,$3,$4,$5,$6,1)`,
        [id, `${id}-job`, owner, kind, originalUrl, mime, `${id}-independent`]);
      const media = await resolveStudioMedia(owner, reference), independent = await resolveStudioMedia(owner, independentReference);
      const fingerprint = (source: typeof media) => kind === 'audio'
        ? createHash('sha256').update(JSON.stringify(source)).digest('hex') : creatorSourceFingerprint(source);
      const metadata = (source: typeof reference | typeof independentReference, sourceFingerprint: string) => kind === 'audio'
        ? { audioExcerpt: { version: 3, source, sourceFingerprint, range: { startSec: 0, endSec: 4 } }, durationSec: 4 }
        : { creator: { version: 1, source, sourceFingerprint, role: 'image', segment: null } };
      await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,source,metadata) VALUES
        ($1,$2,$3,$4,$5,$6,40,'import',$7),($8,$9,$3,$4,$10,$6,40,'import',$11)`,
        [`${id}-child`, `ma_${randomUUID().replaceAll('-', '')}`, owner, kind, sourceUrl(`${id}-child`), mime, metadata(reference, fingerprint(media)),
          `${id}-other-child`, `ma_${randomUUID().replaceAll('-', '')}`, sourceUrl(`${id}-other-child`), metadata(independentReference, fingerprint(independent))]);
      const accepted = await db.withDbTransaction(async tx => purge.readPurgeSourcePlan(owner, await resolvedSources(reference, tx), tx));
      assert.ok(accepted.sources.some(source => source.type === 'asset' && source.id === `${id}-child`));
      assert.ok(accepted.sources.every(source => source.id !== `${id}-independent` && source.id !== `${id}-other-child`));
      await db.withDbTransaction(async tx => purge.tombstonePurgeSources(owner, await resolvedSources(reference, tx), tx, accepted));
      assert.equal((await pg.pool.query('SELECT status FROM media_assets WHERE id=$1', [`${id}-child`])).rows[0].status, 'deleted');
      assert.equal((await pg.pool.query('SELECT status FROM job_outputs WHERE id=$1', [`${id}-independent`])).rows[0].status, 'ready');
      assert.equal((await pg.pool.query('SELECT status FROM media_assets WHERE id=$1', [`${id}-other-child`])).rows[0].status, 'ready');
    }
  });

  await t.test('changing a prepared child after plan acceptance rejects the whole graph before tombstones', async () => {
    const parentId = `ma_${randomUUID().replaceAll('-', '')}`, childId = `ma_${randomUUID().replaceAll('-', '')}`;
    const reference = { type: 'asset', assetId: parentId, kind: 'audio' } as const;
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,source,metadata)
      VALUES('stale-parent',$1,$2,'audio',$3,'audio/wav',100,'upload','{"durationSec":8}')`, [parentId, owner, sourceUrl('stale-parent.wav')]);
    const { resolveStudioMedia } = await import('../frontend/src/server/studio/media-resolver');
    const sourceFingerprint = createHash('sha256').update(JSON.stringify(await resolveStudioMedia(owner, reference))).digest('hex');
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,source,metadata)
      VALUES('stale-child',$1,$2,'audio',$3,'audio/wav',40,'import',$4)`, [childId, owner, sourceUrl('stale-child.wav'),
      { audioExcerpt: { version: 3, source: reference, sourceFingerprint, range: { startSec: 0, endSec: 4 } }, durationSec: 4 }]);
    const accepted = await db.withDbTransaction(async tx => purge.readPurgeSourcePlan(owner, await resolvedSources(reference, tx), tx));
    assert.ok(accepted.sources.some(source => source.id === 'stale-child'));
    await pg.pool.query("UPDATE media_assets SET metadata=jsonb_set(metadata,'{audioExcerpt,sourceFingerprint}',to_jsonb($1::text)) WHERE id='stale-child'", ['f'.repeat(64)]);
    await assert.rejects(db.withDbTransaction(async tx => purge.tombstonePurgeSources(owner, await resolvedSources(reference, tx), tx, accepted)), /CHANGED|MISMATCH/);
    assert.deepEqual((await pg.pool.query("SELECT id,status FROM media_assets WHERE id IN ('stale-parent','stale-child') ORDER BY id")).rows,
      [{ id: 'stale-child', status: 'ready' }, { id: 'stale-parent', status: 'ready' }]);
  });

  await t.test('1001 independent prepared families are discovered completely with bounded SQL reads', async bulkTest => {
    const bulkOwner = randomUUID();
    const bulkUrl = (name: string) => `https://cdn.maxvideoai.com/user-assets/${bulkOwner}/${name}.mp4`;
    const roots = Array.from({ length: 1001 }, (_, index) => ({
      id: `bulk-prepared-parent-${index}`, public_id: `ma_${randomUUID().replaceAll('-', '')}`, url: bulkUrl(`parent-${index}`),
    }));
    await pg.pool.query('INSERT INTO profiles(id) VALUES($1)', [bulkOwner]);
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,source,metadata)
      SELECT r.id,r.public_id,$2,'video',r.url,'video/mp4',100,'upload','{"durationSec":8}'::jsonb
      FROM jsonb_to_recordset($1::jsonb) AS r(id text,public_id text,url text)`, [JSON.stringify(roots), bulkOwner]);
    const references = roots.map(root => ({ type: 'asset', assetId: root.public_id, kind: 'video' } as const));
    const { resolveStudioMedia } = await import('../frontend/src/server/studio/media-resolver');
    const snapshots = await Promise.all(references.map(reference => resolveStudioMedia(bulkOwner, reference)));
    const children = roots.map((_, index) => ({
      id: `bulk-prepared-child-${index}`, public_id: `ma_${randomUUID().replaceAll('-', '')}`, url: bulkUrl(`child-${index}`),
      metadata: { durationSec: 4, videoExcerpt: { version: 3, source: references[index], range: { startSec: 0, endSec: 4 },
        sourceFingerprint: createHash('sha256').update(JSON.stringify(snapshots[index])).digest('hex') } },
    }));
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,source,metadata)
      SELECT r.id,r.public_id,$2,'video',r.url,'video/mp4',40,'import',r.metadata
      FROM jsonb_to_recordset($1::jsonb) AS r(id text,public_id text,url text,metadata jsonb)`, [JSON.stringify(children), bulkOwner]);
    const { readOrganizationSourceBatch } = await import('../frontend/server/media-library/organization-sources');
    const rootBatch = await readOrganizationSourceBatch(bulkOwner, references, { query: db.query });
    assert.equal(rootBatch.sources.length, 1001);
    assert.deepEqual(rootBatch.proofLimitedSourceIds, []);
    const { discoverPreparedPurgeSources } = await import('../frontend/server/media-library/purge-prepared-sources');
    let queryCount = 0;
    const measuredExecutor: QueryExecutor = { query: async <TRecord = unknown>(sql: string, params?: ReadonlyArray<unknown>) => {
      queryCount += 1;
      return db.query<TRecord>(sql, params);
    } };
    const discovered = await discoverPreparedPurgeSources(bulkOwner, rootBatch.sources, measuredExecutor);
    bulkTest.diagnostic(`Prepared discovery: ${queryCount} SQL queries for 1001 roots and 1001 children; setup excluded.`);
    assert.deepEqual(discovered.sources.map(source => source.id).sort(), [...roots, ...children].map(source => source.id).sort());
    assert.equal(discovered.prepared.length, 1001);
    assert.deepEqual(discovered.retainedPrepared, []);
    assert.ok(queryCount <= 25, `discovery used ${queryCount} SQL queries; limit is 25`);
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM media_assets WHERE user_id=$1 AND status='ready'", [bulkOwner])).rows[0].n, 2002);
  });
});
