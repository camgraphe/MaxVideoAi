import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getWorkspaceReferenceSlots, getWorkspaceReferenceSummary } from '../frontend/components/composer/workspace-reference-layout';
import type { AssetFieldConfig, AssetSlotAttachment } from '../frontend/components/AssetDropzone';
const asset: AssetSlotAttachment = { kind: 'image', name: 'reference', size: 1, type: 'image/png', previewUrl: 'blob:local' };
const config = (id: string, required = false, maxCount = 5): AssetFieldConfig => ({ field: { id, label: id, type: 'image', maxCount }, required });

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
test('collapsed inventory bounds collections while preserving required roles and both endpoints', () => {
  const fields = [config('image_url', false, 1), config('end_image_url', false, 1), config('refs'), config('more'), config('required', true)];
  const summary = getWorkspaceReferenceSummary(fields, { refs: Array(5).fill(asset), more: [asset] });
  assert.deepEqual(summary.map(s => [s.entry.field.id, s.visibleCount]), [['image_url', 0], ['end_image_url', 0], ['refs', 3], ['required', 0]]);
  assert.deepEqual(getWorkspaceReferenceSummary([config('refs')], {}), []);
  assert.equal(getWorkspaceReferenceSummary(fields, { refs: Array(5).fill(asset), required: [asset] }).at(-1)?.visibleCount, 1, 'required source stays visible after the summary collection budget is used');
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
  assert.doesNotMatch(manager, /<dialog|aria-modal|showModal/);
  assert.match(manager, /Escape/);
  assert.match(manager, /triggerRef\.current\?\.focus/);
});

test('collapsed endpoint guidance stays in Manage and empty slots expose a compact role target', () => {
  const field = readFileSync('frontend/components/AssetDropzone.tsx', 'utf8');
  assert.match(field, /workspaceShowDetails \? <details/);
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
