import assert from 'node:assert/strict';
import test from 'node:test';

import type { MediaAssetRecord } from '../frontend/server/media-library-records';

function body(...chunks: string[]): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield Buffer.from(chunk);
    },
  };
}

async function remoteDownloader() {
  const module = await import('../frontend/server/media-library/asset-media');
  const download = Reflect.get(module, 'downloadRemoteMediaWithDependencies');
  assert.equal(typeof download, 'function');
  return download as (
    params: { url: string; kind: 'image' | 'video' | 'audio'; maxBytes?: number },
    dependencies: {
      lookup: () => Promise<Array<{ address: string; family: number }>>;
      request: () => Promise<{ status: number; headers: Headers; body: AsyncIterable<Uint8Array> }>;
    }
  ) => Promise<{ data: Buffer }>;
}

test('parsed IPv6 classification rejects mapped private and site-local ranges before request I/O', async () => {
  const download = await remoteDownloader();
  for (const address of [
    '::ffff:7f00:1',
    '::ffff:0a00:1',
    'fec0::1',
    'feff:ffff::1',
    '::1',
    'fe80::1',
    'fc00::1',
    'fdff::1',
  ]) {
    let requests = 0;
    await assert.rejects(() => download({
      url: 'https://provider.example/output.png',
      kind: 'image',
    }, {
      lookup: async () => [{ address, family: 6 }],
      request: async () => {
        requests += 1;
        return { status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: body('image') };
      },
    }), /REMOTE_MEDIA_ADDRESS_NOT_ALLOWED/);
    assert.equal(requests, 0, `${address} must be rejected before request I/O`);
  }

  let publicRequests = 0;
  const result = await download({
    url: 'https://provider.example/output.png',
    kind: 'image',
  }, {
    lookup: async () => [{ address: '2606:4700:4700::1111', family: 6 }],
    request: async () => {
      publicRequests += 1;
      return { status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: body('image') };
    },
  });
  assert.equal(publicRequests, 1);
  assert.equal(result.data.toString(), 'image');
});

type DbRow = {
  id: string;
  user_id: string;
  kind: 'image' | 'video' | 'audio';
  url: string;
  thumb_url: string | null;
  preview_url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  source: string;
  source_job_id: string | null;
  source_output_id: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

const USER = 'user-round4';
const OTHER_USER = 'user-victim';

function mediaRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    id: 'legacy-media-id',
    user_id: USER,
    kind: 'image',
    url: 'https://provider.example/legacy.png',
    thumb_url: null,
    preview_url: null,
    mime_type: 'image/png',
    width: 1024,
    height: 1024,
    size_bytes: 100,
    source: 'saved_job_output',
    source_job_id: 'job-legacy',
    source_output_id: 'output-legacy',
    status: 'ready',
    metadata: {},
    created_at: '2026-07-11T00:00:00.000Z',
    ...overrides,
  };
}

async function reusableAssetBoundary() {
  const module = await import('../frontend/server/media-library/assets');
  const ensure = Reflect.get(module, 'ensureReusableAssetWithDependencies');
  assert.equal(typeof ensure, 'function', 'reusable media needs an injected compatibility boundary');
  return ensure as (
    params: Record<string, unknown>,
    dependencies: {
      query: (sql: string, params?: ReadonlyArray<unknown>) => Promise<DbRow[]>;
      ownedStorageKeyForUrl: (params: { url: string; userId: string }) => string | null;
      resolveThumbUrl: (params: Record<string, unknown>) => Promise<string | null>;
      resolvePreviewUrl: (params: Record<string, unknown>) => Promise<string | null>;
      copyRemote: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
      createRemoteThumbnail: (params: Record<string, unknown>) => Promise<string | null>;
      cleanupStorageUrl: (url: string) => Promise<boolean>;
    }
  ) => Promise<MediaAssetRecord>;
}

function compatibilityDependencies(query: (sql: string, params?: ReadonlyArray<unknown>) => Promise<DbRow[]>) {
  let copies = 0;
  let remoteThumbnails = 0;
  const cleaned: string[] = [];
  return {
    dependencies: {
      query,
      ownedStorageKeyForUrl: () => null,
      resolveThumbUrl: async (params: Record<string, unknown>) => typeof params.thumbUrl === 'string' ? params.thumbUrl : null,
      resolvePreviewUrl: async () => null,
      copyRemote: async () => {
        copies += 1;
        return {
          url: 'https://cdn.maxvideoai.com/media-assets/user-round4/copied.png',
          thumbUrl: null,
          mimeType: 'image/png',
          width: 1024,
          height: 1024,
          sizeBytes: 100,
        };
      },
      createRemoteThumbnail: async () => {
        remoteThumbnails += 1;
        return null;
      },
      cleanupStorageUrl: async (url: string) => {
        cleaned.push(url);
        return true;
      },
    },
    counts: () => ({ copies, remoteThumbnails, cleaned }),
  };
}

test('same-user legacy source-output identity is reused and safely backfilled before copying', async () => {
  const ensure = await reusableAssetBoundary();
  const legacy = mediaRow();
  const calls: Array<{ sql: string; params: ReadonlyArray<unknown> }> = [];
  const setup = compatibilityDependencies(async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('pg_advisory_xact_lock')) return [];
    if (sql.includes('FROM media_assets')) return [legacy];
    if (sql.includes('UPDATE media_assets')) return [{ ...legacy, thumb_url: 'https://cdn.example/thumb.jpg' }];
    throw new Error(`unexpected query: ${sql}`);
  });

  const asset = await ensure({
    userId: USER,
    url: legacy.url,
    kind: 'image',
    source: 'saved_job_output',
    sourceJobId: legacy.source_job_id,
    sourceOutputId: legacy.source_output_id,
    thumbUrl: 'https://cdn.example/thumb.jpg',
    trustedRemoteSource: true,
  }, setup.dependencies);

  assert.equal(asset.id, legacy.id);
  assert.equal(setup.counts().copies, 0);
  const update = calls.find((call) => call.sql.includes('UPDATE media_assets'));
  assert.deepEqual(update?.params.slice(0, 2), [legacy.id, USER]);
});

test('same-user legacy kind/url identity is reused before copying', async () => {
  const ensure = await reusableAssetBoundary();
  const legacy = mediaRow({ source_output_id: null, source_job_id: null, source: 'import' });
  const setup = compatibilityDependencies(async (sql) => {
    if (sql.includes('pg_advisory_xact_lock')) return [];
    if (sql.includes('FROM media_assets')) return [legacy];
    throw new Error(`unexpected query: ${sql}`);
  });
  const asset = await ensure({
    userId: USER,
    url: legacy.url,
    kind: 'image',
    source: 'import',
    trustedRemoteSource: true,
  }, setup.dependencies);
  assert.equal(asset.id, legacy.id);
  assert.equal(setup.counts().copies, 0);
});

test('legacy identity lookup and updates cannot mutate another user row', async () => {
  const ensure = await reusableAssetBoundary();
  const victim = mediaRow({ id: 'victim-legacy-id', user_id: OTHER_USER });
  let victimUpdates = 0;
  const setup = compatibilityDependencies(async (sql, params = []) => {
    if (sql.includes('pg_advisory_xact_lock')) return [];
    if (sql.includes('FROM media_assets')) {
      assert.equal(params[0], USER);
      return [];
    }
    if (sql.includes('UPDATE media_assets')) {
      victimUpdates += 1;
      return [victim];
    }
    if (sql.includes('INSERT INTO media_assets')) {
      return [mediaRow({
        id: String(params[0]),
        user_id: USER,
        url: String(params[3]),
        source_output_id: victim.source_output_id,
      })];
    }
    throw new Error(`unexpected query: ${sql}`);
  });
  const asset = await ensure({
    userId: USER,
    url: victim.url,
    kind: 'image',
    source: 'saved_job_output',
    sourceOutputId: victim.source_output_id,
    trustedRemoteSource: true,
  }, setup.dependencies);
  assert.equal(asset.userId, USER);
  assert.notEqual(asset.id, victim.id);
  assert.equal(victimUpdates, 0);
});

test('a post-copy insert conflict cleans newly uploaded media instead of orphaning it', async () => {
  const ensure = await reusableAssetBoundary();
  const setup = compatibilityDependencies(async (sql) => {
    if (sql.includes('pg_advisory_xact_lock')) return [];
    if (sql.includes('FROM media_assets')) return [];
    if (sql.includes('INSERT INTO media_assets')) throw new Error('unique conflict');
    throw new Error(`unexpected query: ${sql}`);
  });
  await assert.rejects(() => ensure({
    userId: USER,
    url: 'https://provider.example/new.png',
    kind: 'image',
    source: 'saved_job_output',
    sourceOutputId: 'new-output',
    trustedRemoteSource: true,
  }, setup.dependencies), /unique conflict/);
  assert.deepEqual(setup.counts().cleaned, ['https://cdn.maxvideoai.com/media-assets/user-round4/copied.png']);
});

test('a cross-user primary-key conflict with no returned row also cleans copied media', async () => {
  const ensure = await reusableAssetBoundary();
  const setup = compatibilityDependencies(async (sql) => {
    if (sql.includes('pg_advisory_xact_lock')) return [];
    if (sql.includes('FROM media_assets')) return [];
    if (sql.includes('INSERT INTO media_assets')) return [];
    throw new Error(`unexpected query: ${sql}`);
  });
  await assert.rejects(() => ensure({
    userId: USER,
    url: 'https://provider.example/no-row.png',
    kind: 'image',
    source: 'saved_job_output',
    sourceOutputId: 'no-row-output',
    trustedRemoteSource: true,
  }, setup.dependencies), /MEDIA_ASSET_TENANT_CONFLICT/);
  assert.deepEqual(setup.counts().cleaned, ['https://cdn.maxvideoai.com/media-assets/user-round4/copied.png']);
});
