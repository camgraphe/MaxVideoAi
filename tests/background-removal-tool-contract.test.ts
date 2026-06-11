import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const typesPath = join(root, 'frontend/types/tools-background-removal.ts');
const configPath = join(root, 'frontend/src/config/tools-background-removal-engines.ts');
const libPath = join(root, 'frontend/src/lib/tools-background-removal.ts');
const apiGenerationPath = join(root, 'frontend/lib/api-generation.ts');
const apiFacadePath = join(root, 'frontend/lib/api.ts');

test('background removal tool exposes typed contracts and safe model ids', () => {
  assert.ok(existsSync(typesPath));
  assert.ok(existsSync(configPath));
  assert.ok(existsSync(libPath));

  const typesSource = readFileSync(typesPath, 'utf8');
  const configSource = readFileSync(configPath, 'utf8');
  const libSource = readFileSync(libPath, 'utf8');

  assert.match(typesSource, /BackgroundRemovalToolRequest/);
  assert.doesNotMatch(typesSource, /BackgroundRemovalRealtimeSessionRequest/);
  assert.match(configSource, /bria\/video\/background-removal\/v3/);
  assert.doesNotMatch(configSource, /bria\/video\/background-removal\/realtime/);
  assert.match(configSource, /BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND/);
  assert.match(configSource, /BACKGROUND_REMOVAL_DYNAMIC_PRICE_MULTIPLIER/);
  assert.match(libSource, /buildBackgroundRemovalPricingPreview/);
  assert.match(libSource, /buildBackgroundRemovalProviderInput/);
  assert.doesNotMatch(libSource, /buildBackgroundRemovalRealtimeInput/);
  assert.doesNotMatch(libSource, /BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER/);
  assert.doesNotMatch(libSource, /providerEstimateUsd/);
  assert.doesNotMatch(libSource, /process\.env\.FAL/);
});

test('background removal client API is exported from the public API facade', () => {
  const apiGenerationSource = readFileSync(apiGenerationPath, 'utf8');
  const apiFacadeSource = readFileSync(apiFacadePath, 'utf8');

  assert.match(apiGenerationSource, /runBackgroundRemovalTool/);
  assert.doesNotMatch(apiGenerationSource, /startBackgroundRemovalRealtimeSession/);
  assert.match(apiFacadeSource, /runBackgroundRemovalTool/);
  assert.doesNotMatch(apiFacadeSource, /startBackgroundRemovalRealtimeSession/);
});

test('background removal is a first-class job and media surface', () => {
  const billingTypes = readFileSync(join(root, 'frontend/types/billing.ts'), 'utf8');
  const surfaceNormalize = readFileSync(join(root, 'frontend/src/lib/job-surface-normalize.ts'), 'utf8');
  const surfaceFilter = readFileSync(join(root, 'frontend/app/api/jobs/_lib/jobs-surface-filter.ts'), 'utf8');
  const mediaRecords = readFileSync(join(root, 'frontend/server/media-library-records.ts'), 'utf8');

  assert.match(billingTypes, /'background-removal'/);
  assert.match(surfaceNormalize, /background-removal/);
  assert.match(surfaceFilter, /tool_background_removal_/);
  assert.match(mediaRecords, /background-removal/);
});

test('background removal workspace follows the tool workspace split', () => {
  const workspacePath = join(root, 'frontend/src/components/tools/BackgroundRemovalWorkspace.tsx');
  const copyPath = join(root, 'frontend/src/components/tools/background-removal/_lib/background-removal-workspace-copy.ts');
  const helpersPath = join(
    root,
    'frontend/src/components/tools/background-removal/_lib/background-removal-workspace-helpers.ts'
  );
  const runnerHookPath = join(
    root,
    'frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalGenerationRunner.ts'
  );

  assert.ok(existsSync(workspacePath));
  assert.ok(existsSync(copyPath));
  assert.ok(existsSync(helpersPath));
  assert.ok(existsSync(runnerHookPath));

  const workspaceSource = readFileSync(workspacePath, 'utf8');
  const runnerHookSource = readFileSync(runnerHookPath, 'utf8');

  assert.match(workspaceSource, /useBackgroundRemovalSourceMedia/);
  assert.match(workspaceSource, /useBackgroundRemovalPricingPreview/);
  assert.match(workspaceSource, /useBackgroundRemovalGenerationRunner/);
  assert.match(workspaceSource, /copy\.subtitle/, 'workspace header should retain the tool subtitle');
  assert.match(workspaceSource, /sourceSummary/, 'workspace header should summarize source readiness');
  assert.match(workspaceSource, /formatBackgroundRemovalOutputCodecLabel\(outputCodec\)/, 'workspace header should summarize output format');
  assert.match(workspaceSource, /copy\.priceBeforeGeneration/, 'workspace header should summarize price before generation');
  assert.doesNotMatch(workspaceSource, /useBackgroundRemovalRealtimeSession/);
  assert.doesNotMatch(workspaceSource, /BackgroundRemovalRealtimePanel/);
  assert.doesNotMatch(workspaceSource, /navigator\.mediaDevices/);
  assert.doesNotMatch(workspaceSource, /runBackgroundRemovalTool/);
  assert.doesNotMatch(workspaceSource, /fal\.realtime\.connect/);
  assert.match(runnerHookSource, /runBackgroundRemovalTool/);
});

test('transparent web previews expose checkerboard behind alpha video', () => {
  const settingsPanelPath = join(
    root,
    'frontend/src/components/tools/background-removal/_components/BackgroundRemovalSettingsPanel.tsx'
  );
  const previewCardPath = join(root, 'frontend/src/components/tools/background-removal/_components/BackgroundRemovalPreviewCard.tsx');
  const settingsPanelSource = readFileSync(settingsPanelPath, 'utf8');
  const previewCardSource = readFileSync(previewCardPath, 'utf8');

  assert.match(settingsPanelSource, /canPreviewTransparentOutput/);
  assert.match(settingsPanelSource, /transparent \? 'bg-transparent' : 'bg-black'/);
  assert.doesNotMatch(settingsPanelSource, /border border-border bg-black object-contain/);

  assert.match(previewCardSource, /canPreviewTransparentOutput/);
  assert.match(previewCardSource, /transparent \? 'bg-transparent' : 'bg-black'/);
  assert.doesNotMatch(previewCardSource, /border border-border bg-black object-contain/);
});

test('background removal library and recent flows stay scoped to video assets', () => {
  const recentActionsPath = join(
    root,
    'frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalRecentActions.ts'
  );
  const recentJobsPath = join(root, 'frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalRecentJobs.ts');
  const sourceMediaPath = join(root, 'frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalSourceMedia.ts');
  const mediaAssetsPath = join(root, 'frontend/server/media-library/assets.ts');
  const adminPendingPath = join(root, 'frontend/app/api/admin/videos/pending/route.ts');

  const recentActionsSource = readFileSync(recentActionsPath, 'utf8');
  const recentJobsSource = readFileSync(recentJobsPath, 'utf8');
  const sourceMediaSource = readFileSync(sourceMediaPath, 'utf8');
  const mediaAssetsSource = readFileSync(mediaAssetsPath, 'utf8');
  const adminPendingSource = readFileSync(adminPendingPath, 'utf8');

  assert.match(recentActionsSource, /source:\s*'background-removal'/);
  assert.match(recentActionsSource, /kind:\s*'video'/);
  assert.match(recentActionsSource, /sourceOutputId:\s*`\$\{item\.job\.jobId\}:video:0`/);
  assert.match(recentJobsSource, /useInfiniteJobs\(12,\s*\{\s*surface:\s*'background-removal'\s*\}\)/);
  assert.match(sourceMediaSource, /type LibrarySource = 'all' \| 'upload' \| 'generated' \| 'background-removal'/);
  assert.match(mediaAssetsSource, /source IN \('upload', 'storyboard', 'character', 'angle', 'upscale', 'background-removal'\)/);
  assert.match(adminPendingSource, /tool_background_removal_/);
  assert.match(adminPendingSource, /background-removal/);
});
