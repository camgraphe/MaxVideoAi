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
const workspacePreviewColumnSource = readFileSync(
  'frontend/components/groups/WorkspacePreviewColumn.tsx',
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
const appExperienceStyles = readFileSync('frontend/src/styles/app-experience.css', 'utf8');

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
  assert.match(coreSettingsSource, /workspaceDensity[\s\S]*w-full flex-wrap/);
  assert.match(imageSettingsSource, /workspaceDensity[\s\S]*w-full flex-wrap/);
  assert.match(coreSettingsSource, /portal=\{compact\}/);
  assert.match(imageSettingsSource, /portal=\{compact\}/);
  assert.match(composerSource, /workspaceDensity && 'app-composer-settings-inline'/);
  assert.match(composerSource, /workspaceDensity[\s\S]*app-composer-toolbar-layout flex gap-3/);
  assert.match(composerSource, /\{settingsBar\}[\s\S]*workspaceDensity \? optionsControl/, 'Options participates in the settings group');
  assert.match(composerSource, /workspaceDensity \? 'app-composer-submit' : 'lg:items-end'/);
  assert.match(videoComposerSource, /optionsControl=\{showOptionsControl \? <WorkspaceOptionsButton[\s\S]*<CoreSettingsBar/);
  assert.match(imageSurfaceSource, /optionsControl=[\s\S]*<ImageSettingsBar/);
  assert.doesNotMatch(composerSource, /Estimated price|Estimated credits/);
});

test('workspace quantity controls stay with settings while generate owns the right edge', () => {
  assert.match(composerTypesSource, /generateControl\?: ReactNode/);
  assert.match(composerSource, /\{settingsBar\}[\s\S]*workspaceDensity \? optionsControl[\s\S]*workspaceDensity \? generateControl/);
  assert.match(composerSource, /app-generation-controls[\s\S]*!workspaceDensity \? generateControl[\s\S]*<Button/);
  assert.match(videoComposerSource, /generateControl=\{[\s\S]*<CoreIterationsControl[\s\S]*iterations=\{form\.iterations\}/);
  assert.match(imageSurfaceSource, /generateControl=\{[\s\S]*<ImageCountControl[\s\S]*value=\{numImages\}/);
  assert.match(coreSettingsSource, /action\s*\?\s*'h-11[\s\S]*!bg-\[image:var\(--brand-gradient\)\]/);
  assert.match(imageSettingsSource, /action\s*\?\s*'h-11[\s\S]*!bg-\[image:var\(--brand-gradient\)\]/);
});

test('workspace toolbars wrap settings naturally and keep generation aligned right', () => {
  assert.match(appExperienceStyles, /app-composer-toolbar-layout \{[^}]*flex-direction: row; flex-wrap: wrap;/);
  assert.match(appExperienceStyles, /app-composer-settings-inline \[data-settings-density="workspace"\] \{ display: contents; \}/);
  assert.match(appExperienceStyles, /app-composer-submit \{[^}]*margin-inline-start: auto;/);
  assert.doesNotMatch(appExperienceStyles, /app-composer-settings-scroll/);
  assert.match(appExperienceStyles, /app-composer-submit \{[^}]*flex: 0 0 auto;/);
  assert.match(appExperienceStyles, /app-generation-controls \{[^}]*flex-wrap: nowrap;/);
  assert.match(appExperienceStyles, /@container \(max-width: 520px\)/);
  assert.doesNotMatch(appExperienceStyles, /app-composer-submit \{[^}]*(?:order: -1|flex-basis: 100%)/);
  assert.doesNotMatch(appExperienceStyles, /app-composer-toolbar-layout \{ flex-direction: column;/);
  assert.match(videoComposerSource, /const showExtraFields = Boolean\([\s\S]*showOptionsControl && optionsOpen/);
  assert.match(videoComposerSource, /extraFields=\{showExtraFields \? \(/);
});

test('workspace mobile settings wrap with touch targets and compact controls', () => {
  assert.match(coreSettingsSource, /compact \? 'min-w-0 flex-none'/);
  assert.match(imageSettingsSource, /compact \? 'min-w-0 flex-none'/);
  assert.match(coreSettingsSource, /compact \? '!min-h-11 sm:h-9 sm:!min-h-0 !min-w-0 gap-1\.5 px-2\.5 text-xs/);
  assert.match(imageSettingsSource, /compact \? '!min-h-11 sm:h-9 sm:!min-h-0 !min-w-0 gap-1\.5 px-2\.5 text-xs/);
  assert.match(coreSettingsSource, /hideChevron=\{compact\}/);
  assert.match(imageSettingsSource, /hideChevron=\{compact\}/);
  assert.match(coreSettingsSource, /formatCompactResolutionLabel/);
  assert.match(imageSettingsSource, /formatCompactResolutionLabel/);
  assert.match(coreSettingsSource, /const showIcon = !compact \|\| !\['iterations', 'fps'\]\.includes\(kind\)/);
  assert.match(imageSettingsSource, /const icons: Record<InlineControlKind, LucideIcon>/);
  assert.match(imageSettingsSource, /return <UIIcon icon=\{icons\[kind\]\}/);
  assert.doesNotMatch(imageSettingsSource, /<svg\b/);
  assert.match(coreSettingsSource, /'inline-flex h-4 items-center leading-none'/);
  assert.match(imageSettingsSource, /'inline-flex h-4 items-center leading-none'/);
  assert.match(coreSettingsSource, /<span className="block truncate leading-none">\{label\}<\/span>/);
  assert.match(imageSettingsSource, /<span className="block truncate leading-none">\{label\}<\/span>/);
  assert.match(coreSettingsSource, /w-full flex-wrap gap-1\.5/);
  assert.match(imageSettingsSource, /w-full flex-wrap gap-1\.5/);
  assert.doesNotMatch(coreSettingsSource, /compact \? 'min-w-0 flex-1/);
  assert.doesNotMatch(imageSettingsSource, /compact \? 'min-w-0 flex-1/);
  assert.doesNotMatch(composerSource, /overflow-x-auto|scrollbar-width:none/, 'essential controls cannot depend on hidden scrollbars');
});

test('workspace references delegate compact semantics while default consumers retain their layout', () => {
  assert.match(assetDropzoneSource, /density\?: 'default' \| 'compact' \| 'workspace'/);
  assert.match(assetDropzoneSource, /getWorkspaceReferenceSlots/);
  assert.match(assetDropzoneSource, /if \(workspaceDensity\)/);
  assert.match(assetDropzoneSource, /app-reference-field/);
  assert.match(composerSource, /<WorkspaceReferenceSection/);
  assert.match(composerSource, /<ComposerReferenceFields/);
  assert.match(composerSource, /workspaceDensity[\s\S]*min-h-\[96px\][\s\S]*resize-y/);
  assert.match(assetDropzoneSlotSource, /if \(props\.workspaceDensity\) return <WorkspaceAssetSlot/);
  assert.match(composerSource, /workspaceDensity \? composerToolbar : null/);
  assert.match(composerSource, /!workspaceDensity \? composerToolbar : null/);
});

test('workspace preview and image prompt density stay opt-in without changing shared defaults', () => {
  assert.match(videoPreviewSource, /<CompositePreviewDock[\s\S]*density="workspace"/);
  assert.match(imageSurfaceSource, /<ImageCompositePreviewDock[\s\S]*density="workspace"/);
  assert.match(imageSurfaceSource, /<Composer[\s\S]*compactPrompt/);
  assert.match(composerTypesSource, /compactPrompt\?: boolean/);
  assert.match(composerSource, /hidden=\{workspaceDensity && !visibleModeToggles/);
  assert.match(composerSource, /rows=\{workspaceDensity \? 3 : compactPrompt \? 2 : 6\}/);
  assert.match(composerSource, /min-h-\[96px\]/);
  assert.doesNotMatch(composerSource, /sm:h-10 sm:min-h-0/);
  assert.match(composerSource, /<WorkspaceReferenceSection/);
  assert.match(composerSource, /workspaceDensity \? 'px-3 py-1' : 'px-4 py-3'/);
  assert.match(composerSource, /!min-h-11 gap-3[\s\S]*lg:min-w-\[176px\]/);
  assert.match(compositePreviewSource, /density\?: 'default' \| 'workspace'/);
  assert.match(compositePreviewSource, /workspaceDensity \? 'px-0 py-0' : 'px-4 py-4'/);
  assert.match(compositePreviewSource, /workspaceDensity \? 'mt-0' : 'mt-3'/);
  assert.match(compositePreviewSource, /compact=\{workspaceDensity\}/);
  assert.match(compositePreviewSource, /workspaceDensity \? 'px-3 py-0' : 'px-3 py-2'/);
  assert.match(compositePreviewSource, /if \(workspaceDensity\) return;/);
  assert.match(compositePreviewSource, /const width = Math\.min\(availableWidth, maxWidth, \(maxHeight \* 16\) \/ 9\)/);
  assert.match(compositePreviewSource, /const heightPx = `\$\{Math\.round\(\(width \* 9\) \/ 16\)\}px`/);
  assert.match(compositePreviewHeaderSource, /density\?: 'default' \| 'workspace'/);
  assert.match(compositePreviewHeaderSource, /density === 'workspace' \? 'py-1' : 'py-3'/);
  assert.match(imageCompositePreviewSource, /density\?: 'default' \| 'workspace'/);
  assert.match(imageCompositePreviewSource, /workspaceDensity \? 'app-image-preview-body px-0 py-0' : 'px-4 py-4'/);
  assert.match(imageCompositePreviewSource, /workspaceDensity \? 'mt-0' : 'mt-3'/);
  assert.match(imageCompositePreviewSource, /workspaceDensity \? 'px-3 py-1' : 'rounded-card px-3 py-2 shadow-sm'/);
  assert.match(
    imageCompositePreviewSource,
    /workspaceDensity \? 'max-h-\[320px\] sm:max-h-\[390px\]' : 'max-h-\[320px\] sm:max-h-\[420px\]'/
  );
  assert.match(imageSurfaceSource, /<div className="app-image-workspace-surface flex flex-col gap-1">/);
});

test('workspace video preview shares first-paint geometry with its boot skeleton', () => {
  assert.match(compositePreviewSource, /WorkspacePreviewColumn/);
  assert.match(compositePreviewSource, /if \(workspaceDensity\) return;/);
  assert.match(workspacePreviewColumnSource, /--workspace-preview-fluid-width/);
  assert.match(workspacePreviewColumnSource, /44\.444444svh/);
  assert.match(workspacePreviewColumnSource, /56\.888889svh/);
});

test('video composer limits calm upload locks to the winning guest-auth reason', () => {
  assert.match(
    readFileSync('frontend/app/(core)/(workspace)/app/_lib/workspace-reference-fields.ts', 'utf8'),
    /disabledPresentation:\s*disabledReason && disabledReason === guestUploadLockedReason\s*\? 'auth-lock'/
  );
});

test('workspace density never changes route order by authentication state', () => {
  assert.ok(videoShellSource.indexOf('<WorkspacePreviewDock') < videoShellSource.indexOf('{composerSurface}'));
  assert.ok(imageSurfaceSource.indexOf('<ImageCompositePreviewDock') < imageSurfaceSource.indexOf('<form'));
  assert.doesNotMatch(videoShellSource, /authStatus|session|user/);
  assert.doesNotMatch(imageSurfaceSource, /authStatus/);
  assert.match(workspaceChromeSource, /p-4[^"]*lg:px-7 lg:py-2/);
  assert.match(workspaceChromeSource, /flex flex-none flex-col min-\[768px\]:flex-1 min-\[768px\]:flex-row/);
  assert.match(workspaceChromeSource, /app-workspace-main[^"]*flex-none[^"]*min-\[768px\]:flex-1/);
});

// The empty editor must never flash a large player before the form becomes usable.
test('empty workspaces keep their model chooser and illustrated result frame without a media reader', () => {
  const boot = readFileSync('frontend/app/(core)/(workspace)/app/_components/WorkspaceBootSkeletons.tsx', 'utf8');
  const bootSurface = readFileSync('frontend/app/(core)/(workspace)/app/_components/WorkspaceBootSurface.tsx', 'utf8');
  assert.match(videoPreviewSource, /if \(!group && !isLoading\)/);
  assert.match(imageSurfaceSource, /!compositePreviewEntry \? \(/);
  assert.match(boot, /if \(!posterSrc\)/);
  assert.match(videoShellSource, /<WorkspaceCreationHeading/);
  assert.match(bootSurface, /<WorkspaceCreationHeading/);
  assert.match(videoPreviewSource, /<WorkspaceEmptyPreview media="video"/);
  assert.match(imageSurfaceSource, /<WorkspaceEmptyPreview media="image"/);
  const empty = readFileSync('frontend/components/composer/WorkspaceEmptyPreview.client.tsx', 'utf8');
  assert.doesNotMatch(empty, /<video|<audio|<img|https?:/);
});
