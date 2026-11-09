import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createFixtures } from './fixtures';
import { explicitSelection, TARGETS } from './media-state';

test('10,000 synthetic records have stable unique refs across dataset sizes', () => {
  const small = createFixtures(1000);
  const large = createFixtures(10000);
  assert.equal(large.length, 10000);
  assert.equal(new Set(large.map(item => item.id)).size, 10000);
  assert.deepEqual(small.map(item => item.ref), large.slice(0, 1000).map(item => item.ref));
  assert.ok(large.every(item => /^ma_[0-9a-f]{32}$/.test(item.id) && item.ref.assetId === item.id && item.ref.kind === item.kind));
});

test('mixed fixture facts point to real bounded local media and distinct preview/original roles', () => {
  const items = createFixtures(20);
  assert.deepEqual(items.slice(0, 5).map(item => item.kind), ['image', 'image', 'video', 'audio', 'image']);
  assert.equal(items[0].width / items[0].height, 16 / 9);
  assert.equal(items[1].width / items[1].height, 9 / 16);
  assert.ok(items.some(item => item.kind === 'video' && item.width / item.height === 9 / 16));
  for (const item of items) {
    assert.notEqual(item.previewUrl, item.originalUrl);
    for (const url of [item.originalUrl, item.previewUrl, item.thumbUrl]) {
      assert.ok(url?.startsWith('/fixtures/'));
      const path = resolve('public', url!.slice(1));
      assert.ok(existsSync(path), path);
      if (url === item.originalUrl) assert.equal(statSync(path).size, item.size);
    }
  }
});

test('explicit selection remains keyed by identity when preview transports change', () => {
  const items = createFixtures(20);
  const keys = new Set([items[0].id, items[1].id]);
  const renewed = items.map(item => ({ ...item, previewUrl: `${item.previewUrl}?simulation=renewed` }));
  assert.deepEqual(explicitSelection(keys, renewed), keys);
  assert.equal(explicitSelection('all', renewed).size, 20);
});

test('mixed-media tools keep visual/audio roles separate and single-source tools bounded', () => {
  const lip = TARGETS.find(target => target.id === 'lip-sync')!;
  assert.deepEqual(lip.roles.map(role => [role.role, role.kinds, role.max]), [['source', ['image', 'video'], 1], ['audio', ['audio'], 1]]);
  const motion = TARGETS.find(target => target.id === 'motion-transfer')!;
  assert.deepEqual(motion.roles.map(role => role.kinds), [['image'], ['video']]);
  assert.equal(TARGETS.find(target => target.id === 'upscale')!.roles[0].max, 1);
});
