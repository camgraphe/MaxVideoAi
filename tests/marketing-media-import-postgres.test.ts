import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { QueryExecutor } from '../frontend/src/lib/db';
import { promoteMarketingVideo } from '../frontend/server/marketing-media/copy';
import { importMarketingPublication } from '../frontend/server/marketing-media/import-publication';
import { copyMarketingMediaFile } from '../frontend/server/marketing-media/storage';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { allExportedFiles, fixtureVideoId, importFiles, nestedReference, publicationManifest, selectedVideo, stalePreview, staleVideo } from './helpers/marketing-publication-fixture';

test('marketing publication imports are independent, immutable and fenced on PostgreSQL', async (t) => {
  const database = await startDisposablePostgres('marketing-import');
  t.after(() => database.cleanup());
  const query: QueryExecutor['query'] = async (sql, params) => (await database.pool.query(sql, params as unknown[])).rows;
  const transaction = async <T>(run: (db: QueryExecutor) => Promise<T>): Promise<T> => {
    const client = await database.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await run({ query: async (sql, params) => (await client.query(sql, params as unknown[])).rows });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  await query(readFileSync('neon/migrations/78_marketing_media.sql', 'utf8'));
  await query(`
    CREATE FUNCTION deny_personal_write() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Import wrote to a personal or billing table'; END $$;
    DO $$ DECLARE name text; BEGIN
      FOREACH name IN ARRAY ARRAY['app_jobs','job_outputs','media_assets','user_assets','profiles','app_receipts','app_wallets','wallet_transactions'] LOOP
        EXECUTE format('CREATE TABLE %I (id text)',name);
        EXECUTE format('CREATE TRIGGER reject_import_write BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I
          FOR EACH STATEMENT EXECUTE FUNCTION deny_personal_write()',name);
      END LOOP;
    END $$;
  `);
  const copied = new Map<string, Buffer>();
  const reads: string[] = [];
  const copyFile: typeof copyMarketingMediaFile = (file, context) => copyMarketingMediaFile(file, context, {
    open: async (url) => {
      reads.push(url);
      const fixture = allExportedFiles.find(({ entry }) => entry.url === url);
      assert.ok(fixture, 'only declared source files can be downloaded');
      return {
        statusCode: 200,
        headers: { 'content-type': fixture.entry.mime, 'content-length': String(fixture.bytes.length) },
        body: (async function* () { yield fixture.bytes; })(),
      };
    },
    put: async ({ key, data }) => {
      copied.set(key, data);
      return { key, url: `https://target.example.com/${key}` };
    },
    verify: async (url, expected) => {
      const bytes = copied.get(new URL(url).pathname.slice(1));
      return bytes?.length === expected.bytes && bytes.subarray(0, 32).equals(expected.prefix!);
    },
  });
  const deps = { db: { query }, transaction, copyFile };
  const start = (id: string, overrides: Partial<typeof deps> = {}) => importMarketingPublication(
    { manifest: publicationManifest(id), actorId: 'destination-admin', permissionConfirmed: true },
    { ...deps, ...overrides },
  );

  await t.test('import copies the selected source in a fresh namespace and starts private', async () => {
    const result = await start(fixtureVideoId);
    assert.equal(result.videoId, fixtureVideoId);
    assert.equal(result.state, 'ready');
    assert.equal(result.visibility, 'private');
    const [row] = await query<{
      copy_id: string; source_user_id: string | null; copied_by: string; source_record: { source: { url: string } };
      publication: { visibility: string; indexable: boolean; preview_video_url: null; playback_video_url: null; video_url: string };
      recreation_snapshot: { advanced: { extraInputValues: { elements: { frontal_image: string }[] } } };
      files: { key: string; sourceUrl: string }[];
    }>('SELECT * FROM marketing_media WHERE video_id=$1', [fixtureVideoId]);
    assert.equal(row.source_user_id, null);
    assert.equal(row.copied_by, 'destination-admin');
    assert.equal(row.source_record.source.url, `https://preview.example.com/api/examples/${fixtureVideoId}`);
    assert.equal(row.publication.indexable, false);
    assert.equal(row.publication.preview_video_url, null);
    assert.equal(row.publication.playback_video_url, null);
    const targetKey = `marketing-media/${row.copy_id}/${selectedVideo.entry.sha256}.mp4`;
    assert.equal(row.publication.video_url, `https://target.example.com/${targetKey}`);
    assert.equal(row.recreation_snapshot.advanced.extraInputValues.elements[0].frontal_image,
      `https://target.example.com/marketing-media/${row.copy_id}/${nestedReference.entry.sha256}.png`);
    assert.deepEqual(copied.get(targetKey), selectedVideo.bytes);
    assert.deepEqual(new Set(reads), new Set(importFiles.map(({ entry }) => entry.url)));
    assert.ok(!reads.includes(staleVideo.entry.url) && !reads.includes(stalePreview.entry.url));
    assert.ok(row.files.every(({ key, sourceUrl }) => key.startsWith(`marketing-media/${row.copy_id}/`) && !sourceUrl.includes(row.copy_id)));

    const ready = await start(fixtureVideoId, { copyFile: async () => assert.fail('Ready import copied bytes again') });
    assert.equal(ready.videoUrl, result.videoUrl);
  });

  await t.test('a failed import retries the same effective manifest in the same namespace', async () => {
    const id = 'failed-import';
    await assert.rejects(start(id, { copyFile: async (file, context) => {
      if (file.role !== 'original') throw new Error('fixture source unavailable');
      return copyFile(file, context);
    } }), /failed/i);
    const [failed] = await query<{ state: string; copy_id: string; publication: unknown }>('SELECT state,copy_id,publication FROM marketing_media WHERE video_id=$1', [id]);
    assert.equal(failed.state, 'failed');
    assert.deepEqual(failed.publication, {});
    await assert.rejects(
      promoteMarketingVideo({ videoId: id, actorId: 'destination-admin', permissionConfirmed: true }, deps),
      { status: 409 },
    );

    const changed = publicationManifest(id);
    changed.recreationSnapshot.prompt = 'changed prompt';
    changed.publication.prompt = 'changed prompt';
    changed.publication.settings_snapshot = structuredClone(changed.recreationSnapshot);
    await assert.rejects(importMarketingPublication({ manifest: changed, actorId: 'destination-admin', permissionConfirmed: true }, deps), { status: 409 });

    const sameClosure = publicationManifest(id);
    sameClosure.files = sameClosure.files.filter(({ url }) => url !== staleVideo.entry.url).reverse();
    const ready = await importMarketingPublication({ manifest: sameClosure, actorId: 'destination-admin', permissionConfirmed: true }, deps);
    assert.match(ready.videoUrl ?? '', new RegExp(failed.copy_id));
  });

  await t.test('a live lease blocks another caller and an expired attempt cannot finish', async () => {
    const id = 'leased-import';
    let signalStarted!: () => void;
    let unblock!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const pending = new Promise<void>((resolve) => { unblock = resolve; });
    const first = start(id, { copyFile: async (file, context) => {
      signalStarted();
      await pending;
      return copyFile(file, context);
    } });
    try {
      await started;
      await assert.rejects(start(id), { status: 409 });
      await query("UPDATE marketing_media SET lease_until=now()-interval '1 second' WHERE video_id=$1", [id]);
      const current = await start(id);
      assert.equal(current.state, 'ready');
    } finally {
      unblock();
      await assert.rejects(first, { status: 409 });
    }
    const [row] = await query<{ state: string }>('SELECT state FROM marketing_media WHERE video_id=$1', [id]);
    assert.equal(row.state, 'ready');
  });

  await t.test('other ready publications and retired or deleting identities cannot be overwritten', async () => {
    for (const state of ['ready', 'deleting', 'deleted'] as const) {
      const id = 'existing-' + state;
      const existing = { job_id: id, video_url: 'https://other.example.com/original.mp4' };
      await query(`INSERT INTO marketing_media(video_id,copy_id,state,tombstone,source_fingerprint,source_snapshot,source_record,publication,attempt_id,copied_by)
        VALUES($1,gen_random_uuid(),$2,$2='deleted','original-source','{}','{}',$3,gen_random_uuid(),'other-admin')`,
      [id, state, JSON.stringify(existing)]);
      await assert.rejects(start(id, { copyFile: async () => assert.fail('Existing publication was overwritten') }), { status: 409 });
      const [row] = await query<{ state: string; publication: unknown }>('SELECT state,publication FROM marketing_media WHERE video_id=$1', [id]);
      assert.equal(row.state, state);
      assert.deepEqual(row.publication, existing);
    }
  });
});
