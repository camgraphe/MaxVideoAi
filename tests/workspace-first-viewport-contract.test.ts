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
const videoShellSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppShell.tsx',
  'utf8'
);
const workspaceChromeSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceChrome.tsx',
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
const assetDropzoneSource = readFileSync('frontend/components/AssetDropzone.tsx', 'utf8');
const assetDropzoneSlotSource = readFileSync('frontend/components/asset-dropzone/AssetDropzoneSlot.tsx', 'utf8');
const compositePreviewSource = readFileSync(
  'frontend/components/groups/CompositePreviewDock.tsx',
  'utf8'
);
const compositePreviewHeaderSource = readFileSync(
  'frontend/components/groups/CompositePreviewDockHeader.tsx',
  'utf8'
);
const imageCompositePreviewSource = readFileSync(
  'frontend/components/groups/ImageCompositePreviewDock.tsx',
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

test('workspace mobile settings keep legible intrinsic controls inside the local scroller', () => {
  assert.match(coreSettingsSource, /compact \? 'min-w-\[112px\] flex-none sm:min-w-0'/);
  assert.match(imageSettingsSource, /compact \? 'min-w-\[112px\] flex-none sm:min-w-0'/);
  assert.match(coreSettingsSource, /compact \? 'h-9 !min-w-\[112px\] gap-2 px-2\.5 text-\[11px\]/);
  assert.match(imageSettingsSource, /compact \? 'h-9 !min-w-\[112px\] gap-2 px-2\.5 text-\[11px\]/);
  assert.doesNotMatch(coreSettingsSource, /compact \? 'min-w-0 flex-1/);
  assert.doesNotMatch(imageSettingsSource, /compact \? 'min-w-0 flex-1/);
  assert.match(composerSource, /overflow-x-auto[\s\S]*\[scrollbar-width:none\][\s\S]*\[&::-webkit-scrollbar\]:hidden/);
});

test('workspace solo assets stretch while workspace-only vertical density exposes advanced controls', () => {
  assert.match(assetDropzoneSource, /density\?: 'default' \| 'compact' \| 'workspace'/);
  assert.match(assetDropzoneSource, /const workspaceDensity = density === 'workspace'/);
  assert.match(assetDropzoneSource, /const shouldLimitSoloWidth = isSoloField && displaySlots\.length === 1 && !workspaceDensity/);
  assert.match(composerSource, /density=\{workspaceDensity \? 'workspace' : 'default'\}/);
  assert.match(composerSource, /workspaceDensity \? 'space-y-2' : 'space-y-4'/);
  assert.match(composerSource, /compactPrompt \? 'h-10 min-h-0[\s\S]*sm:h-12/);
  assert.match(composerSource, /workspaceDensity \? 'h-9' : 'h-11'/);
  assert.match(composerSource, /workspaceDensity \? 'space-y-2 border-t[\s\S]*pt-2/);
  assert.match(composerSource, /workspaceDensity \? 'flex-nowrap gap-2 pb-1 pt-2'/);
  assert.match(composerSource, /workspaceDensity \? 'px-0 py-1' : 'px-4 py-3'/);
  assert.match(assetDropzoneSource, /workspaceDensity=\{workspaceDensity\}/);
  assert.match(assetDropzoneSlotSource, /'min-h-\[42px\] rounded-\[12px\] border-0 bg-transparent'/);
  assert.match(assetDropzoneSlotSource, /workspaceDensity && isLockedEmptySlot[\s\S]*'h-10 w-10'/);
  assert.match(assetDropzoneSlotSource, /workspaceDensity && isLockedEmptySlot \? 'gap-2'/);
});

test('workspace preview and image prompt density stay opt-in without changing shared defaults', () => {
  assert.match(videoPreviewSource, /<CompositePreviewDock[\s\S]*density="workspace"/);
  assert.match(imageSurfaceSource, /<ImageCompositePreviewDock[\s\S]*density="workspace"/);
  assert.match(imageSurfaceSource, /<Composer[\s\S]*compactPrompt/);
  assert.match(composerTypesSource, /compactPrompt\?: boolean/);
  assert.match(composerSource, /hidden=\{workspaceDensity && !visibleModeToggles/);
  assert.match(composerSource, /rows=\{compactPrompt \? 2 : workspaceDensity \? 5 : 6\}/);
  assert.match(composerSource, /min-h-\[88px\][\s\S]*sm:h-10 sm:min-h-0/);
  assert.match(composerSource, /sm:h-10 sm:min-h-0/);
  assert.match(composerSource, /density=\{workspaceDensity \? 'workspace' : 'default'\}/);
  assert.match(composerSource, /workspaceDensity \? 'px-0 py-1' : 'px-4 py-3'/);
  assert.match(composerSource, /lg:h-10 lg:py-0/);
  assert.match(compositePreviewSource, /density\?: 'default' \| 'workspace'/);
  assert.match(compositePreviewSource, /workspaceDensity \? 'px-0 py-0' : 'px-4 py-4'/);
  assert.match(compositePreviewSource, /workspaceDensity \? 'mt-1' : 'mt-3'/);
  assert.match(compositePreviewSource, /workspaceDensity \? 'px-3 py-0' : 'px-3 py-2'/);
  assert.match(compositePreviewSource, /window\.innerWidth < 640 \? 0\.25 : 0\.32/);
  assert.match(
    compositePreviewSource,
    /const workspaceHeightBudget = Math\.max\(1, Math\.min\(viewportHeight \* workspaceHeightRatio, 340\) - 12\)/
  );
  assert.match(
    compositePreviewSource,
    /Math\.min\(availableWidth, maxWidth, \(workspaceHeightBudget \* 16\) \/ 9\)/
  );
  assert.match(
    compositePreviewSource,
    /const heightPx = workspaceDensity \? '' : `\$\{Math\.round\(\(width \* 9\) \/ 16\)\}px`/
  );
  assert.doesNotMatch(
    compositePreviewSource,
    /const height = workspaceDensity[\s\S]{0,180}viewportHeight \* workspaceHeightRatio/
  );
  assert.match(compositePreviewHeaderSource, /density\?: 'default' \| 'workspace'/);
  assert.match(compositePreviewHeaderSource, /density === 'workspace' \? 'py-1' : 'py-3'/);
  assert.match(imageCompositePreviewSource, /density\?: 'default' \| 'workspace'/);
  assert.match(imageCompositePreviewSource, /workspaceDensity \? 'px-0 py-0' : 'px-4 py-4'/);
  assert.match(imageCompositePreviewSource, /workspaceDensity \? 'mt-0' : 'mt-3'/);
  assert.match(imageCompositePreviewSource, /workspaceDensity \? 'px-3 py-0' : 'px-3 py-2'/);
  assert.match(
    imageCompositePreviewSource,
    /workspaceDensity \? 'max-h-\[220px\] sm:max-h-\[330px\]' : 'max-h-\[320px\] sm:max-h-\[420px\]'/
  );
  assert.match(imageSurfaceSource, /<div className="flex flex-col gap-1">/);
});

test('video composer limits calm upload locks to the winning guest-auth reason', () => {
  assert.match(
    videoComposerSource,
    /disabledPresentation:\s*disabledReason && disabledReason === guestUploadLockedReason\s*\? 'auth-lock'/
  );
});

test('workspace density never changes route order by authentication state', () => {
  assert.ok(videoShellSource.indexOf('<WorkspacePreviewDock') < videoShellSource.indexOf('{composerSurface}'));
  assert.ok(imageSurfaceSource.indexOf('<ImageCompositePreviewDock') < imageSurfaceSource.indexOf('<form'));
  assert.doesNotMatch(videoShellSource, /authStatus|session|user/);
  assert.doesNotMatch(imageSurfaceSource, /authStatus/);
  assert.match(workspaceChromeSource, /p-4 lg:px-7 lg:py-2/);
});
