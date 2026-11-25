import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { prepareOpenAIImageReferenceContext, prepareOpenAIImageReferences } from '../frontend/src/server/images/openai-image-references';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('Storyboard OpenAI references verify generated originals in the owning job and inspect their stored bytes', async (t) => {
  const { pool, cleanup } = await startDisposablePostgres('sb-openai-ref');
  t.after(cleanup);
  await pool.query(`
    CREATE TABLE user_assets (user_id text, url text, mime_type text, size_bytes bigint, width integer, height integer);
    CREATE TABLE media_assets (user_id text, url text, mime_type text, size_bytes bigint, width integer, height integer,
      kind text, status text, deleted_at timestamptz);
    CREATE TABLE app_jobs (job_id text PRIMARY KEY, user_id text, surface text, status text, hidden boolean, render_ids jsonb);
    CREATE TABLE job_outputs (job_id text, user_id text, url text, storage_url text, kind text, status text, position integer);
  `);
  const base = 'https://storage.example.test';
  const board = `${base}/renders/images/owner/board.png`;
  const upload = `${base}/user-assets/owner/upload.webp`;
  const savedBoard = `${base}/renders/images/owner/legacy-saved.png`;
  const foreign = `${base}/renders/images/owner/wrong-owner.png`;
  const hidden = `${base}/renders/images/owner/hidden.png`;
  const deleted = `${base}/renders/images/owner/deleted.png`;
  const legacy = `${base}/renders/images/owner/projection-late.png`;
  const olderLegacy = `${base}/renders/images/owner/historical-render.png`;
  const differentBoard = `${base}/renders/images/owner/different-board.png`;
  await pool.query(`INSERT INTO user_assets VALUES ('owner',$1,'image/webp',1234,1024,768)`, [upload]);
  await pool.query(`INSERT INTO media_assets VALUES ('owner',$1,'image/png',NULL,NULL,NULL,'image','ready',NULL)`, [savedBoard]);
  await pool.query(`INSERT INTO app_jobs VALUES
    ('storyboard_parent','owner','storyboard','completed',FALSE,$1),
    ('storyboard_foreign','foreign','storyboard','completed',FALSE,NULL),
    ('storyboard_hidden','owner','storyboard','completed',TRUE,NULL),
    ('storyboard_deleted','owner','storyboard','completed',FALSE,$2),
    ('storyboard_legacy','owner','storyboard','completed',FALSE,$3),
    ('storyboard_older_legacy','owner','storyboard','completed',FALSE,$4),
    ('storyboard_different','owner','storyboard','completed',FALSE,NULL),
    ('storyboard_pending','owner','storyboard','running',FALSE,NULL)`, [
    JSON.stringify([{ url: board }]), JSON.stringify([{ url: deleted }]), JSON.stringify([legacy]), JSON.stringify(JSON.stringify([{ url: olderLegacy }])),
  ]);
  await pool.query(`INSERT INTO job_outputs VALUES
    ('storyboard_parent','owner','https://external.example.test/provider-original',$1,'image','ready',0),
    ('storyboard_foreign','owner',$2,NULL,'image','ready',0),
    ('storyboard_hidden','owner',$3,NULL,'image','ready',0),
    ('storyboard_deleted','owner',$4,NULL,'image','deleted',0),
    ('storyboard_different','owner',$5,NULL,'image','ready',0),
    ('storyboard_pending','owner',$6,NULL,'image','ready',0)`, [board, foreign, hidden, deleted, differentBoard, `${base}/renders/images/owner/pending.png`]);

  const png = await readFile('frontend/public/storyboard/templates/storyboard-template-6.png');
  let originalBytes = png;
  const reads: string[] = [];
  const signed: string[] = [];
  const deps = {
    queryFn: async <T>(sql: string, params?: readonly unknown[]) => (await pool.query(sql, [...(params ?? [])])).rows as T[],
    ownedKeyFn: ({ url, userId }: { url: string; userId: string }) =>
      url.startsWith(`${base}/`) && new URL(url).pathname.includes(`/${userId}/`) ? new URL(url).pathname.slice(1) : null,
    readOriginalFn: async (key: string, limits?: { maxBytes?: number; signal?: AbortSignal }) => {
      reads.push(key);
      assert.equal(limits?.maxBytes, 25 * 1024 * 1024);
      assert.equal(limits?.signal?.aborted, false);
      return key === 'user-assets/owner/upload.webp' ? png : originalBytes;
    },
    signFn: async (key: string) => {
      signed.push(key);
      return `https://signed.example.test/${key}`;
    },
  };
  type Storyboard = NonNullable<Parameters<typeof prepareOpenAIImageReferences>[0]['storyboard']>;
  const prepare = (urls: string[], storyboard?: Storyboard) => prepareOpenAIImageReferences({ userId: 'owner', urls, storyboard }, deps);
  const invalid = { code: 'OPENAI_IMAGE_REFERENCE_INVALID', status: 400 };

  await t.test('keeps template, uploads and unsaved generated originals in submission order', async () => {
    const template = 'https://maxvideoai.com/storyboard/templates/storyboard-template-6.png';
    assert.deepEqual(await prepare([template, upload, board], { role: 'board' }), [
      template, 'https://signed.example.test/user-assets/owner/upload.webp', 'https://signed.example.test/renders/images/owner/board.png',
    ]);
    assert.deepEqual(reads.splice(0).sort(), ['renders/images/owner/board.png', 'user-assets/owner/upload.webp']);
    assert.deepEqual(signed.splice(0), ['user-assets/owner/upload.webp', 'renders/images/owner/board.png']);
    await assert.rejects(prepare([board]), invalid);
  });

  await t.test('edits an older saved board with incomplete durable metadata without requiring another save', async () => {
    const prepared = await prepareOpenAIImageReferenceContext({ userId: 'owner', urls: [savedBoard], storyboard: { role: 'edit' } }, deps);
    assert.deepEqual(prepared.preparedReferenceUrls, ['https://signed.example.test/renders/images/owner/legacy-saved.png']);
    assert.deepEqual(prepared.storedAssetInfoByUrl.get(savedBoard), { mime: 'image/png', width: 1600, height: 1000 });
    assert.deepEqual(reads.splice(0), ['renders/images/owner/legacy-saved.png']);
    signed.length = 0;
  });

  await t.test('uses the ready included parent original or the exact committed render while its projection is absent', async () => {
    assert.deepEqual(await prepare([board], { role: 'kling_first_frame', parentJobId: 'storyboard_parent' }), [
      'https://signed.example.test/renders/images/owner/board.png',
    ]);
    assert.deepEqual(await prepare([legacy], { role: 'kling_first_frame', parentJobId: 'storyboard_legacy' }), [
      'https://signed.example.test/renders/images/owner/projection-late.png',
    ]);
    reads.length = 0;
    signed.length = 0;
  });

  await t.test('edits an older committed board when its original survived without a library or output row', async () => {
    assert.deepEqual(await prepare([olderLegacy], { role: 'edit' }), [
      'https://signed.example.test/renders/images/owner/historical-render.png',
    ]);
    assert.deepEqual(reads.splice(0), ['renders/images/owner/historical-render.png']);
    signed.length = 0;
  });

  await t.test('denies foreign, hidden, pending and deleted projections before reading storage', async () => {
    for (const url of [foreign, hidden, deleted, `${base}/renders/images/owner/pending.png`]) {
      await assert.rejects(prepare([url], { role: 'edit' }), invalid);
    }
    for (const [url, parentJobId] of [[differentBoard, 'storyboard_parent'], [upload, 'storyboard_parent'], [deleted, 'storyboard_deleted']]) {
      await assert.rejects(prepare([url], { role: 'kling_first_frame', parentJobId }), invalid);
    }
    assert.deepEqual(reads, []);
    assert.deepEqual(signed, []);
  });

  await t.test('rejects malformed, unsupported and oversized generated bytes before signing any reference', async () => {
    const svg = Buffer.from('<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"/>');
    for (const bytes of [Buffer.from('not a raster'), svg, Buffer.concat([png, Buffer.alloc(25 * 1024 * 1024)])]) {
      originalBytes = bytes;
      await assert.rejects(prepare([upload, board], { role: 'board' }), invalid);
    }
    assert.equal(reads.filter(key => key === 'renders/images/owner/board.png').length, 3);
    assert.deepEqual(signed, []);
  });

  await t.test('complete legacy asset metadata cannot override the format or size of the original', async () => {
    await pool.query(`UPDATE media_assets SET mime_type = 'image/png', size_bytes = 1234, width = 100, height = 100 WHERE url = $1`, [savedBoard]);
    originalBytes = Buffer.from('<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"/>');
    await assert.rejects(prepare([savedBoard], { role: 'edit' }), invalid);
    assert.deepEqual(signed, []);
  });
});
