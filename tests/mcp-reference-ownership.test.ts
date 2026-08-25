import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';

const referenceAssetsPath = 'frontend/src/server/agent-api/reference-assets.ts';
const referenceAssetsModule = '../frontend/src/server/agent-api/reference-assets';

const principal: AgentPrincipal = {
  userId: 'owner-user',
  clientId: 'claude-client',
  emailVerified: true,
  authMethod: 'oauth',
};
const publicAssetId = 'ma_0123456789abcdef0123456789abcdef';

type ReferenceAssetsModule = {
  resolveOwnedReferenceAsset(
    currentPrincipal: AgentPrincipal,
    assetId: string,
    dependencies: { executor: QueryExecutor },
  ): Promise<{
    assetId: string;
    mediaKind: 'image' | 'video' | 'audio';
    storageUrl: string;
    width: number | null;
    height: number | null;
    mimeType: string;
  }>;
};

type ReferenceRow = {
  id: string;
  public_id: string;
  user_id: string | null;
  kind: string;
  url: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  status: string | null;
  deleted_at: string | null;
  metadata: unknown;
};

async function loadReferenceAssets(): Promise<ReferenceAssetsModule> {
  assert.equal(existsSync(referenceAssetsPath), true, `${referenceAssetsPath} must exist`);
  return import(referenceAssetsModule) as Promise<ReferenceAssetsModule>;
}

function row(overrides: Partial<ReferenceRow> = {}): ReferenceRow {
  return {
    id: 'asset-owned',
    public_id: publicAssetId,
    user_id: principal.userId,
    kind: 'image',
    url: 'https://cdn.maxvideoai.com/users/owner-user/reference.png',
    mime_type: 'image/png',
    width: 1024,
    height: 768,
    status: 'ready',
    deleted_at: null,
    metadata: {},
    ...overrides,
  };
}

function executorWithRows(rows: ReferenceRow[], calls: Array<{ sql: string; params: ReadonlyArray<unknown> }>): QueryExecutor {
  return {
    async query<TRecord>(sql: string, params: ReadonlyArray<unknown> = []) {
      calls.push({ sql, params });
      return rows as TRecord[];
    },
  };
}

test('resolveOwnedReferenceAsset resolves an opaque public alias without exposing the internal media identity', async () => {
  const { resolveOwnedReferenceAsset } = await loadReferenceAssets();
  const calls: Array<{ sql: string; params: ReadonlyArray<unknown> }> = [];
  const resolved = await resolveOwnedReferenceAsset(principal, publicAssetId, {
    executor: executorWithRows([row({ mime_type: 'IMAGE/JPEG; charset=binary' })], calls),
  });

  assert.deepEqual(resolved, {
    assetId: publicAssetId,
    mediaKind: 'image',
    storageUrl: 'https://cdn.maxvideoai.com/users/owner-user/reference.png',
    width: 1024,
    height: 768,
    mimeType: 'image/jpeg',
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.sql ?? '', /FROM\s+media_assets/iu);
  assert.match(calls[0]?.sql ?? '', /public_id\s*=\s*\$1[\s\S]*user_id\s*=\s*\$2/iu);
  assert.deepEqual(calls[0]?.params, ['ma_0123456789abcdef0123456789abcdef', principal.userId]);
  assert.doesNotMatch(resolved.assetId, /asset-owned|owner-user|https?:|url:/u);
  assert.deepEqual(Object.keys(resolved), ['assetId', 'mediaKind', 'storageUrl', 'width', 'height', 'mimeType']);
});

test('resolveOwnedReferenceAsset accepts the exact shared raster MIME set and canonicalizes JPEG aliases', async () => {
  const { resolveOwnedReferenceAsset } = await loadReferenceAssets();
  const supported = [
    ['image/jpeg', 'image/jpeg'],
    ['image/jpg', 'image/jpeg'],
    ['image/pjpeg; charset=binary', 'image/jpeg'],
    ['image/png', 'image/png'],
    ['image/webp', 'image/webp'],
    ['image/gif', 'image/gif'],
    ['image/avif', 'image/avif'],
  ] as const;
  for (const [mimeType, expected] of supported) {
    const resolved = await resolveOwnedReferenceAsset(principal, publicAssetId, {
      executor: executorWithRows([row({ mime_type: mimeType })], []),
    });
    assert.equal(resolved.mimeType, expected);
  }
});

test('resolveOwnedReferenceAsset derives video and audio kinds from exact owned-row MIME policy', async () => {
  const { resolveOwnedReferenceAsset } = await loadReferenceAssets();
  const supported = [
    ['video', 'VIDEO/MP4; charset=binary', 'video/mp4'],
    ['video', 'video/quicktime', 'video/quicktime'],
    ['audio', 'audio/mpeg', 'audio/mpeg'],
    ['audio', 'audio/wav', 'audio/wav'],
    ['audio', 'audio/x-wav', 'audio/wav'],
    ['audio', 'audio/mp4', 'audio/mp4'],
  ] as const;
  for (const [kind, mimeType, canonicalMime] of supported) {
    const resolved = await resolveOwnedReferenceAsset(principal, publicAssetId, {
      executor: executorWithRows([row({
        kind,
        mime_type: mimeType,
        width: kind === 'audio' ? null : 1920,
        height: kind === 'audio' ? null : 1080,
        metadata: { durationSec: 4 },
      })], []),
    });
    assert.equal(resolved.mediaKind, kind);
    assert.equal(resolved.mimeType, canonicalMime);
  }
});

test('missing and another-user asset IDs are publicly indistinguishable', async () => {
  const { resolveOwnedReferenceAsset } = await loadReferenceAssets();
  const failures: Array<{ code: string; message: string }> = [];
  for (const assetId of ['ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'ma_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']) {
    const calls: Array<{ sql: string; params: ReadonlyArray<unknown> }> = [];
    await assert.rejects(
      resolveOwnedReferenceAsset(principal, assetId, {
        executor: executorWithRows([], calls),
      }),
      (error: unknown) => {
        assert.ok(error instanceof AgentApiError);
        failures.push({ code: error.code, message: error.message });
        return true;
      },
    );
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]?.params, [assetId, principal.userId]);
  }
  assert.deepEqual(failures, [
    { code: 'REFERENCE_NOT_FOUND', message: 'Reference media not found.' },
    { code: 'REFERENCE_NOT_FOUND', message: 'Reference media not found.' },
  ]);
});

test('an impossible cross-user row fails closed as forbidden without returning asset details', async () => {
  const { resolveOwnedReferenceAsset } = await loadReferenceAssets();
  await assert.rejects(
    resolveOwnedReferenceAsset(principal, publicAssetId, {
      executor: executorWithRows([row({ user_id: 'other-user' })], []),
    }),
    (error: unknown) => {
      assert.ok(error instanceof AgentApiError);
      assert.equal(error.code, 'REFERENCE_FORBIDDEN');
      assert.equal(error.message, 'Reference media is not available.');
      assert.doesNotMatch(error.message, /asset-owned|other-user|cdn\.maxvideoai/u);
      return true;
    },
  );
});

test('owned rows must be ready, non-deleted supported media on a controlled HTTPS storage host', async () => {
  const { resolveOwnedReferenceAsset } = await loadReferenceAssets();
  const invalidRows = [
    row({ status: 'processing' }),
    row({ status: 'deleted' }),
    row({ deleted_at: '2026-07-17T09:00:00.000Z' }),
    row({ kind: 'video', mime_type: 'video/webm' }),
    row({ kind: 'audio', mime_type: 'audio/ogg' }),
    row({ kind: 'video', mime_type: 'audio/mpeg' }),
    row({ kind: 'audio', mime_type: 'video/mp4' }),
    row({ kind: 'document', mime_type: 'application/pdf' }),
    row({ mime_type: 'image/svg+xml' }),
    row({ mime_type: 'application/octet-stream' }),
    row({ mime_type: null }),
    row({ kind: 'video', mime_type: 'video/mp4', metadata: { durationSec: 86_401 } }),
    row({ url: 'http://cdn.maxvideoai.com/reference.png' }),
    row({ url: 'https://user:secret@cdn.maxvideoai.com/reference.png' }),
    row({ url: 'https://private-provider.example/reference.png' }),
    row({ url: 'https://cdn.maxvideoai.com/' }),
  ];
  for (const invalidRow of invalidRows) {
    await assert.rejects(
      resolveOwnedReferenceAsset(principal, publicAssetId, {
        executor: executorWithRows([invalidRow], []),
      }),
      (error: unknown) => error instanceof AgentApiError
        && error.code === 'REFERENCE_INVALID'
        && !error.message.includes(invalidRow.url),
    );
  }
});

test('invalid identity input is rejected before any ownership query', async () => {
  const { resolveOwnedReferenceAsset } = await loadReferenceAssets();
  let reads = 0;
  const executor: QueryExecutor = {
    async query<TRecord>() {
      reads += 1;
      return [] as TRecord[];
    },
  };
  for (const assetId of ['', ' asset-owned ', 'x'.repeat(513)]) {
    await assert.rejects(
      resolveOwnedReferenceAsset(principal, assetId, { executor }),
      (error: unknown) => error instanceof AgentApiError && error.code === 'REFERENCE_INVALID',
    );
  }
  await assert.rejects(
    resolveOwnedReferenceAsset({ ...principal, userId: '' }, publicAssetId, { executor }),
    (error: unknown) => error instanceof AgentApiError && error.code === 'AUTH_REQUIRED',
  );
  assert.equal(reads, 0);
});
