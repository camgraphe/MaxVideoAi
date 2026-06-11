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
  assert.match(typesSource, /BackgroundRemovalRealtimeSessionRequest/);
  assert.match(configSource, /bria\/video\/background-removal\/v3/);
  assert.match(configSource, /bria\/video\/background-removal\/realtime/);
  assert.match(configSource, /BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND/);
  assert.match(libSource, /buildBackgroundRemovalPricingPreview/);
  assert.match(libSource, /buildBackgroundRemovalFalInput/);
  assert.doesNotMatch(libSource, /process\.env\.FAL/);
});

test('background removal client API is exported from the public API facade', () => {
  const apiGenerationSource = readFileSync(apiGenerationPath, 'utf8');
  const apiFacadeSource = readFileSync(apiFacadePath, 'utf8');

  assert.match(apiGenerationSource, /runBackgroundRemovalTool/);
  assert.match(apiGenerationSource, /startBackgroundRemovalRealtimeSession/);
  assert.match(apiFacadeSource, /runBackgroundRemovalTool/);
  assert.match(apiFacadeSource, /startBackgroundRemovalRealtimeSession/);
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
  const realtimeHookPath = join(
    root,
    'frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalRealtimeSession.ts'
  );

  assert.ok(existsSync(workspacePath));
  assert.ok(existsSync(copyPath));
  assert.ok(existsSync(helpersPath));
  assert.ok(existsSync(runnerHookPath));
  assert.ok(existsSync(realtimeHookPath));

  const workspaceSource = readFileSync(workspacePath, 'utf8');
  const runnerHookSource = readFileSync(runnerHookPath, 'utf8');
  const realtimeHookSource = readFileSync(realtimeHookPath, 'utf8');

  assert.match(workspaceSource, /useBackgroundRemovalSourceMedia/);
  assert.match(workspaceSource, /useBackgroundRemovalPricingPreview/);
  assert.match(workspaceSource, /useBackgroundRemovalGenerationRunner/);
  assert.match(workspaceSource, /useBackgroundRemovalRealtimeSession/);
  assert.doesNotMatch(workspaceSource, /runBackgroundRemovalTool/);
  assert.doesNotMatch(workspaceSource, /fal\.realtime\.connect/);
  assert.match(runnerHookSource, /runBackgroundRemovalTool/);
  assert.match(realtimeHookSource, /fal\.realtime\.connect/);
});
