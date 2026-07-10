import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const dockPath = path.join(root, 'frontend/components/groups/CompositePreviewDock.tsx');
const headerPath = path.join(root, 'frontend/components/groups/CompositePreviewDockHeader.tsx');
const toolbarPath = path.join(root, 'frontend/components/groups/CompositePreviewDockToolbar.tsx');
const tilePath = path.join(root, 'frontend/components/groups/CompositePreviewDockTile.tsx');
const utilsPath = path.join(root, 'frontend/components/groups/composite-preview-dock-utils.ts');

test('composite preview dock stays a lean route-level orchestrator', () => {
  const dockSource = fs.readFileSync(dockPath, 'utf8');
  const dockLines = dockSource.split(/\r?\n/).length;

  assert.ok(dockLines <= 500, `CompositePreviewDock.tsx should stay under 500 lines, found ${dockLines}`);
  assert.match(dockSource, /import \{ CompositePreviewDockHeader \} from '\.\/CompositePreviewDockHeader';/);
  assert.match(dockSource, /import \{ CompositePreviewDockTile \} from '\.\/CompositePreviewDockTile';/);
  assert.match(dockSource, /import \{ CompositePreviewDockToolbar \} from '\.\/CompositePreviewDockToolbar';/);
  assert.match(dockSource, /from '\.\/composite-preview-dock-utils';/);
  assert.doesNotMatch(dockSource, /function getInlinePreviewUrl/);
  assert.doesNotMatch(dockSource, /function resolveAspectHint/);
  assert.doesNotMatch(dockSource, /const toolbarItems/);
  assert.doesNotMatch(dockSource, /const headerTitle/);
});

test('composite preview dock responsibilities are split into focused helpers', () => {
  const headerSource = fs.readFileSync(headerPath, 'utf8');
  const toolbarSource = fs.readFileSync(toolbarPath, 'utf8');
  const tileSource = fs.readFileSync(tilePath, 'utf8');
  const utilsSource = fs.readFileSync(utilsPath, 'utf8');

  assert.match(headerSource, /export function CompositePreviewDockHeader/);
  assert.match(toolbarSource, /export function CompositePreviewDockToolbar/);
  assert.match(tileSource, /export function CompositePreviewDockTile/);
  assert.match(utilsSource, /export function resolveCompositePreviewSlots/);
  assert.match(utilsSource, /export function resolvePrimaryMediaUrl/);
  assert.match(utilsSource, /export function resolvePreviewItemStatus/);
});

test('video preview tiles contain every aspect without crop or stretch', () => {
  const tileSource = fs.readFileSync(tilePath, 'utf8');

  assert.match(tileSource, /const mediaFitClass = 'object-contain';/);
  assert.doesNotMatch(tileSource, /object-cover|scale-\[1\.02\]/);
  assert.match(tileSource, /aspectRatio: '16 \/ 9'/);
});
