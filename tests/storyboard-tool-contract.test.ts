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
const storyboardReferenceImagePath = join(root, 'frontend/src/components/tools/storyboard/_lib/storyboard-reference-image.ts');
const storyboardShotPlanPath = join(root, 'frontend/src/components/tools/storyboard/_lib/storyboard-shot-plan.ts');
const storyboardShotMapPath = join(root, 'frontend/src/components/tools/storyboard/_components/StoryboardShotMap.tsx');
const storyboardResultPanelPath = join(root, 'frontend/src/components/tools/storyboard/_components/StoryboardResultPanel.tsx');

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
  assert.equal(existsSync(storyboardReferenceImagePath), true, 'storyboard reference upload helper should stay colocated');
  assert.equal(existsSync(storyboardShotPlanPath), true, 'storyboard shot planner should stay colocated');
  assert.equal(existsSync(storyboardShotMapPath), true, 'storyboard shot map component should stay colocated');
  assert.equal(existsSync(storyboardResultPanelPath), true, 'storyboard result panel component should stay colocated');

  const routeSource = readFileSync(storyboardRoutePath, 'utf8');
  const toolsPageSource = readFileSync(toolsPagePath, 'utf8');
  const workspaceSource = readFileSync(storyboardWorkspacePath, 'utf8');
  const promptSource = readFileSync(storyboardPromptPath, 'utf8');
  const referenceImageSource = readFileSync(storyboardReferenceImagePath, 'utf8');
  const shotPlanSource = readFileSync(storyboardShotPlanPath, 'utf8');
  const shotMapSource = readFileSync(storyboardShotMapPath, 'utf8');
  const resultPanelSource = readFileSync(storyboardResultPanelPath, 'utf8');

  assert.doesNotMatch(routeSource, /redirect\(/);
  assert.match(routeSource, /StoryboardWorkspace/);
  assert.match(toolsPageSource, /storyboardTitle/);
  assert.match(toolsPageSource, /\/app\/tools\/storyboard/);
  assert.match(workspaceSource, /runImageGeneration/);
  assert.match(workspaceSource, /source:\s*'storyboard'/);
  assert.match(workspaceSource, /storyboardTier/);
  assert.match(workspaceSource, /buildStoryboardShotPlan/);
  assert.match(workspaceSource, /const shotPlan = useMemo/);
  assert.match(workspaceSource, /shotPlan,/);
  assert.match(workspaceSource, /StoryboardResultPanel/);
  assert.match(workspaceSource, /AssetDropzone/);
  assert.match(workspaceSource, /STORYBOARD_REFERENCE_SLOT_COUNT = 4/);
  assert.match(workspaceSource, /STORYBOARD_REFERENCE_FIELD/);
  assert.match(workspaceSource, /STORYBOARD_REFERENCE_ENGINE/);
  assert.match(workspaceSource, /referenceImages/);
  assert.match(workspaceSource, /readyReferenceImages/);
  assert.match(workspaceSource, /uploadStoryboardReferenceImage/);
  assert.match(workspaceSource, /mode:\s*sourceImages\.length \? 'i2i' : 't2i'/);
  assert.match(workspaceSource, /imageUrls:\s*sourceImages\.length \? sourceImages\.map\(\(image\) => image\.url\) : undefined/);
  assert.match(workspaceSource, /referenceImageSizes:\s*sourceImages\.length/);
  assert.match(workspaceSource, /copy\.referenceImageLabel/);
  assert.match(workspaceSource, /copy\.referenceImageBody/);
  assert.match(workspaceSource, /dialogue/);
  assert.match(workspaceSource, /copy\.dialogueLabel/);
  assert.match(workspaceSource, /copy\.dialoguePlaceholder/);
  assert.match(workspaceSource, /<textarea/);
  assert.match(workspaceSource, /Save to Storyboard library/);
  assert.doesNotMatch(workspaceSource, /promptField/);
  assert.match(promptSource, /buildStoryboardPrompt/);
  assert.match(promptSource, /shotPlan/);
  assert.match(promptSource, /Panel \$\{shot\.panel\}/);
  assert.match(promptSource, /dialogue/);
  assert.match(promptSource, /Dialogue\/audio direction/);
  assert.match(promptSource, /referenceImageCount/);
  assert.match(promptSource, /uploaded reference images/);
  assert.match(promptSource, /Seedance/);
  assert.match(promptSource, /Kling/);
  assert.match(promptSource, /real people/);
  assert.match(promptSource, /durationSec/);
  assert.match(referenceImageSource, /prepareImageFileForUpload/);
  assert.match(referenceImageSource, /\/api\/uploads\/image/);
  assert.match(referenceImageSource, /cleanupStoryboardReferenceImage/);
  assert.match(shotPlanSource, /buildStoryboardShotPlan/);
  assert.match(shotPlanSource, /StoryboardShotPlan/);
  assert.match(shotMapSource, /shot\.dialogueBeat/);
  assert.match(shotMapSource, /shot\.visualPriority/);
  assert.match(shotMapSource, /Panel/);
  assert.match(resultPanelSource, /StoryboardShotMap/);
  assert.match(resultPanelSource, /onApplyEdit/);
});

test('storyboard prompt carries dialogue as video context without drawing text into the board', async () => {
  const module = await import('../frontend/src/components/tools/storyboard/_lib/storyboard-prompt.ts');
  const prompt = module.buildStoryboardPrompt({
    subject: 'A chef presenting a product on a clean kitchen counter',
    action: 'Hands reveal the package, then point to the texture',
    dialogue: 'Chef: This sauce keeps the same rich texture.\\nVoiceover: Ready in thirty seconds.',
    style: 'realistic',
    targetModel: 'kling',
    durationSec: 10,
    frameCount: 6,
  });

  assert.match(prompt, /Dialogue\/audio direction:/);
  assert.match(prompt, /Chef: This sauce keeps the same rich texture/);
  assert.match(prompt, /Voiceover: Ready in thirty seconds/);
  assert.match(prompt, /Do not draw dialogue text/);
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
