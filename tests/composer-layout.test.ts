import assert from 'node:assert/strict';
import test from 'node:test';
import { getWorkspaceAssetGridClass } from '../frontend/components/composer/composer-layout';

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
