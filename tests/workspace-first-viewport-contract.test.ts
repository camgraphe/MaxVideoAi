import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const videoPreviewSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/_components/WorkspacePreviewDock.tsx',
  'utf8'
);
const imageSurfaceSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface.tsx',
  'utf8'
);
const appClientSource = readFileSync('frontend/app/(core)/(workspace)/app/AppClient.tsx', 'utf8');
const imageWorkspaceSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/image/ImageWorkspace.tsx',
  'utf8'
);

test('route-local surfaces opt into compact workspace engine controls', () => {
  assert.match(videoPreviewSource, /controlPresentation="workspace"/);
  assert.match(imageSurfaceSource, /controlPresentation="workspace"/);
  assert.doesNotMatch(appClientSource, /controlPresentation/);
  assert.doesNotMatch(imageWorkspaceSource, /<EngineSelect\b/);
});
