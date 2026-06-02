import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const storyboardPresetPath = join(root, 'frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-storyboard.ts');
const queryHydrationHookPath = join(root, 'frontend/app/(core)/(workspace)/app/image/_hooks/useImageWorkspaceQueryHydration.ts');
const imageWorkspacePath = join(root, 'frontend/app/(core)/(workspace)/app/image/ImageWorkspace.tsx');
const previewActionsHookPath = join(root, 'frontend/app/(core)/(workspace)/app/image/_hooks/useImagePreviewActions.ts');
const displayStateHookPath = join(root, 'frontend/app/(core)/(workspace)/app/image/_hooks/useImageWorkspaceDisplayState.ts');
const composerSurfacePath = join(root, 'frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface.tsx');
const videoComposerSurfacePath = join(root, 'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx');
const storyboardLaunchModalPath = join(root, 'frontend/app/(core)/(workspace)/app/_components/StoryboardLaunchModal.tsx');
const previewDockPath = join(root, 'frontend/components/groups/ImageCompositePreviewDock.tsx');
const toolsPagePath = join(root, 'frontend/src/components/tools/ToolsWorkspacePage.tsx');
const storyboardRoutePath = join(root, 'frontend/app/(core)/(workspace)/app/tools/storyboard/page.tsx');
const storyboardWorkspacePath = join(root, 'frontend/src/components/tools/StoryboardWorkspace.tsx');
const storyboardCopyPath = join(root, 'frontend/src/components/tools/storyboard/_lib/storyboard-workspace-copy.ts');
const storyboardPromptPath = join(root, 'frontend/src/components/tools/storyboard/_lib/storyboard-prompt.ts');

test('storyboard tool exposes a focused image workspace preset for GPT Image 2', async () => {
  assert.equal(existsSync(storyboardPresetPath), true, 'storyboard preset helper should live under image _lib');

  const module = await import('../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-storyboard.ts');
  const preset = module.IMAGE_STORYBOARD_PRESET as {
    tool: string;
    engineId: string;
    mode: string;
    librarySource: string;
    prompt: string;
  };

  assert.equal(preset.tool, 'storyboard');
  assert.equal(preset.engineId, 'gpt-image-2');
  assert.equal(preset.mode, 't2i');
  assert.equal(preset.librarySource, 'storyboard');
  assert.match(preset.prompt, /storyboard/i);
  assert.match(preset.prompt, /Seedance 2/i);
  assert.match(preset.prompt, /Kling/i);
  assert.match(preset.prompt, /no real people/i);
  assert.match(preset.prompt, /product/i);
  assert.match(preset.prompt, /cooking/i);
  assert.match(preset.prompt, /animation/i);
});

test('image workspace hydrates storyboard tool query and keeps result actions route-local', () => {
  const queryHydrationHookSource = readFileSync(queryHydrationHookPath, 'utf8');
  const imageWorkspaceSource = readFileSync(imageWorkspacePath, 'utf8');
  const previewActionsHookSource = readFileSync(previewActionsHookPath, 'utf8');
  const displayStateHookSource = readFileSync(displayStateHookPath, 'utf8');
  const composerSurfaceSource = readFileSync(composerSurfacePath, 'utf8');
  const previewDockSource = readFileSync(previewDockPath, 'utf8');

  assert.match(queryHydrationHookSource, /IMAGE_STORYBOARD_PRESET/);
  assert.match(queryHydrationHookSource, /requestedTool/);
  assert.match(queryHydrationHookSource, /setPrompt\(IMAGE_STORYBOARD_PRESET\.prompt\)/);
  assert.match(queryHydrationHookSource, /setEngineId\(engineMatch\.id\)/);

  assert.match(imageWorkspaceSource, /librarySource/);
  assert.match(imageWorkspaceSource, /suppressDefaultPreview:\s*librarySource === 'storyboard'/);
  assert.match(imageWorkspaceSource, /handleEditSelectedPreview/);
  assert.match(imageWorkspaceSource, /handleEditSelectedPreview=\{handleEditSelectedPreview\}/);
  assert.doesNotMatch(imageWorkspaceSource, /saveImageToLibrary/, 'library saves should stay in useImagePreviewActions');

  assert.match(previewActionsHookSource, /librarySource/);
  assert.match(previewActionsHookSource, /source:\s*librarySource/);
  assert.match(previewActionsHookSource, /source=\$\{encodeURIComponent\(librarySource\)\}/);
  assert.match(displayStateHookSource, /suppressDefaultPreview/);
  assert.match(displayStateHookSource, /if \(suppressDefaultPreview && !selectedPreviewEntryId\) return undefined;/);

  assert.match(composerSurfaceSource, /handleEditSelectedPreview/);
  assert.match(composerSurfaceSource, /onEditImage=\{handleEditSelectedPreview\}/);
  assert.match(previewDockSource, /onEditImage/);
});

test('storyboard tool is reachable from the tools hub as its own workspace', () => {
  assert.equal(existsSync(storyboardRoutePath), true, 'storyboard tool route should exist');
  assert.equal(existsSync(storyboardWorkspacePath), true, 'storyboard workspace should be a dedicated app tool');
  assert.equal(existsSync(storyboardCopyPath), true, 'storyboard copy should stay colocated');
  assert.equal(existsSync(storyboardPromptPath), true, 'storyboard prompt building should stay colocated');

  const routeSource = readFileSync(storyboardRoutePath, 'utf8');
  const toolsPageSource = readFileSync(toolsPagePath, 'utf8');
  const workspaceSource = readFileSync(storyboardWorkspacePath, 'utf8');
  const promptSource = readFileSync(storyboardPromptPath, 'utf8');

  assert.doesNotMatch(routeSource, /redirect\(/);
  assert.match(routeSource, /StoryboardWorkspace/);
  assert.match(toolsPageSource, /storyboardTitle/);
  assert.match(toolsPageSource, /\/app\/tools\/storyboard/);
  assert.match(workspaceSource, /runImageGeneration/);
  assert.match(workspaceSource, /source:\s*'storyboard'/);
  assert.match(workspaceSource, /storyboardTier/);
  assert.match(workspaceSource, /Save to Storyboard library/);
  assert.doesNotMatch(workspaceSource, /promptField/);
  assert.doesNotMatch(workspaceSource, /<textarea/);
  assert.match(promptSource, /buildStoryboardPrompt/);
  assert.match(promptSource, /Seedance/);
  assert.match(promptSource, /Kling/);
  assert.match(promptSource, /real people/);
  assert.match(promptSource, /durationSec/);
});

test('video workspace exposes a storyboard launcher for Seedance and Kling models', () => {
  assert.equal(existsSync(storyboardLaunchModalPath), true, 'video workspace storyboard modal should be route-local');

  const composerSource = readFileSync(videoComposerSurfacePath, 'utf8');
  const modalSource = readFileSync(storyboardLaunchModalPath, 'utf8');

  assert.match(composerSource, /isStoryboardLaunchEngine/);
  assert.match(composerSource, /setStoryboardModalOpen/);
  assert.match(composerSource, /StoryboardLaunchModal/);
  assert.match(composerSource, /storyboardLaunchAction/);
  assert.match(composerSource, /selectedEngine\.id/);
  assert.match(modalSource, /role="dialog"/);
  assert.match(modalSource, /\/app\/tools\/storyboard/);
  assert.match(modalSource, /Seedance/);
  assert.match(modalSource, /Kling/);
});
