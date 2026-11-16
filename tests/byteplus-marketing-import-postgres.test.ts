import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { withDbTransaction, type QueryExecutor } from '../frontend/src/lib/db';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { byteplusFixture, digest, ownerId } from './helpers/byteplus-marketing-fixture';

test('BytePlus marketing adoption is private, idempotent and never writes personal jobs or billing', async (t) => {
  process.env.S3_PUBLIC_BASE_URL = 'https://media.maxvideoai.com';
  const { verifyBytePlusMarketingImport, importBytePlusMarketingVideo } = await import('../frontend/server/marketing-media/byteplus/import');
  const database = await startDisposablePostgres('byteplus-marketing');
  t.after(() => database.cleanup());
  const query: QueryExecutor['query'] = async (sql, params) => (await database.pool.query(sql, params as unknown[])).rows;
  const transaction = <T>(run: (db: QueryExecutor) => Promise<T>) => withDbTransaction(run, { pool: database.pool });
  await query(readFileSync('neon/migrations/78_marketing_media.sql', 'utf8'));
  await query(`CREATE TABLE user_roles(user_id text,role text); CREATE TABLE app_admins(user_id text);
    CREATE TABLE media_assets(public_id text PRIMARY KEY,user_id text,kind text,url text,thumb_url text,
      mime_type text,size_bytes bigint,status text,deleted_at timestamptz);
    CREATE FUNCTION deny_personal_write() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Personal or billing write forbidden'; END $$;
    DO $$ DECLARE name text; BEGIN
      FOREACH name IN ARRAY ARRAY['app_jobs','job_outputs','app_receipts','app_wallets','provider_attempts'] LOOP
        EXECUTE format('CREATE TABLE %I (id text)',name);
        EXECUTE format('CREATE TRIGGER reject_import_write BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I
          FOR EACH STATEMENT EXECUTE FUNCTION deny_personal_write()',name);
      END LOOP;
    END $$;`);
  await query("INSERT INTO user_roles VALUES($1,'admin')", [ownerId]);
  const originalUrl = `https://media.maxvideoai.com/media-assets/${ownerId}/fixture.mp4`;
  const posterUrl = `https://media.maxvideoai.com/media-assets/${ownerId}/poster.webp`;
  await query("INSERT INTO media_assets VALUES('ma_video',$1,'video',$2,$3,'video/mp4',16,'ready',NULL)", [ownerId, originalUrl, posterUrl]);
  const input = byteplusFixture();
  const dependencies = {
    db: { query }, actorId: ownerId,
    verifyMedia: async () => ({
      files: [
        { url: originalUrl, sha256: digest('fixture-original'), sizeBytes: 16, mime: 'video/mp4' },
        { url: posterUrl, sha256: digest('poster'), sizeBytes: 6, mime: 'image/webp' },
      ],
      video: { width: 1280, height: 720, hasAudio: true, mediaFacts: {
        source: 'probe' as const, version: 1 as const, probe: 'ffprobe' as const,
        original: { url: originalUrl, sha256: digest('fixture-original'), sizeBytes: 16 },
        durationSec: 8.064, videoDurationSec: 8.041667, audioDurationSec: 8.064, containerDurationSec: 8.064,
      } },
    }),
  };
  const copyFile: typeof import('../frontend/server/marketing-media/storage').copyMarketingMediaFile = async (file, context) => {
    const expected = context.expected!;
    assert.equal(context.ownerId, ownerId);
    const key = `marketing-media/${context.copyId}/${expected.sha256}.${file.kind === 'image' ? 'webp' : 'mp4'}`;
    return { ...expected, key, url: 'https://media.example.com/' + key, sourceUrl: file.sourceUrl };
  };
  const verified = await verifyBytePlusMarketingImport(input, dependencies);
  const apply = (plan = verified, extra = {}) => importBytePlusMarketingVideo(plan, {
    actorId: ownerId, permissionConfirmed: true, approvedPlanSha256: plan.fingerprint, ...extra,
  }, { transaction, copyFile });
  await t.test('rejects forged verification and unapproved plan before copying', async () => {
    await assert.rejects(() => apply({ ...verified }), /VERIFIED/);
    await assert.rejects(() => apply(verified, { approvedPlanSha256: 'f'.repeat(64) }), /APPROVAL/);
    await assert.rejects(() => apply(verified, { permissionConfirmed: false }), /permission/i);
  });
  await t.test('only marketing state exists and public data contains no provider/account/cost bindings', async () => {
    const result = await apply();
    assert.equal(result.state, 'ready'); assert.equal(result.visibility, 'private');
    assert.equal(result.sourceKind, 'byteplus'); assert.match(result.videoId, /^mbp_[a-f0-9]{64}$/);
    const [row] = await query<any>('SELECT * FROM marketing_media');
    assert.equal(row.publication.indexable, false);
    assert.equal(row.publication.user_id, null);
    assert.equal(row.publication.duration_sec, 8);
    assert.equal(row.recreation_snapshot.core.durationSec, 8);
    assert.equal(row.source_record.provider, 'byteplus_modelark');
    assert.equal(row.source_record.providerTaskId, input.providerTaskId);
    assert.equal(row.source_record.measurements.video.mediaFacts.videoDurationSec, 8.041667);
    const publicData = JSON.stringify([row.publication,row.recreation_snapshot]);
    for (const forbidden of [ownerId,input.providerTaskId,'actualListCostUsd','receipt','final_price_cents','ma_video'])
      assert.ok(!publicData.includes(forbidden), forbidden);
    assert.match(row.publication.video_url, /\/marketing-media\//);
    assert.equal((await apply()).videoId, result.videoId);
    assert.equal((await query('SELECT * FROM marketing_media')).length, 1);
  });
  await t.test('revoked ownership/admin, changed evidence and tombstones cannot be bypassed', async () => {
    await query("UPDATE media_assets SET status='deleted'");
    await assert.rejects(() => apply(), /ASSET/);
    await query("UPDATE media_assets SET status='ready'");
    await query("UPDATE user_roles SET role='user'");
    await assert.rejects(() => apply(), /ADMIN/);
    await query("UPDATE user_roles SET role='admin'");
    const changed = structuredClone(input);
    changed.poster.sha256 = 'f'.repeat(64);
    const conflicting = await verifyBytePlusMarketingImport(changed, dependencies);
    await assert.rejects(() => apply(conflicting), /different publication/);
    await query("UPDATE media_assets SET size_bytes=17");
    await assert.rejects(() => apply(), /ASSET_CHANGED/);
    await query("UPDATE media_assets SET size_bytes=16");
    await query("UPDATE marketing_media SET state='deleted',tombstone=true");
    await assert.rejects(() => apply(), /retired|removed/);
  });
  await t.test('a source change during copy prevents completion; matching failed imports can resume', async () => {
    await query('DELETE FROM marketing_media');
    let once = false;
    await assert.rejects(() => importBytePlusMarketingVideo(verified, {
      actorId: ownerId, permissionConfirmed: true, approvedPlanSha256: verified.fingerprint,
    }, { transaction, copyFile: async (file, context) => {
      const result = await copyFile(file, context);
      if (!once) { once = true; await query("UPDATE media_assets SET status='deleted'"); }
      return result;
    } }), /copy failed/i);
    const [failed] = await query<{ state: string; publication: Record<string, unknown> }>('SELECT state,publication FROM marketing_media');
    assert.equal(failed.state, 'failed'); assert.deepEqual(failed.publication, {});
    await query("UPDATE media_assets SET status='ready'");
    assert.equal((await apply()).state, 'ready');
  });
});
