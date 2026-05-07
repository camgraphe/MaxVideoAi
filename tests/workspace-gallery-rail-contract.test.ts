import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('workspace video rail opens renders in the composite preview, not the group viewer', () => {
  const railSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/GalleryRail.tsx'),
    'utf8'
  );
  const cardSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/GroupedJobCard.tsx'),
    'utf8'
  );

  assert.match(cardSource, /showOpenOverlay\?:\s*boolean/);
  assert.match(cardSource, /showOpenOverlay\s*&&\s*onOpen/);
  assert.match(cardSource, /onClick=\{\(\)\s*=>\s*handleAction\('open'\)\}/);
  assert.doesNotMatch(cardSource, /showGalleryActions[\s\S]*onClick=\{\(\)\s*=>\s*handleAction\('view'\)\}/);

  assert.match(railSource, /openLabel=\{feedType === 'video' \? 'Preview' : undefined\}/);
  assert.match(railSource, /showOpenOverlay=\{false\}/);
  assert.match(railSource, /onGroupAction\(original,\s*'open',\s*\{\s*autoPlayPreview:\s*true\s*\}\)/);
});

test('Seedance completion persists canonical video outputs before preview enrichment', () => {
  const pollSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/byteplus-poll.ts'),
    'utf8'
  );

  assert.match(pollSource, /upsertLegacyJobOutputs/);
  assert.match(pollSource, /video_url:\s*copiedVideoUrl/);
  assert.match(pollSource, /thumb_url:\s*thumb/);
  assert.match(pollSource, /generateAndPersistJobPreviewVideo/);
});

test('composite preview modal button opens direct preview groups', () => {
  const previewStateHookSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePreviewState.ts'),
    'utf8'
  );
  const previewDockSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/_components/WorkspacePreviewDock.tsx'),
    'utf8'
  );

  assert.match(previewDockSource, /\|\s*\{\s*kind:\s*'group';\s*group:\s*VideoGroup\s*\}/);
  assert.match(previewStateHookSource, /if\s*\(viewerTarget\.kind === 'group'\)\s*\{\s*return viewerTarget\.group;\s*\}/);
  assert.match(previewDockSource, /setViewerTarget\(\{\s*kind:\s*'group',\s*group:\s*nextGroup\s*\}\)/);
});

test('composite preview preserves preview urls but plays canonical video urls', () => {
  const renderGroupSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/_lib/workspace-render-groups.ts'),
    'utf8'
  );
  const videoSettingsSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings.ts'),
    'utf8'
  );
  const galleryActionsHookSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGalleryActions.ts'),
    'utf8'
  );
  const dockSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/groups/CompositePreviewDock.tsx'),
    'utf8'
  );

  assert.match(galleryActionsHookSource, /previewVideoUrl:\s*tile\.previewVideoUrl/);
  assert.match(videoSettingsSource, /previewVideoUrl:\s*patch\.previewVideoUrl\s*\?\?\s*current\.previewVideoUrl/);
  assert.match(videoSettingsSource, /previewUrl:\s*patch\.previewVideoUrl\s*\?\?\s*item\.previewUrl/);
  assert.match(renderGroupSource, /previewVideoUrl:\s*gatingActive\s*\?\s*null\s*:\s*item\.previewVideoUrl\s*\?\?\s*null/);
  assert.match(dockSource, /function getInlinePreviewUrl\(item: VideoItem\): string \{\s*return item\.url;\s*\}/);
  assert.doesNotMatch(dockSource, /return item\.previewUrl \?\? item\.url/);
});

test('rail history previews do not mutate the active render group', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/AppClient.tsx'),
    'utf8'
  );
  const galleryActionsHookSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGalleryActions.ts'),
    'utf8'
  );

  assert.match(galleryActionsHookSource, /if\s*\(group\.source === 'active'\)\s*\{\s*setActiveGroupId\(group\.id\)/);
  assert.match(galleryActionsHookSource, /const openGroupViaGallery = useCallback\(\s*\(\s*group: GroupSummary\s*\)\s*=>\s*\{\s*handleGalleryGroupAction\(group,\s*'open',\s*\{\s*autoPlayPreview:\s*true\s*\}\);/);
  assert.doesNotMatch(galleryActionsHookSource, /const openGroupViaGallery[\s\S]*?setActiveGroupId\(group\.id\)[\s\S]*?\[handleGalleryGroupAction\]/);
  const activeOpenStart = galleryActionsHookSource.indexOf("if (group.source === 'active')");
  const activeOpenEnd = galleryActionsHookSource.indexOf("if (action === 'continue')", activeOpenStart);
  assert.notEqual(activeOpenStart, -1);
  assert.notEqual(activeOpenEnd, -1);
  const activeOpenBlock = galleryActionsHookSource.slice(activeOpenStart, activeOpenEnd);
  assert.doesNotMatch(activeOpenBlock, /applyVideoSettingsFromTile\(tile\);/);
  assert.doesNotMatch(activeOpenBlock, /hydrateVideoSettingsFromJob\(heroJobId\);/);
  assert.doesNotMatch(
    appSource,
    /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(!activeGroupId\)[\s\S]*?setCompositeOverride\(null\)[\s\S]*?\},\s*\[activeGroupId,\s*renderGroups\]\)/
  );
});

test('video polling waits for a real static thumbnail', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/AppClient.tsx'),
    'utf8'
  );
  const renderPersistenceSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/_lib/render-persistence.ts'),
    'utf8'
  );
  const renderStatusSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/_lib/workspace-render-status.ts'),
    'utf8'
  );
  const generationPollingSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/_lib/workspace-generation-polling.ts'),
    'utf8'
  );
  const renderStateHookSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRenderState.ts'),
    'utf8'
  );
  const generationRunnerHookSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGenerationRunner.ts'),
    'utf8'
  );

  assert.match(renderPersistenceSource, /export function resolvePolledThumbUrl/);
  assert.match(renderPersistenceSource, /next && !isPlaceholderMediaUrl\(next\)/);
  assert.match(renderStatusSource, /thumbUrl:\s*resolvePolledThumbUrl\(render\.thumbUrl,\s*status\.thumbUrl\)/);
  assert.match(renderStatusSource, /thumbUrl:\s*resolvePolledThumbUrl\(current\.thumbUrl,\s*status\.thumbUrl\)/);
  assert.match(generationPollingSource, /thumbUrl:\s*resolvePolledThumbUrl\(render\.thumbUrl,\s*projection\.status\.thumbUrl\)/);
  assert.match(generationPollingSource, /thumbUrl:\s*resolvePolledThumbUrl\(current\.thumbUrl,\s*projection\.status\.thumbUrl\)/);
  assert.match(generationRunnerHookSource, /applyGenerationPollToRender\(r,\s*pollProjection\)/);
  assert.match(renderStateHookSource, /applyPolledJobStatusToRender\(item,\s*status\)/);
});
