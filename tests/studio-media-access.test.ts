import assert from 'node:assert/strict';
import test from 'node:test';

import { renewStudioProjectMediaAccess } from '../frontend/src/server/studio/media-access';

const owner = '00000000-0000-4000-8000-00000000000a';
const assetA = `ma_${'a'.repeat(32)}`;
const assetB = `ma_${'b'.repeat(32)}`;

test('private Studio playback renews only canonical project members and signs GET without disposition', async () => {
  const signed: Array<{ key: string; options: { expiresInSeconds: number; downloadFilename?: string } }> = [];
  const result = await renewStudioProjectMediaAccess({ userId: owner }, {
    projectId: 'project-1', assetIds: [assetA, assetB, assetA],
  }, {
    withTransaction: async (callback) => callback({
      query: async (sql) => sql.includes('to_regclass') ? [{ ready: true }] : sql.includes('FROM studio_projects') ? [{
        persistence_mode: 'connected',
        workspace_state: { projectAssets: [{ ref: { type: 'asset', assetId: assetA, kind: 'video' } }, { ref: { type: 'asset', assetId: assetB, kind: 'video' } }] },
      }] : [],
    }),
    resolveMedia: async (_userId, ref) => ({
      id: ref.assetId, ref, kind: 'video', url: `https://storage.invalid/${ref.assetId}`,
      thumbUrl: null, previewUrl: null, mime: 'video/mp4', mediaFacts: undefined,
      originalAccess: ref.assetId === assetA ? { type: 'owned-storage', storageKey: `media-assets/${owner}/a.mp4` } : { type: 'external' },
    }),
    createSignedDownloadUrl: async (key, options) => {
      signed.push({ key, options });
      return 'https://private.invalid/a.mp4?signature=exact';
    },
    now: () => new Date('2026-09-08T10:00:00.000Z'),
  });
  assert.deepEqual(signed, [{ key: `media-assets/${owner}/a.mp4`, options: { expiresInSeconds: 300 } }]);
  assert.deepEqual(result, {
    projectId: 'project-1',
    assets: [
      { assetId: assetA, url: 'https://private.invalid/a.mp4?signature=exact', expiresAt: '2026-09-08T10:05:00.000Z' },
      { assetId: assetB, url: `https://storage.invalid/${assetB}`, expiresAt: null },
    ],
  });
});

test('foreign project assets, non-connected projects and malformed access requests are refused', async () => {
  const deps = {
    withTransaction: async <T>(callback: (executor: { query: (sql: string) => Promise<unknown[]> }) => Promise<T>) => callback({
      query: async (sql) => sql.includes('to_regclass') ? [{ ready: true }] : [{ persistence_mode: 'connected', workspace_state: { projectAssets: [] } }],
    }),
  };
  await assert.rejects(
    renewStudioProjectMediaAccess({ userId: owner }, { projectId: 'project-1', assetIds: [assetA] }, deps as never),
    /MEDIA_NOT_AVAILABLE/u,
  );
  await assert.rejects(
    renewStudioProjectMediaAccess({ userId: owner }, { projectId: 'project-1', assetIds: ['not-an-asset'] }, deps as never),
    /Invalid Studio media access input/u,
  );
});

test('a live timeline occurrence remains renewable after its source leaves the project bin', async () => {
  let resolved = false;
  const result = await renewStudioProjectMediaAccess({ userId: owner }, {
    projectId: 'project-1', assetIds: [assetB],
  }, {
    withTransaction: async (callback) => callback({
      query: async (sql) => {
        if (sql.includes('to_regclass')) return [{ ready: true }];
        if (sql.includes('FROM studio_projects')) {
          return [{ persistence_mode: 'connected', workspace_state: { projectAssets: [] } }];
        }
        if (sql.includes('FROM studio_sequences')) {
          return [{ timeline_state: { timelineItems: [{ ref: { type: 'asset', assetId: assetB, kind: 'video' } }] } }];
        }
        return [];
      },
    }),
    resolveMedia: async (_userId, ref) => {
      resolved = true;
      return {
        id: ref.assetId, ref, kind: 'video', url: 'https://storage.invalid/b.mp4',
        thumbUrl: null, previewUrl: null, mime: 'video/mp4', mediaFacts: undefined,
        originalAccess: { type: 'external' },
      };
    },
  } as never);
  assert.equal(resolved, true);
  assert.deepEqual(result.assets, [{ assetId: assetB, url: 'https://storage.invalid/b.mp4', expiresAt: null }]);
});
