import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getWorkspaceAssetFieldRank,
  getWorkspaceAssetGridClass,
} from '../frontend/components/composer/composer-layout';

test('workspace asset grids scale from one to four columns', () => {
  assert.equal(getWorkspaceAssetGridClass(1), 'grid grid-cols-1 gap-3');
  assert.equal(
    getWorkspaceAssetGridClass(2),
    'grid grid-cols-1 gap-3 md:grid-cols-2',
  );
  assert.equal(
    getWorkspaceAssetGridClass(3),
    'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3',
  );
  assert.equal(
    getWorkspaceAssetGridClass(4),
    'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  );
  assert.equal(
    getWorkspaceAssetGridClass(6),
    'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  );
});

test('Seedance keeps start, end, then source video without changing other engine families', () => {
  assert.equal(getWorkspaceAssetFieldRank('seedance-2-0', 'image_url'), 0);
  assert.equal(getWorkspaceAssetFieldRank('seedance-2-0', 'end_image_url'), 1);
  assert.equal(getWorkspaceAssetFieldRank('seedance-2-0', 'video_url'), 2);
  assert.equal(getWorkspaceAssetFieldRank('seedance-2-0', 'image_urls'), 3);
  assert.equal(getWorkspaceAssetFieldRank('lumaRay2', 'video_url'), 0);
  assert.equal(getWorkspaceAssetFieldRank('kling-3-pro', 'unknown_field'), 99);
});
