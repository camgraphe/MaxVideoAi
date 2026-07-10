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
const composerSource = readFileSync('frontend/components/Composer.tsx', 'utf8');
const composerTypesSource = readFileSync('frontend/components/composer/composer-types.ts', 'utf8');
const videoComposerSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx',
  'utf8'
);
const coreSettingsSource = readFileSync('frontend/components/CoreSettingsBar.tsx', 'utf8');
const imageSettingsSource = readFileSync('frontend/components/ImageSettingsBar.tsx', 'utf8');
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

test('video and image composers opt into one responsive workspace density contract', () => {
  assert.match(composerTypesSource, /density\?: 'default' \| 'workspace'/);
  assert.match(videoComposerSource, /<Composer[\s\S]*density="workspace"/);
  assert.match(imageSurfaceSource, /<Composer[\s\S]*density="workspace"/);
  assert.match(videoComposerSource, /<CoreSettingsBar[\s\S]*density="workspace"/);
  assert.match(imageSurfaceSource, /<ImageSettingsBar[\s\S]*density="workspace"/);
  assert.match(coreSettingsSource, /workspaceDensity[\s\S]*flex-nowrap/);
  assert.match(imageSettingsSource, /workspaceDensity[\s\S]*flex-nowrap/);
  assert.match(coreSettingsSource, /portal=\{compact\}/);
  assert.match(imageSettingsSource, /portal=\{compact\}/);
  assert.match(composerSource, /workspaceDensity[\s\S]*overflow-x-auto/);
  assert.match(composerSource, /workspaceDensity[\s\S]*lg:flex-row[\s\S]*lg:flex-nowrap/);
  assert.match(composerSource, /workspaceDensity[\s\S]*w-full lg:w-auto/);
  assert.doesNotMatch(composerSource, /Estimated price|Estimated credits/);
});

test('video composer limits calm upload locks to the winning guest-auth reason', () => {
  assert.match(
    videoComposerSource,
    /disabledPresentation:\s*disabledReason && disabledReason === guestUploadLockedReason\s*\? 'auth-lock'/
  );
});
