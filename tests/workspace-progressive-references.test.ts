import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getWorkspaceReferenceSlots } from '../frontend/components/composer/workspace-reference-layout';
import type { AssetSlotAttachment } from '../frontend/components/AssetDropzone';
const asset: AssetSlotAttachment = { kind: 'image', name: 'reference', size: 1, type: 'image/png', previewUrl: 'blob:local' };

test('empty, one, multiple, capacity and required slots grow progressively', () => {
  assert.deepEqual(getWorkspaceReferenceSlots({ assets: [], maxCount: 50 }), [{ asset: null, slotIndex: 0 }]);
  assert.deepEqual(getWorkspaceReferenceSlots({ assets: [asset], maxCount: 3 }).map(s => s.slotIndex), [0, 1]);
  assert.deepEqual(getWorkspaceReferenceSlots({ assets: [asset, asset], maxCount: 3 }).map(s => s.slotIndex), [0, 1, 2]);
  assert.deepEqual(getWorkspaceReferenceSlots({ assets: [asset, asset], maxCount: 2 }).map(s => s.slotIndex), [0, 1]);
  assert.deepEqual(getWorkspaceReferenceSlots({ assets: [], maxCount: 1, minCount: 1 }), [{ asset: null, slotIndex: 0 }]);
});
test('sparse references preserve callback indices and fill the next available index', () => {
  const sparse = Array<AssetSlotAttachment | null>(50).fill(null); sparse[49] = asset;
  assert.deepEqual(getWorkspaceReferenceSlots({ assets: sparse, maxCount: 50 }).map(s => s.slotIndex), [49, 0]);
  assert.deepEqual(getWorkspaceReferenceSlots({ assets: [null, asset, null, asset], maxCount: 4 }).map(s => s.slotIndex), [1, 3, 0]);
  assert.equal(getWorkspaceReferenceSlots({ assets: Array(50).fill(asset), maxCount: 50, limit: 3 }).length, 3);
});
test('workspace media has semantic sibling actions, manual readers and exact source indices', () => {
  const slot = readFileSync('frontend/components/asset-dropzone/WorkspaceAssetSlot.client.tsx', 'utf8');
  assert.doesNotMatch(slot, /role="button"|onClick=\{triggerSelection\}|preload="metadata"/);
  assert.match(slot, /onRemoveSlot\(slotIndex\)/);
  assert.match(slot, /onSelectFileSlot\(slotIndex\)/);
  assert.match(slot, /onOpenLibrarySlot\(slotIndex\)/);
  assert.match(slot, /<audio[\s\S]*preload="none"/);
  assert.match(slot, /asset\.previewUrl/);
  const manager = readFileSync('frontend/components/composer/WorkspaceReferenceSection.client.tsx', 'utf8');
  assert.match(manager, /WorkspaceReferencePopup/);
  assert.match(manager, /flushSync\(\(\) => setActiveCommand\(null\)\)/);
  const popup = readFileSync('frontend/components/composer/WorkspaceReferencePopup.client.tsx', 'utf8');
  assert.match(popup, /useAccessibleModal/);
  assert.match(popup, /aria-modal="true"/);
  assert.match(manager, /triggerRef\.current\?\.focus/);
});

test('focused popup preserves format guidance and compact upload/library targets', () => {
  const field = readFileSync('frontend/components/AssetDropzone.tsx', 'utf8');
  assert.match(field, /<details className="app-reference-guidance"/);
  assert.match(field, /density === 'workspace' && field\.type === 'image' \? formats\.filter/);
  const slot = readFileSync('frontend/components/asset-dropzone/WorkspaceAssetSlot.client.tsx', 'utf8');
  assert.match(slot, /app-reference-add-target/);
  assert.match(slot, /app-reference-library-target/);
  assert.match(slot, /aria-label=\{`\$\{copy\.library\} · \$\{slotLabel\}`\}/);
});

test('workspace Options is a separate entry and stale video quotes are suppressed', () => {
  const composer = readFileSync('frontend/components/Composer.tsx', 'utf8');
  const video = readFileSync('frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx', 'utf8');
  const image = readFileSync('frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface.tsx', 'utf8');
  assert.match(composer, /price == null \|\| isPricing \|\| preflight\?\.ok === false/);
  assert.match(video, /isPricing=\{isPricing\}/);
  assert.match(video, /optionsControl=\{<WorkspaceOptionsButton/);
  assert.match(video, /advancedOpen=\{optionsOpen\}/);
  assert.match(image, /<ImageAdvancedSettings\s+open=\{optionsOpen\}/);
  assert.match(composer, /htmlFor=\{promptId\}/);
  assert.match(composer, /<textarea\s+id=\{promptId\}/);
});
