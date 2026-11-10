import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('library suppresses prepared inputs and reconciles proven historical output copies across media kinds', { timeout: 120000 }, async (t) => {
  const pg = await startDisposablePostgres('library-duplicates');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  const db = await import('../frontend/src/lib/db');
  t.after(async () => { await db.getDb().end(); process.env.DATABASE_URL = previous; await pg.cleanup(); });
  const schema = await import('../frontend/src/lib/schema');
  await schema.ensureAssetSchema();
  await schema.ensureMediaLibrarySchema();
  await schema.ensureMediaLibraryOrganizationSchema();
  await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,status text DEFAULT 'completed',audio_url text,hidden boolean DEFAULT false,prompt text,surface text,settings_snapshot jsonb,duration_sec integer,aspect_ratio text,created_at timestamptz DEFAULT now())`);
  const fenceMigration=readFileSync('neon/migrations/37_mcp_reference_upload_recovery_state.sql','utf8');
  await pg.pool.query(fenceMigration.match(/CREATE TABLE IF NOT EXISTS mcp_reference_upload_object_fences[\s\S]*?\n\);/)![0]);
  await pg.pool.query(readFileSync('neon/migrations/43_mcp_reference_asset_deletion.sql','utf8').match(/CREATE OR REPLACE FUNCTION reference_storage_authority_is_recognized[\s\S]*?\$\$;/)![0]);
  await pg.pool.query(readFileSync('neon/migrations/98_media_library_purge.sql','utf8'));
  const { browseLibrary } = await import('../frontend/server/media-library/browse');
  const { resolveLibraryOrganizationReferences: resolve } = await import('../frontend/server/media-library/organization-resolver');
  const { mutateLibraryOrganization: mutate } = await import('../frontend/server/media-library/organization');
  const { createLibrarySelectionSnapshot } = await import('../frontend/server/media-library/selection');
  const { listLibraryAssetPage } = await import('../frontend/server/media-library/asset-listing');
  const scope = { view: 'all', kind: 'all', sort: 'recent' } as const;

  for (const kind of ['image', 'video', 'audio'] as const) {
    await t.test(`${kind}: explicit output wrappers and unique job-only mirrors share selection and organization`, async () => {
      const owner = `duplicate-${kind}`, job = `${owner}-job`, output = `${job}:${kind}:0`, url = `https://example.invalid/${owner}`;
      await pg.pool.query('INSERT INTO app_jobs(job_id,user_id,surface) VALUES($1,$2,$3)', [job, owner, kind === 'image' ? 'character-builder' : kind]);
      await pg.pool.query('INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES($1,$2,$3,$4,$5)', [output, job, owner, kind, url]);
      for (const [suffix, outputId] of [['wrapped', `output:${output}`], ['exact', output], ['job-only', null]]) {
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [`${owner}-${suffix}`, `ma_${owner}-${suffix}`, owner, kind, url, kind === 'image' ? 'character' : 'saved_job_output', job, outputId, { originalName: 'same-name', originUrl: url, durationSec: 5 }]);
      }
      await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata) VALUES($1,$2,$3,$4,'generated',$5)`,
        [`${owner}-legacy`, owner, url, `${kind}/${kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'wav'}`, { jobId: job, sourceOutputId: `output:${output}`, durationSec: 5 }]);
      const refs = [
        ...['wrapped', 'exact', 'job-only'].map(suffix => ({ type: 'asset' as const, assetId: `ma_${owner}-${suffix}`, kind })),
        { type: 'legacy' as const, assetId: `${owner}-legacy`, kind },
        { type: 'job-output' as const, jobId: job, outputId: output, kind },
      ];
      const page = await browseLibrary({ userId: owner, scope, limit: 1 });
      assert.equal(page.totalCount, 1, 'one visible media, before pagination');
      assert.equal(page.hasMore, false);
      for (const requested of [...refs.map(ref => [ref]), refs]) {
        const resolved = await resolve(owner, requested);
        assert.ok(resolved.every(row => !row.error && row.key === page.assets[0].organization.key), JSON.stringify(resolved.map(row => ({ error: row.error, key: row.key }))));
      }
      assert.equal((await createLibrarySelectionSnapshot({ userId: owner, scope })).totalCount, 1);
      await mutate({ userId: owner, operation: 'favorite', references: [refs[0]] });
      assert.equal((await browseLibrary({ userId: owner, scope: { ...scope, favorite: true } })).totalCount, 1);
      await pg.pool.query("INSERT INTO library_collections(user_id,id,name) VALUES($1,$2,'Copies')", [owner, `lc_${kind}`]);
      await mutate({ userId: owner, operation: 'add-to-collection', references: [refs[2]], collectionId: `lc_${kind}` });
      assert.equal((await browseLibrary({ userId: owner, scope: { ...scope, collectionId: `lc_${kind}` } })).totalCount, 1);
      await mutate({ userId: owner, operation: 'trash', references: [refs[4]] });
      assert.equal((await browseLibrary({ userId: owner, scope })).totalCount, 0);
      assert.equal((await browseLibrary({ userId: owner, scope: { ...scope, trash: true } })).totalCount, 1);
      await mutate({ userId: owner, operation: 'restore', references: [refs[1]] });
      assert.ok((await resolve(owner, refs)).every(row => row.state?.favorite && row.state.collectionIds.includes(`lc_${kind}`)));
      assert.equal((await pg.pool.query('SELECT count(*) FROM media_assets WHERE user_id=$1 AND deleted_at IS NULL', [owner])).rows[0].count, '3');
    });
  }

  await t.test('ambiguous job-only copies and real output IDs with the prefix remain distinct', async () => {
    const owner = 'ambiguous-duplicates';
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id) VALUES('ambiguous-job','ambiguous-duplicates');
      INSERT INTO job_outputs(id,job_id,user_id,kind,url,position) VALUES
        ('out','ambiguous-job','ambiguous-duplicates','image','https://example.invalid/shared',0),
        ('output:out','ambiguous-job','ambiguous-duplicates','image','https://example.invalid/shared',1);
      INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id) VALUES
        ('real-wrapper','ma_real_wrapper','ambiguous-duplicates','image','https://example.invalid/shared','saved_job_output','ambiguous-job','output:out'),
        ('uncertain','ma_uncertain','ambiguous-duplicates','image','https://example.invalid/shared','saved_job_output','ambiguous-job',NULL)`);
    const page = await browseLibrary({ userId: owner, scope });
    assert.equal(page.totalCount, 3, 'two distinct outputs plus an unproven saved record');
    const refs = [{ type: 'asset', assetId: 'ma_real_wrapper', kind: 'image' }, { type: 'job-output', jobId: 'ambiguous-job', outputId: 'output:out', kind: 'image' }] as const;
    assert.equal((await resolve(owner, [refs[0]]))[0].key, (await resolve(owner, [refs[1]]))[0].key);
    assert.ok((await resolve('another-owner', refs)).every(row => row.error === 'SOURCE_UNAVAILABLE'));
  });

  await t.test('unavailable output siblings still prevent ambiguous legacy mirrors from inheriting an output identity', async () => {
    const owner = 'unavailable-sibling';
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id) VALUES('sibling-job','unavailable-sibling');
      INSERT INTO job_outputs(id,job_id,user_id,kind,url,position,status) VALUES
        ('sibling-ready','sibling-job','unavailable-sibling','video','https://example.invalid/siblings.mp4',0,'ready'),
        ('sibling-pending','sibling-job','unavailable-sibling','video','https://example.invalid/siblings.mp4',1,'pending');
      INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata) VALUES
        ('uncertain-legacy','unavailable-sibling','https://example.invalid/siblings.mp4','video/mp4','generated','{"jobId":"sibling-job"}')`);
    const legacy = { type: 'legacy', assetId: 'uncertain-legacy', kind: 'video' } as const;
    const output = { type: 'job-output', jobId: 'sibling-job', outputId: 'sibling-ready', kind: 'video' } as const;
    const page = await browseLibrary({ userId: owner, scope });
    assert.equal(page.totalCount, 2, 'availability cannot turn ambiguous provenance into proof');
    const [saved, generated] = await resolve(owner, [legacy, output]);
    assert.equal(saved.error, undefined);
    assert.equal(generated.error, undefined);
    assert.notEqual(saved.key, generated.key);
    assert.equal(page.assets.find(asset => asset.id === legacy.assetId)?.organization.key, saved.key);
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id)
      VALUES('sibling-canonical','ma_sibling_canonical','unavailable-sibling','video','https://example.invalid/siblings.mp4','saved_job_output','sibling-job','sibling-ready')`);
    assert.equal((await browseLibrary({ userId: owner, scope })).totalCount, 2, 'a saved sibling cannot prove which output the ambiguous legacy came from');
    assert.equal((await resolve(owner, [legacy]))[0].key, saved.key);
    await mutate({ userId: owner, operation: 'favorite', references: [legacy] });
    assert.equal((await resolve(owner, [output]))[0].state?.favorite, false);
    await pg.pool.query("UPDATE job_outputs SET status='ready' WHERE id='sibling-pending'");
    assert.equal((await browseLibrary({ userId: owner, scope })).totalCount, 3);
    assert.equal((await resolve(owner, [legacy]))[0].key, saved.key, 'becoming available cannot change the independent saved identity');
  });

  await t.test('internal video, audio and Tools preparations stay exact-addressable but leave browse, collections and bulk selection', async () => {
    const owner = 'preparations';
    const publicIds = new Map<string, string>();
    let publicIndex = 1;
    for (const kind of ['image', 'video', 'audio'] as const) {
      const source = { type: 'asset', assetId: `ma_${String(publicIndex).padStart(32, '0')}`, kind };
      const entries = [
        ['original', {}],
        ['tool-input', { creator: { version: 1, source, role: kind, sourceFingerprint: 'fingerprint' } }],
        ['tool-result', { creator: { version: 1, generation: { jobId: 'generated', outputId: 'out' }, sourceAssets: [source] } }],
        ['ordinary-name', { originalName: kind === 'audio' ? 'audio-excerpt.wav' : 'video-excerpt.mp4' }],
        ['malformed', { videoExcerpt: 'user label', audioExcerpt: null, creator: { source: 'not a reference' } }],
        ...(kind === 'image' ? [] : [['excerpt', { [`${kind}Excerpt`]: { version: 3, source, range: { startSec: 0, endSec: 5 }, encoder: 'fixture' } }]]),
      ] as const;
      for (const [suffix, metadata] of entries) {
        const id = `${suffix}-${kind}`;
        const publicId = `ma_${String(publicIndex++).padStart(32, '0')}`;
        publicIds.set(id, publicId);
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,metadata,size_bytes,mime_type) VALUES($1,$2,$3,$4,$5,$6,$7,10,$8)`,
          [id, publicId, owner, kind, `https://cdn.maxvideoai.com/${id}`, kind === 'image' ? 'character' : 'upload', { ...metadata, durationSec: 5 }, `${kind}/${kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'wav'}`]);
      }
      // An old mirror without preparation metadata must not make the same technical copy reappear.
      await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata) VALUES($1,$2,$3,$4,'upload','{}')`,
        [`tool-input-${kind}`, owner, `https://cdn.maxvideoai.com/tool-input-${kind}`, `${kind}/${kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'wav'}`]);
    }
    const page = await browseLibrary({ userId: owner, scope, limit: 100 });
    assert.equal(page.totalCount, 12, 'four meaningful records for each kind');
    assert.ok(page.assets.every(asset => !/^(tool-input|excerpt)-/.test(asset.id)));
    assert.equal((await createLibrarySelectionSnapshot({ userId: owner, scope })).totalCount, 12);
    const compatibility = await listLibraryAssetPage({ userId: owner, limit: 100 }, { ensureSchema: false });
    assert.equal(compatibility.items.length, 12);
    const prepared = { type: 'asset', assetId: publicIds.get('excerpt-video')!, kind: 'video' } as const;
    assert.equal((await resolve(owner, [prepared]))[0].error, undefined);
    const { resolveStudioMedia } = await import('../frontend/src/server/studio/media-resolver');
    assert.equal((await resolveStudioMedia(owner, prepared)).url, 'https://cdn.maxvideoai.com/excerpt-video', 'an existing Studio reference still resolves its exact original');
    await pg.pool.query("INSERT INTO library_collections(user_id,id,name) VALUES($1,'lc_prepared','Prepared')", [owner]);
    await mutate({ userId: owner, operation: 'add-to-collection', references: [prepared], collectionId: 'lc_prepared' });
    assert.equal((await browseLibrary({ userId: owner, scope: { ...scope, collectionId: 'lc_prepared' } })).totalCount, 0);
    assert.ok((await resolve(owner, [prepared]))[0].state?.collectionIds.includes('lc_prepared'), 'organization data is retained');
    assert.equal((await pg.pool.query('SELECT count(*) FROM media_assets WHERE user_id=$1 AND deleted_at IS NULL', [owner])).rows[0].count, '17');
    const { readLibraryStorageUsage } = await import('../frontend/server/media-library/storage-usage');
    assert.deepEqual(await readLibraryStorageUsage(owner), { recordedBytes: 170, measuredFiles: 17, totalFiles: 17, limitBytes: null, enforcement: false, trashedFiles:0,trashedBytes:0,pendingDeletionFiles:0,pendingDeletionBytes:0,failedDeletionFiles:0,sharedDeletionFiles:0,sharedDeletionBytes:0 }, 'hiding preparations does not pretend that their storage was freed');
  });
});
