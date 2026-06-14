import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  WORKSPACE_TEMPLATE_SUMMARIES,
  createDevBlocksWorkspaceTemplate,
  createProductAdWorkspaceTemplate,
  createStarterWorkspaceTemplate,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';
import {
  getWorkspaceModelCapabilities,
  getWorkspaceShotInputConnectors,
  isWorkspaceConnectionCompatible,
  resolveWorkspaceRenderOptions,
  workspaceAudioEnabledForRequest,
  workspaceConnectionCapacity,
  validateShotConnections,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import {
  shotOutputSourceHandle,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-normalizers';
import type {
  WorkspaceModelCapability,
  WorkspaceShotSettings,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import type { EngineCaps } from '../frontend/types/engines';

const root = process.cwd();
const rootAgentsPath = join(root, 'AGENTS.md');
const studioArchitectureGuidePath = join(root, 'docs/engineering/studio-editor-architecture.md');
const studioDir = join(root, 'frontend/app/(core)/(workspace)/app/studio');
const studioAgentsPath = join(studioDir, 'AGENTS.md');
const studioApiDir = join(root, 'frontend/app/api/studio');
const studioServerDir = join(root, 'frontend/src/server/studio');
const workspaceDir = join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace');
const pagePath = join(workspaceDir, 'page.tsx');
const projectsPagePath = join(studioDir, 'projects/page.tsx');
const projectsClientPath = join(studioDir, 'projects/StudioProjectsPage.client.tsx');
const projectsStylesPath = join(studioDir, 'projects/studio-projects.module.css');
const studioProjectsPageClientPath = projectsClientPath;
const dynamicWorkspacePagePath = join(workspaceDir, '[projectId]/page.tsx');
const workspacePagePath = join(workspaceDir, 'WorkspacePage.client.tsx');
const workspacePageClientPath = workspacePagePath;
const studioCopyPath = join(studioDir, '_lib/studio-copy.ts');
const studioThemeHookPath = join(studioDir, '_hooks/useStudioThemeMode.ts');
const studioProjectsApiPath = join(studioApiDir, 'projects/route.ts');
const studioProjectApiPath = join(studioApiDir, 'projects/[projectId]/route.ts');
const studioProjectSequencesApiPath = join(studioApiDir, 'projects/[projectId]/sequences/route.ts');
const studioProjectSequenceApiPath = join(studioApiDir, 'projects/[projectId]/sequences/[sequenceId]/route.ts');
const studioCanvasTemplatesApiPath = join(studioApiDir, 'canvas-templates/route.ts');
const studioCanvasTemplateApiPath = join(studioApiDir, 'canvas-templates/[templateId]/route.ts');
const studioChatApiPath = join(studioApiDir, 'chat/route.ts');
const studioRouteUtilsPath = join(studioApiDir, '_lib/studio-route-utils.ts');
const studioServerContractsPath = join(studioServerDir, 'contracts.ts');
const studioChatServerPath = join(studioServerDir, 'chat.ts');
const studioServerSchemaPath = join(studioServerDir, 'schema.ts');
const studioServerRepositoryPath = join(studioServerDir, 'repository.ts');
const studioMigrationPath = join(root, 'neon/migrations/26_studio_projects.sql');
const canvasPath = join(workspaceDir, '_components/WorkspaceCanvas.client.tsx');
const canvasMapPath = join(workspaceDir, '_components/canvas/CanvasMap.tsx');
const canvasHandleDropPreviewPath = join(workspaceDir, '_components/canvas/CanvasHandleDropPreview.tsx');
const canvasFloatingToolbarPath = join(workspaceDir, '_components/canvas/CanvasFloatingToolbar.tsx');
const canvasNavigatorPanelPath = join(workspaceDir, '_components/canvas/CanvasNavigatorPanel.tsx');
const canvasPaletteDragPreviewPath = join(workspaceDir, '_components/canvas/CanvasPaletteDragPreview.tsx');
const canvasControllerPath = join(workspaceDir, '_controllers/useCanvasController.ts');
const canvasImportActionsHookPath = join(workspaceDir, '_hooks/useWorkspaceCanvasImportActions.ts');
const canvasTimelineActionsHookPath = join(workspaceDir, '_hooks/useWorkspaceCanvasTimelineActions.ts');
const canvasTemplateActionsHookPath = join(workspaceDir, '_hooks/useWorkspaceCanvasTemplateActions.ts');
const generationActionsHookPath = join(workspaceDir, '_hooks/useWorkspaceGenerationActions.ts');
const graphActionsHookPath = join(workspaceDir, '_hooks/useWorkspaceGraphActions.ts');
const renderNodesHookPath = join(workspaceDir, '_hooks/useWorkspaceRenderNodes.ts');
const selectionActionsHookPath = join(workspaceDir, '_hooks/useWorkspaceSelectionActions.ts');
const persistenceEffectsHookPath = join(workspaceDir, '_hooks/useWorkspacePersistenceEffects.ts');
const sequenceActionsHookPath = join(workspaceDir, '_hooks/useWorkspaceSequenceActions.ts');
const sequenceSnapshotsHookPath = join(workspaceDir, '_hooks/useWorkspaceSequenceSnapshots.ts');
const shellActionsHookPath = join(workspaceDir, '_hooks/useWorkspaceShellActions.ts');
const projectMediaActionsHookPath = join(workspaceDir, '_hooks/useWorkspaceProjectMediaActions.ts');
const projectMediaControllerPath = join(workspaceDir, '_controllers/useProjectMediaController.ts');
const exportControllerPath = join(workspaceDir, '_controllers/useExportController.ts');
const exportStateHookPath = join(workspaceDir, '_hooks/useWorkspaceExportState.ts');
const assetLibraryModalPath = join(workspaceDir, '_components/WorkspaceAssetLibraryModal.tsx');
const projectMediaLibraryModalPath = join(workspaceDir, '_components/WorkspaceProjectMediaLibraryModal.tsx');
const assetLibraryBrowserPath = join(workspaceDir, '_components/WorkspaceAssetLibraryBrowser.tsx');
const exportDialogPath = join(workspaceDir, '_components/WorkspaceExportDialog.tsx');
const runtimeModalsPath = join(workspaceDir, '_components/WorkspaceRuntimeModals.tsx');
const legacyLibraryPath = join(workspaceDir, '_components/NodeLibrarySidebar.tsx');
const timelineProjectSidebarPath = join(workspaceDir, '_components/TimelineProjectSidebar.tsx');
const workspaceEditorLayoutPath = join(workspaceDir, '_components/WorkspaceEditorLayout.tsx');
const workspaceMobilePanelControlsPath = join(workspaceDir, '_components/WorkspaceMobilePanelControls.tsx');
const studioHeaderSessionPath = join(workspaceDir, '_components/StudioHeaderSession.tsx');
const workspaceEditorTopbarPath = join(workspaceDir, '_components/WorkspaceEditorTopbar.tsx');
const settingsPath = join(workspaceDir, '_components/NodeSettingsPanel.tsx');
const shotNodeInspectorPath = join(workspaceDir, '_components/ShotNodeInspector.tsx');
const chatInspectorPath = join(workspaceDir, '_components/ChatNodeInspector.tsx');
const nodeInspectorControlsPath = join(workspaceDir, '_components/NodeInspectorControls.tsx');
const nodeInspectorConnectionsPath = join(workspaceDir, '_components/NodeInspectorConnections.tsx');
const nodeInspectorMediaPreviewPath = join(workspaceDir, '_components/NodeInspectorMediaPreview.tsx');
const timelineClipInspectorPath = join(workspaceDir, '_components/TimelineClipInspector.tsx');
const timelinePath = join(workspaceDir, '_components/WorkspaceTimeline.tsx');
const timelineClipPath = join(workspaceDir, '_components/timeline/TimelineClip.tsx');
const timelineContextMenusPath = join(workspaceDir, '_components/timeline/TimelineContextMenus.tsx');
const timelineContextMenusHookPath = join(workspaceDir, '_components/timeline/useTimelineContextMenus.ts');
const timelineRulerPath = join(workspaceDir, '_components/timeline/TimelineRuler.tsx');
const timelineTrackListPath = join(workspaceDir, '_components/timeline/TimelineTrackList.tsx');
const timelineTrackRowPath = join(workspaceDir, '_components/timeline/TimelineTrackRow.tsx');
const timelineToolbarPath = join(workspaceDir, '_components/timeline/TimelineToolbar.tsx');
const timelineKeyboardShortcutsPath = join(workspaceDir, '_components/timeline/useTimelineKeyboardShortcuts.ts');
const timelineClipInteractionHookPath = join(workspaceDir, '_components/timeline/useTimelineClipInteraction.ts');
const timelineExternalDropHookPath = join(workspaceDir, '_components/timeline/useTimelineExternalDrop.ts');
const timelinePanelResizeHookPath = join(workspaceDir, '_components/timeline/useTimelinePanelResize.ts');
const timelinePlayheadDragHookPath = join(workspaceDir, '_components/timeline/useTimelinePlayheadDrag.ts');
const timelinePreviewItemsHookPath = join(workspaceDir, '_components/timeline/useTimelinePreviewItems.ts');
const timelineSurfaceSelectionHookPath = join(workspaceDir, '_components/timeline/useTimelineSurfaceSelection.ts');
const timelineVisibleRangeHookPath = join(workspaceDir, '_components/timeline/useTimelineVisibleRange.ts');
const timelineTrackDefinitionsPath = join(workspaceDir, '_components/timeline/timelineTrackDefinitions.tsx');
const videoViewerPath = join(workspaceDir, '_components/WorkspaceVideoViewer.tsx');
const programMonitorPath = join(workspaceDir, '_components/viewer/ProgramMonitor.tsx');
const programPlaybackLayersPath = join(workspaceDir, '_components/viewer/ProgramPlaybackLayers.tsx');
const programControlsPath = join(workspaceDir, '_components/viewer/ProgramControls.tsx');
const programPlaybackSyncPath = join(workspaceDir, '_components/viewer/useProgramPlaybackSync.ts');
const nodeTypesPath = join(workspaceDir, '_components/nodes/workspace-node-types.tsx');
const nodeFramePath = join(workspaceDir, '_components/nodes/workspace-node-frame.tsx');
const shotInputDockPath = join(workspaceDir, '_components/nodes/workspace-shot-input-dock.tsx');
const nodeMediaPreviewPath = join(workspaceDir, '_components/nodes/workspace-node-media-preview.tsx');
const edgeTypesPath = join(workspaceDir, '_components/edges/workspace-smart-edge.tsx');
const typesPath = join(workspaceDir, '_lib/workspace-types.ts');
const capabilitiesPath = join(workspaceDir, '_lib/workspace-capabilities.ts');
const modelCapabilityRegistryPath = join(workspaceDir, '_lib/models/model-capability-registry.ts');
const modelEngineFieldsPath = join(workspaceDir, '_lib/models/model-engine-fields.ts');
const modelInputConnectorsPath = join(workspaceDir, '_lib/models/model-input-connectors.ts');
const modelPricingAdapterPath = join(workspaceDir, '_lib/models/model-pricing-adapter.ts');
const blockPresetsPath = join(workspaceDir, '_lib/workspace-block-presets.ts');
const generationPath = join(workspaceDir, '_lib/workspace-generation.ts');
const generationRoutingPath = join(workspaceDir, '_lib/workspace-generation-routing.ts');
const pricingPath = join(workspaceDir, '_lib/workspace-pricing.ts');
const mediaAvailabilityPath = join(workspaceDir, '_lib/workspace-media-availability.ts');
const handleDropPath = join(workspaceDir, '_lib/workspace-handle-drop.ts');
const canvasImportsPath = join(workspaceDir, '_lib/workspace-canvas-imports.ts');
const programSnapshotPath = join(workspaceDir, '_lib/workspace-program-snapshot.ts');
const graphHelpersPath = join(workspaceDir, '_lib/workspace-graph-helpers.ts');
const projectSettingsPath = join(workspaceDir, '_lib/workspace-project-settings.ts');
const timecodePath = join(workspaceDir, '_lib/workspace-timecode.ts');
const timelineEditingPath = join(workspaceDir, '_lib/workspace-timeline-editing.ts');
const timelineRenderPath = join(workspaceDir, '_lib/workspace-timeline-render.ts');
const timelineExportPath = join(workspaceDir, '_lib/workspace-timeline-export.ts');
const timelineTracksPath = join(workspaceDir, '_lib/workspace-timeline-tracks.ts');
const timelineDropsPath = join(workspaceDir, '_lib/workspace-timeline-drops.ts');
const timelineSelectionPath = join(workspaceDir, '_lib/workspace-timeline-selection.ts');
const projectMediaDragPath = join(workspaceDir, '_lib/workspace-project-media-drag.ts');
const projectMediaTimelinePath = join(workspaceDir, '_lib/workspace-project-media-timeline.ts');
const projectMediaMetadataPath = join(workspaceDir, '_lib/workspace-project-media-metadata.ts');
const projectMediaUploadPath = join(workspaceDir, '_lib/workspace-project-media-upload.ts');
const timelineFramesPath = join(workspaceDir, '_lib/timeline/timeline-frames.ts');
const timelineInteractionPath = join(workspaceDir, '_lib/timeline/timeline-interaction.ts');
const timelineExternalDropPath = join(workspaceDir, '_lib/timeline/timeline-external-drop.ts');
const timelinePerformancePath = join(workspaceDir, '_lib/timeline/timeline-performance.ts');
const timelineCollisionsPath = join(workspaceDir, '_lib/timeline/timeline-collisions.ts');
const timelineInsertPath = join(workspaceDir, '_lib/timeline/timeline-insert.ts');
const timelineTrimPath = join(workspaceDir, '_lib/timeline/timeline-trim.ts');
const timelineResizeEditingPath = join(workspaceDir, '_lib/timeline/timeline-resize-editing.ts');
const timelineNormalizePath = join(workspaceDir, '_lib/timeline/timeline-normalize.ts');
const timelinePositioningPath = join(workspaceDir, '_lib/timeline/timeline-positioning.ts');
const timelineLinkedAudioPath = join(workspaceDir, '_lib/timeline/timeline-linked-audio.ts');
const timelineBuildersPath = join(workspaceDir, '_lib/timeline/timeline-builders.ts');
const timelineIdentitiesPath = join(workspaceDir, '_lib/timeline/timeline-identities.ts');
const timelineSelectionGroupsPath = join(workspaceDir, '_lib/timeline/timeline-selection-groups.ts');
const libraryAssetsPath = join(workspaceDir, '_lib/workspace-library-assets.ts');
const renderEdgesPath = join(workspaceDir, '_lib/workspace-render-edges.ts');
const templatesPath = join(workspaceDir, '_lib/workspace-templates.ts');
const templateCorePath = join(workspaceDir, '_lib/templates/template-core.ts');
const templateRegistryPath = join(workspaceDir, '_lib/templates/registry.ts');
const templateProductAdPath = join(workspaceDir, '_lib/templates/product-ad.ts');
const templateDevBlocksPath = join(workspaceDir, '_lib/templates/dev-blocks.ts');
const templateCharacterDialoguePath = join(workspaceDir, '_lib/templates/character-dialogue.ts');
const templateStoryboardToVideoPath = join(workspaceDir, '_lib/templates/storyboard-to-video.ts');
const templateUgcAdPath = join(workspaceDir, '_lib/templates/ugc-ad.ts');
const templateCinematicScenePath = join(workspaceDir, '_lib/templates/cinematic-scene.ts');
const templateVariantBasePath = join(workspaceDir, '_lib/templates/variant-base.ts');
const workspaceStatePath = join(workspaceDir, '_state/workspace-state.ts');
const workspaceSelectorsPath = join(workspaceDir, '_state/workspace-selectors.ts');
const workspaceSequenceSnapshotPath = join(workspaceDir, '_state/workspace-sequence-snapshot.ts');
const workspaceSequenceOperationsPath = join(workspaceDir, '_state/workspace-sequence-operations.ts');
const workspaceApiPersistencePath = join(workspaceDir, '_state/workspace-api-persistence.ts');
const workspaceSequenceApiPersistencePath = join(workspaceDir, '_state/workspace-sequence-api-persistence.ts');
const workspacePersistencePath = join(workspaceDir, '_state/workspace-persistence.ts');
const workspaceNormalizersPath = join(workspaceDir, '_state/workspace-normalizers.ts');
const editorAssetLibraryHookPath = join(workspaceDir, '_hooks/useWorkspaceEditorAssetLibrary.ts');
const editorNoticeHookPath = join(workspaceDir, '_hooks/useWorkspaceEditorNotice.ts');
const canvasControllerHookPath = join(workspaceDir, '_hooks/useWorkspaceCanvasController.ts');
const canvasGraphStateHookPath = join(workspaceDir, '_hooks/useWorkspaceCanvasGraphState.ts');
const canvasHistoryHookPath = join(workspaceDir, '_hooks/useWorkspaceCanvasHistory.ts');
const pricingHookPath = join(workspaceDir, '_hooks/useWorkspaceShotPricing.ts');
const timelineClipActionsHookPath = join(workspaceDir, '_hooks/useWorkspaceTimelineClipActions.ts');
const timelineHistoryHookPath = join(workspaceDir, '_hooks/useWorkspaceTimelineHistory.ts');
const timelineTrackActionsHookPath = join(workspaceDir, '_hooks/useWorkspaceTimelineTrackActions.ts');
const timelinePlaybackHookPath = join(workspaceDir, '_hooks/useWorkspaceTimelinePlayback.ts');
const timelineSelectionSyncHookPath = join(workspaceDir, '_hooks/useWorkspaceTimelineSelectionSync.ts');
const projectMediaMetadataHydrationHookPath = join(workspaceDir, '_hooks/useWorkspaceProjectMediaMetadataHydration.ts');
const stylesPath = join(workspaceDir, 'maxvideoai-editor.module.css');
const shellStylesPath = join(workspaceDir, '_styles/shell.module.css');
const studioSessionStylesPath = join(workspaceDir, '_styles/studio-session.module.css');
const canvasStylesPath = join(workspaceDir, '_styles/canvas.module.css');
const canvasToolbarStylesPath = join(workspaceDir, '_styles/canvas-toolbar.module.css');
const canvasNavigatorStylesPath = join(workspaceDir, '_styles/canvas-navigator.module.css');
const canvasNodeStylesPath = join(workspaceDir, '_styles/canvas-nodes.module.css');
const canvasMapStylesPath = join(workspaceDir, '_styles/canvas-map.module.css');
const timelineStylesPath = join(workspaceDir, '_styles/timeline.module.css');
const timelineControlStylesPath = join(workspaceDir, '_styles/timeline-controls.module.css');
const timelineClipStylesPath = join(workspaceDir, '_styles/timeline-clips.module.css');
const timelineContextMenuStylesPath = join(workspaceDir, '_styles/timeline-context-menu.module.css');
const inspectorStylesPath = join(workspaceDir, '_styles/inspector.module.css');
const mediaStylesPath = join(workspaceDir, '_styles/media.module.css');
const exportStylesPath = join(workspaceDir, '_styles/export.module.css');
const assetLibraryStylesPath = join(workspaceDir, '_styles/asset-library.module.css');
const viewerStylesPath = join(workspaceDir, '_styles/viewer.module.css');
const visitorAccessPath = join(root, 'frontend/lib/visitor-access.ts');
const appSidebarPath = join(root, 'frontend/components/AppSidebar.tsx');

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

function cssBlock(sourceText: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sourceText.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));
  assert.ok(match, `${selector} should be present in editor CSS`);
  return match[0];
}

function lineCount(sourceText: string): number {
  return sourceText.split(/\r?\n/).length;
}

test('program snapshots only fall back to image-safe preview URLs', async () => {
  const {
    isProgramSnapshotImageUrl,
    resolveProgramSnapshotFallbackSourceUrl,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-program-snapshot');

  assert.equal(isProgramSnapshotImageUrl('/api/media/frame.png'), true, 'snapshot helper should accept ordinary image URLs');
  assert.equal(isProgramSnapshotImageUrl('data:image/jpeg;base64,abc'), true, 'snapshot helper should accept captured image data URLs');
  assert.equal(isProgramSnapshotImageUrl('/api/media/source.mp4'), false, 'snapshot helper should reject video URLs for image nodes');
  assert.equal(
    resolveProgramSnapshotFallbackSourceUrl({
      mediaKind: 'video',
      sourceUrl: '/api/media/source.mp4',
      thumbnailUrl: '/api/media/source-thumb.webp',
    }),
    '/api/media/source-thumb.webp',
    'video snapshots should fall back to their image thumbnail when frame capture is unavailable'
  );
  assert.equal(
    resolveProgramSnapshotFallbackSourceUrl({
      mediaKind: 'image',
      sourceUrl: '/api/media/source.png',
      thumbnailUrl: '/api/media/source-thumb.webp',
    }),
    '/api/media/source.png',
    'image snapshots should keep the visible image source before using a thumbnail'
  );
  assert.equal(
    resolveProgramSnapshotFallbackSourceUrl({
      mediaKind: 'video',
      sourceUrl: '/api/media/source.mp4',
      thumbnailUrl: null,
    }),
    undefined,
    'video snapshots without a captured frame or thumbnail should not create broken image nodes'
  );
});

test('MaxVideoAI editor workspace is an isolated authenticated app route', () => {
  assert.ok(existsSync(pagePath), 'editor workspace route should live under the authenticated /app studio workspace');
  assert.ok(existsSync(studioArchitectureGuidePath), 'studio editor should have an engineering architecture guide for additive changes');
  assert.ok(existsSync(studioAgentsPath), 'studio editor should provide a route-local AGENTS guide for additive feature work');
  assert.ok(existsSync(projectsPagePath), 'studio should expose an upstream projects page before the workspace editor');
  assert.ok(existsSync(projectsClientPath), 'studio projects should keep project creation in a route-local client component');
  assert.ok(existsSync(projectsStylesPath), 'studio projects should keep its start screen styling in a route-local CSS module');
  assert.ok(existsSync(appSidebarPath), 'global app navigation should live in the shared AppSidebar');
  assert.ok(existsSync(dynamicWorkspacePagePath), 'studio should expose /app/studio/workspace/:projectId for project-scoped workspaces');
  assert.ok(existsSync(workspacePagePath), 'editor workspace client orchestrator should be route-local');
  assert.ok(existsSync(studioProjectsApiPath), 'studio projects should expose an authenticated projects API');
  assert.ok(existsSync(studioProjectApiPath), 'studio project workspaces should expose an authenticated project detail API');
  assert.ok(existsSync(studioProjectSequencesApiPath), 'studio projects should expose authenticated sequence list APIs');
  assert.ok(existsSync(studioProjectSequenceApiPath), 'studio projects should expose authenticated sequence mutation APIs');
  assert.ok(existsSync(studioCanvasTemplatesApiPath), 'studio should expose authenticated canvas template APIs');
  assert.ok(existsSync(studioCanvasTemplateApiPath), 'studio should expose authenticated canvas template mutation APIs');
  assert.ok(existsSync(studioChatApiPath), 'Studio chat should use an authenticated route handler');
  assert.ok(existsSync(studioRouteUtilsPath), 'studio route handlers should share auth/database response utilities');
  assert.ok(existsSync(studioServerContractsPath), 'studio server persistence contracts should live under frontend/src/server/studio');
  assert.ok(existsSync(studioChatServerPath), 'Studio chat provider calls should live in server-only Studio code');
  assert.ok(existsSync(studioServerSchemaPath), 'studio server schema helper should live under frontend/src/server/studio');
  assert.ok(existsSync(studioServerRepositoryPath), 'studio server repository should live under frontend/src/server/studio');
  assert.ok(existsSync(studioMigrationPath), 'studio persistence should have a Neon migration');
  assert.ok(existsSync(canvasPath), 'canvas surface should live in a route-local component');
  assert.ok(existsSync(canvasMapPath), 'canvas map should live in a focused route-local canvas component');
  assert.ok(existsSync(canvasHandleDropPreviewPath), 'canvas handle drag preview should live in a focused route-local canvas component');
  assert.ok(existsSync(canvasFloatingToolbarPath), 'canvas creation toolbar should live in a focused route-local canvas component');
  assert.ok(existsSync(canvasPaletteDragPreviewPath), 'canvas palette drag preview should live in a focused route-local canvas component');
  assert.ok(existsSync(canvasControllerPath), 'canvas drop and paste controller should live in a focused route-local controller');
  assert.ok(existsSync(canvasImportActionsHookPath), 'canvas local file, paste, and snapshot imports should live in a focused route-local hook');
  assert.ok(existsSync(canvasTimelineActionsHookPath), 'canvas media timeline actions should live in a focused route-local hook');
  assert.ok(existsSync(canvasTemplateActionsHookPath), 'canvas template actions should live in a focused route-local hook');
  assert.ok(existsSync(generationActionsHookPath), 'shot generation actions should live in a focused route-local hook');
  assert.ok(existsSync(graphActionsHookPath), 'canvas graph mutation actions should live in a focused route-local hook');
  assert.ok(existsSync(renderNodesHookPath), 'workspace render node enrichment should live in a focused route-local hook');
  assert.ok(existsSync(selectionActionsHookPath), 'workspace selection actions should live in a focused route-local hook');
  assert.ok(existsSync(persistenceEffectsHookPath), 'workspace hydration and autosave effects should live in a focused route-local hook');
  assert.ok(existsSync(sequenceActionsHookPath), 'sequence switching and creation actions should live in a focused route-local hook');
  assert.ok(existsSync(sequenceSnapshotsHookPath), 'active sequence snapshots and persisted project state should live in a focused route-local hook');
  assert.ok(existsSync(shellActionsHookPath), 'workspace shell actions should live in a focused route-local hook');
  assert.ok(existsSync(projectMediaActionsHookPath), 'project media mutations should live in a focused route-local hook');
  assert.ok(existsSync(projectMediaControllerPath), 'project media selection, context menu, and drag event wiring should live in a focused route-local controller');
  assert.ok(existsSync(exportControllerPath), 'export job state, polling, and handoff downloads should live in a focused route-local controller');
  assert.ok(existsSync(exportStateHookPath), 'viewer and export derived state should live in a focused route-local hook');
  assert.ok(existsSync(assetLibraryModalPath), 'asset picker modal should live in a route-local editor component');
  assert.ok(existsSync(assetLibraryBrowserPath), 'asset picker browser should mirror the app library structure in a route-local component');
  assert.ok(existsSync(exportDialogPath), 'export dialog should live in a route-local editor component');
  assert.ok(existsSync(runtimeModalsPath), 'workspace runtime modal wiring should live in a route-local component');
  assert.equal(existsSync(legacyLibraryPath), false, 'legacy block template sidebar should stay deleted');
  assert.ok(existsSync(timelineProjectSidebarPath), 'viewer project media sidebar should live in a route-local component');
  assert.ok(existsSync(workspaceMobilePanelControlsPath), 'workspace responsive panel controls should live in a route-local component');
  assert.ok(existsSync(studioHeaderSessionPath), 'studio account and wallet status should live in a route-local component');
  assert.ok(existsSync(workspaceEditorTopbarPath), 'workspace topbar should live in a route-local shell component');
  assert.ok(existsSync(settingsPath), 'node settings panel should live in a route-local component');
  assert.ok(existsSync(shotNodeInspectorPath), 'shot node settings should live in a focused route-local component');
  assert.ok(existsSync(chatInspectorPath), 'chat node inspector should live in a focused route-local component');
  assert.ok(existsSync(nodeInspectorControlsPath), 'node inspector form controls should live in a focused route-local component');
  assert.ok(existsSync(nodeInspectorConnectionsPath), 'node inspector connection list should live in a focused route-local component');
  assert.ok(existsSync(nodeInspectorMediaPreviewPath), 'node inspector media preview should live in a focused route-local component');
  assert.ok(existsSync(timelineClipInspectorPath), 'timeline clip inspector should live in a route-local component');
  assert.ok(existsSync(timelinePath), 'timeline should live in a route-local component');
  assert.ok(existsSync(timelineDropsPath), 'timeline drop compatibility should live in a pure route-local helper');
  assert.ok(existsSync(timelineSelectionPath), 'timeline selection and preview projection helpers should live in a pure route-local helper');
  assert.ok(existsSync(projectMediaDragPath), 'project media timeline drag payloads should live in a pure route-local helper');
  assert.ok(existsSync(projectMediaTimelinePath), 'project media timeline insertion should live in a pure route-local helper');
  assert.ok(existsSync(timelineClipPath), 'timeline clips should live in a focused route-local timeline component');
  assert.ok(existsSync(timelineContextMenusPath), 'timeline context menus should live in a focused route-local timeline component');
  assert.ok(existsSync(timelineContextMenusHookPath), 'timeline context menu state should live in a focused route-local hook');
  assert.ok(existsSync(timelineRulerPath), 'timeline ruler should live in a focused route-local timeline component');
  assert.ok(existsSync(timelineTrackListPath), 'timeline track list should live in a focused route-local timeline component');
  assert.ok(existsSync(timelineTrackRowPath), 'timeline track rows should live in a focused route-local timeline component');
  assert.ok(existsSync(timelineToolbarPath), 'timeline toolbar should live in a focused route-local timeline component');
  assert.ok(existsSync(timelineKeyboardShortcutsPath), 'timeline keyboard shortcuts should live in a focused route-local hook');
  assert.ok(existsSync(timelineClipInteractionHookPath), 'timeline clip drag and resize interactions should live in a focused route-local hook');
  assert.ok(existsSync(timelineExternalDropHookPath), 'timeline external drop state should live in a focused route-local hook');
  assert.ok(existsSync(timelinePanelResizeHookPath), 'timeline panel resize behavior should live in a focused route-local hook');
  assert.ok(existsSync(timelinePlayheadDragHookPath), 'timeline playhead drag behavior should live in a focused route-local hook');
  assert.ok(existsSync(timelinePreviewItemsHookPath), 'timeline preview projection should live in a focused route-local hook');
  assert.ok(existsSync(timelineSurfaceSelectionHookPath), 'timeline empty-surface selection should live in a focused route-local hook');
  assert.ok(existsSync(timelineVisibleRangeHookPath), 'timeline visible range scheduling should live in a focused route-local hook');
  assert.ok(existsSync(timelineTrackDefinitionsPath), 'timeline track definitions should live in a focused route-local helper');
  assert.ok(existsSync(videoViewerPath), 'video montage viewer should live in a route-local component');
  assert.ok(existsSync(programMonitorPath), 'program monitor frame and zoom should live in a route-local viewer component');
  assert.ok(existsSync(programPlaybackLayersPath), 'program media layers should live in a route-local viewer component');
  assert.ok(existsSync(programControlsPath), 'program playback controls should live in a route-local viewer component');
  assert.ok(existsSync(programPlaybackSyncPath), 'program playback synchronization should live in a route-local viewer hook');
  assert.ok(existsSync(nodeTypesPath), 'custom node renderers should live in a route-local node module');
  assert.ok(existsSync(nodeFramePath), 'shared node frame behavior should live in a focused route-local node component');
  assert.ok(existsSync(nodeMediaPreviewPath), 'custom node media previews should live in a focused route-local node component');
  assert.ok(existsSync(edgeTypesPath), 'custom edge renderers should live in a route-local edge module');
  assert.ok(existsSync(stylesPath), 'editor styling should be isolated in a route-local CSS module');
  assert.ok(existsSync(shellStylesPath), 'editor shell styles should live in a focused route-local CSS module');
  assert.ok(existsSync(studioSessionStylesPath), 'Studio header session styles should live in a focused route-local CSS module');
  assert.ok(existsSync(canvasStylesPath), 'canvas surface styles should live in a focused route-local CSS module');
  assert.ok(existsSync(canvasNavigatorPanelPath), 'canvas navigator should live in a focused route-local canvas component');
  assert.ok(existsSync(canvasNavigatorStylesPath), 'canvas navigator styles should live in a focused route-local CSS module');
  assert.equal(existsSync(join(workspaceDir, '_styles/canvas-library.module.css')), false, 'legacy canvas library sidebar CSS should stay deleted');
  assert.ok(existsSync(canvasMapStylesPath), 'canvas map styles should live in a focused route-local CSS module');
  assert.ok(existsSync(timelineStylesPath), 'timeline styles should live in a focused route-local CSS module');
  assert.ok(existsSync(timelineControlStylesPath), 'timeline toolbar and control styles should live in a focused route-local CSS module');
  assert.ok(existsSync(timelineContextMenuStylesPath), 'timeline context menu styles should live in a focused route-local CSS module');
  assert.ok(existsSync(inspectorStylesPath), 'inspector styles should live in a focused route-local CSS module');
  assert.ok(existsSync(mediaStylesPath), 'project media styles should live in a focused route-local CSS module');
  assert.ok(existsSync(exportStylesPath), 'export dialog styles should live in a focused route-local CSS module');
  assert.ok(existsSync(assetLibraryStylesPath), 'asset picker browser styles should live in a focused route-local CSS module');
  assert.ok(existsSync(viewerStylesPath), 'program viewer styles should live in a focused route-local CSS module');

  const pageSource = source(pagePath);
  const rootAgentsSource = source(rootAgentsPath);
  const studioArchitectureGuideSource = source(studioArchitectureGuidePath);
  const studioAgentsSource = source(studioAgentsPath);
  const projectsPageSource = source(projectsPagePath);
  const projectsClientSource = source(projectsClientPath);
  const projectsStylesSource = source(projectsStylesPath);
  const appSidebarSource = source(appSidebarPath);
  const dynamicWorkspacePageSource = source(dynamicWorkspacePagePath);
  const workspaceSource = source(workspacePagePath);
  const workspaceStateSource = source(workspaceStatePath);
  const workspaceSequenceOperationsSource = source(workspaceSequenceOperationsPath);
  const workspaceApiPersistenceSource = source(workspaceApiPersistencePath);
  const workspaceSequenceApiPersistenceSource = source(workspaceSequenceApiPersistencePath);
  const canvasSource = source(canvasPath);
  const canvasFloatingToolbarSource = source(canvasFloatingToolbarPath);
  const canvasNavigatorPanelSource = source(canvasNavigatorPanelPath);
  const canvasControllerHookSource = source(canvasControllerHookPath);
  const canvasGraphStateHookSource = source(canvasGraphStateHookPath);
  const canvasTimelineActionsHookSource = source(canvasTimelineActionsHookPath);
  const canvasTemplateActionsHookSource = source(canvasTemplateActionsHookPath);
  const selectionActionsHookSource = source(selectionActionsHookPath);
  const persistenceEffectsHookSource = source(persistenceEffectsHookPath);
  const sequenceActionsHookSource = source(sequenceActionsHookPath);
  const sequenceSnapshotsHookSource = source(sequenceSnapshotsHookPath);
  const renderNodesHookSource = source(renderNodesHookPath);
  const shellActionsHookSource = source(shellActionsHookPath);
  const projectMediaActionsHookSource = source(projectMediaActionsHookPath);
  const projectMediaMetadataHydrationHookSource = source(projectMediaMetadataHydrationHookPath);
  const projectMediaControllerSource = source(projectMediaControllerPath);
  const exportControllerSource = source(exportControllerPath);
  const exportStateHookSource = source(exportStateHookPath);
  const exportDialogSource = source(exportDialogPath);
  const studioHeaderSessionSource = source(studioHeaderSessionPath);
  const workspaceEditorLayoutSource = source(workspaceEditorLayoutPath);
  const workspaceMobilePanelControlsSource = source(workspaceMobilePanelControlsPath);
  const workspaceEditorTopbarSource = source(workspaceEditorTopbarPath);
  const nodeFrameSource = source(nodeFramePath);
  const templateRegistrySource = source(templateRegistryPath);
  const templateProductAdSource = source(templateProductAdPath);
  const styleSource = source(stylesPath);
  const shellStyleSource = source(shellStylesPath);
  const studioSessionStyleSource = source(studioSessionStylesPath);
  const canvasStyleSource = source(canvasStylesPath);
  const canvasToolbarStyleSource = source(canvasToolbarStylesPath);
  const canvasNavigatorStyleSource = source(canvasNavigatorStylesPath);
  const canvasNodeStyleSource = source(canvasNodeStylesPath);
  const canvasMapStyleSource = source(canvasMapStylesPath);
  const timelineStyleSource = source(timelineStylesPath);
  const timelineControlStyleSource = source(timelineControlStylesPath);
  const timelineClipStyleSource = source(timelineClipStylesPath);
  const timelineContextMenuStyleSource = source(timelineContextMenuStylesPath);
  const inspectorStyleSource = source(inspectorStylesPath);
  const exportStyleSource = source(exportStylesPath);
  const assetLibraryStyleSource = source(assetLibraryStylesPath);
  const projectMediaMetadataSource = source(projectMediaMetadataPath);
  assert.match(studioAgentsSource, /docs\/engineering\/studio-editor-architecture\.md/, 'studio AGENTS guide should point agents to the Studio architecture guide');
  assert.match(studioArchitectureGuideSource, /Product Entities/, 'studio architecture guide should define product entities');
  assert.match(studioArchitectureGuideSource, /Ownership Map/, 'studio architecture guide should map Studio ownership boundaries');
  assert.match(studioArchitectureGuideSource, /Additive Change Checklist/, 'studio architecture guide should define additive change review questions');
  assert.match(studioArchitectureGuideSource, /Add A Canvas Block/, 'studio architecture guide should explain additive block work');
  assert.match(studioArchitectureGuideSource, /Add A Generation Model/, 'studio architecture guide should explain additive model capability work');
  assert.match(studioArchitectureGuideSource, /Add A Sequence Or Project Media Operation/, 'studio architecture guide should explain additive Project media and sequence work');
  assert.match(studioArchitectureGuideSource, /Render Worker Boundary/, 'studio architecture guide should define the MP4 render worker boundary');
  assert.match(studioArchitectureGuideSource, /State And Performance Contracts/, 'studio architecture guide should define state and performance contracts');
  assert.match(studioArchitectureGuideSource, /Responsive Surface Rules/, 'studio architecture guide should define responsive surface ownership rules');
  assert.match(studioArchitectureGuideSource, /Media Metadata Rules/, 'studio architecture guide should define timeline-safe media metadata rules');
  assert.match(studioArchitectureGuideSource, /Shell Action Placement/, 'studio architecture guide should define header and timeline action placement');
  assert.match(studioAgentsSource, /Ownership Map and Additive Change Checklist/, 'studio AGENTS guide should route agents through the architecture ownership checklist');
  assert.match(studioAgentsSource, /Responsive shell changes/, 'studio AGENTS guide should document responsive shell change ownership');
  assert.match(studioAgentsSource, /media metadata hydration/, 'studio AGENTS guide should document metadata hydration ownership');
  assert.match(studioAgentsSource, /Export belongs to the timeline toolbar/, 'studio AGENTS guide should document export action placement');
  assert.match(rootAgentsSource, /docs\/engineering\/studio-editor-architecture\.md/, 'root AGENTS guide should route Studio work to the Studio architecture guide');
  assert.match(rootAgentsSource, /frontend\/app\/\(core\)\/\(workspace\)\/app\/studio\/AGENTS\.md/, 'root AGENTS guide should mention the route-local Studio AGENTS guide');
  assert.match(studioAgentsSource, /workspace\/_state\/workspace-sequence-operations\.ts/, 'studio AGENTS guide should keep sequence list behavior in the sequence operations helper');
  assert.match(studioAgentsSource, /API \+ worker orchestration/, 'studio AGENTS guide should keep server MP4 export behind API and worker orchestration');
  assert.match(studioArchitectureGuideSource, /Add A Canvas Template/, 'studio architecture guide should explain additive template work');
  assert.match(studioArchitectureGuideSource, /Add Timeline Behavior/, 'studio architecture guide should route timeline behavior through pure helpers');
  assert.match(studioArchitectureGuideSource, /Add Export Behavior/, 'studio architecture guide should define server export behavior');
  assert.match(studioArchitectureGuideSource, /Performance Rules/, 'studio architecture guide should define interaction performance rules');
  assert.match(studioAgentsSource, /Project.*Sequence.*Canvas template/s, 'studio AGENTS guide should document the product entities');
  assert.match(studioAgentsSource, /Additive Rules/, 'studio AGENTS guide should document additive implementation rules');
  assert.match(studioAgentsSource, /Applying a canvas template must never reset the timeline/, 'studio AGENTS guide should preserve canvas/timeline separation');
  assert.match(studioAgentsSource, /workspace-capabilities\.ts/, 'studio AGENTS guide should direct model changes through capability contracts');
  assert.match(studioAgentsSource, /workspace-timeline-editing\.ts/, 'studio AGENTS guide should direct timeline changes through pure helpers');
  assert.match(pageSource, /from '\.\/WorkspacePage\.client'/, 'route should delegate to the editor workspace orchestrator');
  assert.match(projectsPageSource, /StudioProjectsPageClient/, 'projects route should delegate to a route-local project creation client');
  assert.match(projectsPageSource, /HeaderBar/, 'projects route should keep the normal app header before entering the editor workspace');
  assert.match(projectsPageSource, /AppSidebar/, 'projects route should keep the normal app sidebar before entering the editor workspace');
  assert.match(appSidebarSource, /id:\s*'studio'[\s\S]*href:\s*'\/app\/studio\/projects'/, 'global app navigation should expose Studio project selection');
  assert.match(projectsClientSource, /STUDIO_PROJECTS_STORAGE_KEY/, 'projects client should keep a local draft fallback');
  assert.match(projectsClientSource, /\/api\/studio\/projects/, 'projects client should sync projects with the Studio API when available');
  assert.match(projectsClientSource, /authFetch/, 'projects client should use authenticated fetches for project sync');
  assert.match(projectsClientSource, /router\.push\(`\/app\/studio\/workspace\/\$\{savedProject\?\.id \?\? project\.id\}`\)/, 'new projects should open a project-scoped workspace URL after API sync or local fallback');
  assert.match(projectsClientSource, /DEFAULT_STUDIO_PROJECT_TEMPLATE_ID/, 'project creation should keep an internal starter canvas default without exposing template picking');
  assert.match(projectsClientSource, /styles\.newProjectLaunchCard/, 'studio projects should expose direct blank-project creation');
  assert.match(projectsClientSource, /styles\.openProjectButton/, 'studio projects should expose a direct open-project action');
  assert.doesNotMatch(projectsClientSource, /visibleTemplates|setCanvasTemplateId|canvasTemplateLabel|browseTemplates|templatePicker/, 'studio projects should not expose canvas template picking on the start screen');
  assert.doesNotMatch(projectsClientSource, /useStudioThemeMode|data-studio-theme/, 'studio projects should follow the app theme instead of the editor workspace dark default');
  assert.match(projectsStylesSource, /\.projectsHeaderBar/, 'studio projects should render a minimal brand/action header inside the start screen');
  assert.match(projectsStylesSource, /\.newProjectLaunchCard[\s\S]*border:\s*1px dashed/, 'blank project creation should be styled as a large dashed launch card');
  assert.match(projectsClientSource, /DEFAULT_WORKSPACE_PROJECT_SETTINGS/, 'project creation should use hidden sequence defaults instead of project-level video settings controls');
  assert.doesNotMatch(projectsClientSource, /setAspectRatio|setResolution|setFps/, 'project creation should not expose sequence settings as project form state');
  assert.match(dynamicWorkspacePageSource, /WorkspacePage projectId=\{projectId\}/, 'dynamic workspace route should pass the project id into the editor client');
  assert.doesNotMatch(pageSource, /AppClient/, 'editor route must not reuse the existing video workspace AppClient');
  assert.ok(lineCount(workspaceSource) <= 500, 'workspace orchestrator should stay under the route composition threshold');
  assert.ok(lineCount(workspaceEditorLayoutSource) <= 500, 'workspace editor layout should stay under the focused component threshold');
  assert.match(workspaceSource, /WorkspaceEditorLayout/, 'orchestrator should delegate editor surface rendering to a route-local layout component');
  assert.match(workspaceEditorLayoutSource, /WorkspaceCanvas/, 'editor layout should compose the canvas surface');
  assert.match(workspaceEditorLayoutSource, /WorkspaceVideoViewer/, 'editor layout should compose a central montage video viewer');
  assert.doesNotMatch(workspaceEditorLayoutSource, /NodeLibrarySidebar/, 'editor layout should not mount the old canvas sidebar in Canvas mode');
  assert.match(canvasSource, /CanvasFloatingToolbar/, 'canvas surface should compose the floating block toolbar');
  assert.match(canvasSource, /CanvasNavigatorPanel/, 'canvas surface should compose the project canvas navigator outside the toolbar');
  assert.match(workspaceEditorLayoutSource, /TimelineProjectSidebar/, 'editor layout should compose a project media sidebar for Viewer mode');
  assert.match(workspaceEditorLayoutSource, /WorkspaceMobilePanelControls/, 'editor layout should delegate mobile panel toggle UI to a focused component');
  assert.match(workspaceEditorLayoutSource, /type MobileWorkspacePanel = 'media' \| 'inspector' \| null/, 'editor layout should model the responsive side panels as explicit mobile-only state');
  assert.match(workspaceEditorLayoutSource, /data-mobile-panel=\{mobileWorkspacePanel \?\? 'closed'\}/, 'editor body should expose the active mobile panel state for responsive styling');
  assert.match(workspaceEditorLayoutSource, /styles\.projectMediaPanelSlot/, 'project media sidebar should sit in a responsive panel slot');
  assert.match(workspaceEditorLayoutSource, /styles\.inspectorPanelSlot/, 'canvas and viewer inspectors should share a responsive panel slot');
  assert.match(workspaceMobilePanelControlsSource, /aria-expanded=\{activePanel === 'media'\}/, 'mobile media toggle should expose expanded state to assistive tech');
  assert.match(workspaceMobilePanelControlsSource, /aria-controls="studio-project-media-panel"/, 'mobile media toggle should target the media drawer');
  assert.match(workspaceMobilePanelControlsSource, /aria-expanded=\{activePanel === 'inspector'\}/, 'mobile inspector toggle should expose expanded state to assistive tech');
  assert.match(workspaceMobilePanelControlsSource, /aria-controls="studio-inspector-panel"/, 'mobile inspector toggle should target the inspector drawer');
  assert.match(workspaceEditorLayoutSource, /WorkspaceEditorTopbar/, 'editor layout should delegate the header to a route-local shell component');
  assert.doesNotMatch(workspaceSource, /StudioHeaderSession/, 'orchestrator should not own Studio session and wallet header composition inline');
  assert.match(workspaceEditorTopbarSource, /StudioHeaderSession/, 'workspace topbar should compose Studio session and wallet status in the header');
  assert.match(workspaceEditorTopbarSource, /onEditorSurfaceChange\('timeline'\)/, 'workspace topbar should switch Viewer mode into timeline editing surface');
  assert.match(workspaceEditorLayoutSource, /from '\.\.\/_styles\/shell\.module\.css'/, 'workspace shell layout should import focused shell CSS');
  assert.match(studioHeaderSessionSource, /from '\.\.\/_styles\/studio-session\.module\.css'/, 'Studio header session should import focused session CSS directly');
  assert.doesNotMatch(canvasFloatingToolbarSource, /canvas-library\.module\.css/, 'canvas floating toolbar should not import legacy canvas library CSS');
  assert.match(shellStyleSource, /\.editorShell/, 'shell CSS should own the editor shell layout');
  assert.match(canvasToolbarStyleSource, /\.blockOptionList/, 'canvas toolbar CSS should own block template list styling');
  assert.match(canvasNavigatorStyleSource, /\.templateGrid/, 'canvas navigator CSS should own canvas template grid styling');
  assert.match(canvasNodeStyleSource, /\.graphNode/, 'canvas node CSS should own workspace node card styling');
  assert.match(timelineStyleSource, /\.timelinePanel/, 'timeline CSS should own the timeline panel layout');
  assert.match(timelineControlStyleSource, /\.timelineTopbar/, 'timeline control CSS should own the timeline toolbar layout');
  assert.match(timelineClipStyleSource, /\.timelineClip/, 'timeline clip CSS should own clip card styling');
  assert.match(timelineContextMenuStyleSource, /\.timelineContextMenu/, 'timeline context menu CSS should own context menu card styling');
  assert.match(shellStyleSource, /\.editorTopbar/, 'shell CSS should own the topbar layout');
  assert.match(shellStyleSource, /\.editorBody/, 'shell CSS should own the main body grid');
  assert.match(shellStyleSource, /\.mobilePanelRail/, 'shell CSS should own mobile panel controls');
  assert.match(shellStyleSource, /\.mobilePanelBackdrop/, 'shell CSS should own the mobile panel backdrop');
  assert.match(shellStyleSource, /\.projectMediaPanelSlot/, 'shell CSS should own the project media responsive slot');
  assert.match(shellStyleSource, /\.inspectorPanelSlot/, 'shell CSS should own the inspector responsive slot');
  assert.match(shellStyleSource, /@media \(max-width:\s*900px\)[\s\S]*\.editorBody[\s\S]*grid-template-columns:\s*1fr/, 'mobile workspace should keep the central editor as a single-column primary surface');
  assert.match(shellStyleSource, /@media \(max-width:\s*900px\)[\s\S]*\.mobilePanelOpen[\s\S]*pointer-events:\s*auto/, 'mobile panels should open as overlays instead of compressing the editor columns');
  assert.doesNotMatch(inspectorStyleSource, /@media \(max-width:\s*980px\)[\s\S]*display:\s*none/, 'mobile inspector should remain available through the responsive drawer instead of disappearing');
  assert.match(studioSessionStyleSource, /\.studioWalletPill/, 'Studio session CSS should own wallet header styles');
  assert.match(studioSessionStyleSource, /\.studioSessionPill/, 'Studio session CSS should own account session styles');
  assert.doesNotMatch(shellStyleSource, /\.studioWalletPill/, 'shell CSS should no longer own wallet header styles');
  assert.doesNotMatch(shellStyleSource, /\.studioSessionPill/, 'shell CSS should no longer own account session styles');
  assert.match(shellStyleSource, /\.viewerFocus/, 'shell CSS should own Viewer-mode shell grid rules');
  assert.doesNotMatch(styleSource, /\.editorShell/, 'main editor CSS should no longer own shell layout after modularization');
  assert.doesNotMatch(styleSource, /\.editorTopbar/, 'main editor CSS should no longer own topbar layout after modularization');
  assert.doesNotMatch(styleSource, /\.blockOptionList/, 'main editor CSS should no longer own canvas block template toolbar styles after modularization');
  assert.doesNotMatch(styleSource, /\.templateButton/, 'main editor CSS should no longer own canvas template button styles after modularization');
  assert.doesNotMatch(styleSource, /\.timelinePanel/, 'main editor CSS should no longer own timeline panel styles after modularization');
  assert.doesNotMatch(styleSource, /\.studioWalletPill/, 'main editor CSS should no longer own wallet header styles after modularization');
  assert.doesNotMatch(styleSource, /\.studioSessionPill/, 'main editor CSS should no longer own account header styles after modularization');
  assert.doesNotMatch(styleSource, /\.viewerFocus \.librarySidebar/, 'main CSS should not own Viewer sidebar compatibility rules after sidebar style extraction');
  assert.doesNotMatch(styleSource, /\.viewerFocus \.panelSubtitle/, 'main CSS should not own Viewer panel subtitle compatibility rules after sidebar style extraction');
  assert.match(studioHeaderSessionSource, /useHeaderAccountState/, 'Studio header session should reuse the shared account and wallet state hook');
  assert.match(studioHeaderSessionSource, /walletPromptOpen/, 'Studio wallet status should open a top-up prompt inside the editor header');
  assert.match(studioHeaderSessionSource, /studioCopy\.topbar\.walletTopUpCta/, 'Studio wallet prompt should render route-local Studio copy from the topbar owner');
  assert.doesNotMatch(studioHeaderSessionSource, /useI18n\(/, 'Studio header session should not resolve localized copy independently of its topbar owner');
  assert.match(studioHeaderSessionSource, /href="\/billing"/, 'Studio wallet prompt CTA should link to billing top-up');
  assert.match(studioHeaderSessionSource, /NAV_ITEMS\.map/, 'Studio session pill should expose the same account navigation menu as the main app');
  assert.match(studioHeaderSessionSource, /handleSignOut/, 'Studio session menu should keep the shared sign-out action inside the account menu');
  assert.match(studioHeaderSessionSource, /aria-label=\{studioCopy\.topbar\.exitToProjects\}/, 'Studio header exit control should return to project selection instead of signing out');
  assert.match(workspaceEditorTopbarSource, /<StudioHeaderSession[\s\S]*studioCopy=\{studioCopy\}/, 'Studio header session should receive route-local Studio copy from the topbar owner');
  assert.doesNotMatch(studioHeaderSessionSource, /aria-label="Sign out of Studio"/, 'Studio header should not expose a direct sign-out button beside the session pill');
  assert.doesNotMatch(workspaceSource, /aria-label="Share project"/, 'Studio header should not expose inactive share controls');
  assert.doesNotMatch(workspaceSource, /aria-label="Generate selected shot"/, 'Studio header should not expose an inactive global generation control');
  assert.match(workspaceEditorLayoutSource, /onExitToProjects=\{shell\.handleExitToProjects\}/, 'editor layout should wire the save-and-return-to-projects action into the header');
  assert.match(workspaceSource, /useWorkspaceShellActions/, 'workspace should delegate shell-level actions to a route-local hook');
  assert.match(exportStateHookSource, /export function useWorkspaceExportState/, 'workspace export state hook should expose a focused orchestration boundary');
  assert.match(shellActionsHookSource, /window\.location\.assign\('\/app\/studio\/projects'\)/, 'workspace exit should navigate to the Studio projects page');
  assert.match(shellActionsHookSource, /saveStudioWorkspaceToApi/, 'workspace shell action hook should save project plus sequences before returning to projects');
  assert.match(workspaceEditorLayoutSource, /focusMode === 'viewer'[\s\S]*TimelineProjectSidebar/, 'Viewer mode should own the project media sidebar');
  assert.match(workspaceEditorLayoutSource, /canvasEditorBody/, 'Canvas mode should use a widened body grid with no left template sidebar');
  assert.match(workspaceSource, /workspaceStorageKeyForProject/, 'workspace persistence should be scoped by project id when present');
  assert.doesNotMatch(workspaceSource, /from '@\/lib\/authFetch'/, 'workspace orchestrator should not own Studio API fetch plumbing');
  assert.match(workspaceApiPersistenceSource, /authFetch/, 'Studio API persistence should own authenticated API fetches');
  assert.match(workspaceApiPersistenceSource, /normalizePersistedWorkspaceState/, 'Studio API persistence should own persisted workspace state normalization');
  assert.match(workspaceApiPersistenceSource, /workspace-sequence-api-persistence/, 'Studio API persistence should delegate sequence network sync to a focused helper');
  assert.match(workspaceSource, /useWorkspacePersistenceEffects/, 'workspace should delegate hydration and autosave side effects to a route-local hook');
  assert.match(persistenceEffectsHookSource, /readStudioProject\(projectId\)/, 'workspace persistence hook should hydrate new project settings from the local project fallback');
  assert.match(persistenceEffectsHookSource, /readStudioProjectFromApi\(projectId/, 'workspace persistence hook should hydrate project state from the Studio API when available');
  assert.match(persistenceEffectsHookSource, /readStudioSequencesFromApi\(projectId/, 'workspace persistence hook should hydrate server sequence records when available');
  assert.match(persistenceEffectsHookSource, /shouldApplyStudioProjectWorkspaceState/, 'workspace persistence hook should ignore stripped project timeline snapshots when sequence hydration is unavailable');
  assert.match(persistenceEffectsHookSource, /mergePersistedWorkspaceWithServerSequences/, 'workspace persistence hook should merge server sequences into project state instead of using two timeline sources');
  assert.match(persistenceEffectsHookSource, /saveStudioWorkspaceToApi/, 'workspace persistence hook should autosave project and sequence state through one API boundary');
  assert.match(workspaceSequenceApiPersistenceSource, /saveStudioSequencesToApi/, 'Studio sequence API persistence should own sequence record synchronization');
  assert.match(workspaceSequenceApiPersistenceSource, /readStudioSequencesFromApi/, 'Studio sequence API persistence should own sequence hydration requests');
  assert.match(workspaceSequenceApiPersistenceSource, /workspaceSequenceTimelineState/, 'Studio sequence API persistence should serialize sequence timeline state');
  assert.match(workspaceSequenceApiPersistenceSource, /\/sequences/, 'Studio sequence API persistence should own sequence API endpoints');
  assert.match(workspaceApiPersistenceSource, /stripWorkspaceSequencesForProjectApi/, 'Studio API persistence should strip timeline records from project workspaceState after sequence sync succeeds');
  assert.match(workspaceApiPersistenceSource, /shouldApplyStudioProjectWorkspaceState/, 'Studio API persistence should define stripped workspace fallback rules');
  assert.match(workspaceApiPersistenceSource, /mergePersistedWorkspaceWithServerSequences/, 'Studio API persistence should define the sequence merge rule');
  assert.match(workspaceStateSource, /savedCanvases\?: WorkspaceUserCanvasTemplate\[\]/, 'workspace state should persist project-scoped saved canvases');
  assert.match(workspaceStateSource, /activeCanvasId\?: string \| null/, 'workspace state should persist the active project canvas id');
  assert.match(sequenceSnapshotsHookSource, /savedCanvases/, 'workspace autosave should include project-scoped saved canvases');
  assert.doesNotMatch(persistenceEffectsHookSource, /readUserCanvasTemplatesFromApi/, 'workspace persistence should not hydrate project canvases from global template APIs');
  assert.doesNotMatch(workspaceSource, /readStudioProjectFromApi\(projectId/, 'workspace orchestrator should not own project API hydration');
  assert.doesNotMatch(workspaceSource, /readUserCanvasTemplatesFromApi/, 'workspace orchestrator should not own user canvas template hydration');
  assert.match(workspaceSource, /useWorkspaceCanvasController/, 'workspace should delegate canvas orchestration to a route-local controller hook');
  assert.match(canvasControllerHookSource, /useWorkspaceCanvasTemplateActions/, 'canvas controller should delegate user canvas template actions to the template actions hook');
  assert.doesNotMatch(canvasTemplateActionsHookSource, /saveUserCanvasTemplateToApi/, 'project canvas actions should persist through workspace autosave instead of the global template API');
  assert.doesNotMatch(canvasTemplateActionsHookSource, /deleteUserCanvasTemplateFromApi/, 'project canvas deletion should persist through workspace autosave instead of the global template API');
  assert.doesNotMatch(canvasTemplateActionsHookSource, /writeUserCanvasTemplates/, 'project canvas actions should not write global personal template fallback storage');
  assert.match(templateRegistrySource, /WorkspaceTemplateBuildCopy/, 'starter template registry should keep optional copy context backward-compatible');
  assert.match(templateProductAdSource, /copy\?: WorkspaceTemplateBuildCopy/, 'Product Ad starter template should keep optional copy compatibility');
  assert.match(templateProductAdSource, /localizeWorkspaceTemplateGeneratedState/, 'Product Ad optional copy should localize generated display fields through provenance');
  assert.match(workspaceSource, /createStarterWorkspaceTemplate\('product-ad'\)/, 'workspace defaults should create canonical starter template state');
  assert.doesNotMatch(canvasTemplateActionsHookSource, /studioCanvasNodeCopy/, 'canvas template actions should not persist locale-formatted starter state');
  assert.match(canvasTemplateActionsHookSource, /createStarterWorkspaceTemplate\(templateId\)/, 'canvas template actions should apply canonical starter templates');
  assert.match(persistenceEffectsHookSource, /createStarterWorkspaceTemplate\(project\.canvasTemplateId \?\? 'product-ad'\)/, 'project hydration should seed canonical starter templates');
  assert.doesNotMatch(workspaceSource, /saveUserCanvasTemplateToApi/, 'workspace orchestrator should not own user canvas template API mutations');
  assert.match(workspaceSource, /from '\.\/_state\/workspace-state'/, 'workspace should import persisted state contracts from the route-local state module');
  assert.match(workspaceSource, /from '\.\/_state\/workspace-selectors'/, 'workspace should import derived sequence selectors from the route-local state module');
  assert.match(workspaceStateSource, /function createWorkspaceSequenceRecord/, 'workspace state module should own sequence record creation');
  assert.match(workspaceStateSource, /function normalizeWorkspaceSequenceRecord/, 'workspace state module should own sequence persistence normalization');
  assert.match(workspaceStateSource, /function upsertWorkspaceSequence/, 'workspace state module should own sequence list updates');
  assert.match(workspaceStateSource, /function deleteWorkspaceTimelineTrackItems/, 'workspace state module should own timeline track deletion retargeting');
  assert.match(workspaceSource, /activeSequenceId/, 'workspace should track the active montage sequence');
  assert.match(workspaceSource, /useWorkspaceSequenceSnapshots/, 'workspace should delegate live sequence snapshots and autosave state to a route-local hook');
  assert.match(sequenceSnapshotsHookSource, /sequences: upsertWorkspaceSequence/, 'workspace autosave should include every project sequence');
  assert.match(sequenceSnapshotsHookSource, /buildPersistedWorkspaceState/, 'sequence snapshot hook should expose the persisted project state builder');
  assert.match(workspaceSource, /useWorkspaceSequenceActions/, 'workspace should delegate sequence switching and creation actions to a route-local hook');
  assert.match(workspaceSource, /useWorkspaceProjectMediaActions/, 'workspace should delegate project media mutations to a route-local hook');
  assert.match(workspaceEditorLayoutSource, /onNewSequence=\{sequence\.handleCreateSequence\}/, 'viewer project sidebar should create real empty sequences');
  assert.match(workspaceEditorLayoutSource, /onSelectSequence=\{sequence\.handleSelectSequence\}/, 'viewer project sidebar should switch between stored sequences');
  assert.doesNotMatch(workspaceSource, /const handleCreateSequence = useCallback/, 'workspace orchestrator should not own sequence creation internals');
  assert.doesNotMatch(workspaceSource, /const handleSelectSequence = useCallback/, 'workspace orchestrator should not own sequence switching internals');
  assert.doesNotMatch(workspaceSource, /const handleRenameActiveSequence = useCallback/, 'workspace orchestrator should not own sequence rename internals');
  assert.match(sequenceActionsHookSource, /applyWorkspaceSequence/, 'sequence action hook should apply sequence state into the active timeline');
  assert.match(sequenceActionsHookSource, /handleCreateSequence/, 'sequence action hook should create real empty sequences');
  assert.match(sequenceActionsHookSource, /handleSelectSequence/, 'sequence action hook should switch between stored sequences');
  assert.match(sequenceActionsHookSource, /handleRenameActiveSequence/, 'sequence action hook should own active sequence renames');
  assert.match(sequenceActionsHookSource, /upsertWorkspaceSequence/, 'sequence action hook should preserve the current sequence before switching');
  assert.match(sequenceActionsHookSource, /handleDuplicateSequence/, 'sequence action hook should own sequence duplication');
  assert.match(sequenceActionsHookSource, /handleDeleteSequence/, 'sequence action hook should own sequence deletion');
  assert.match(sequenceActionsHookSource, /handleDeleteSequences/, 'sequence action hook should own bulk sequence deletion');
  assert.match(sequenceActionsHookSource, /createWorkspaceSequenceDuplicate/, 'sequence action hook should delegate duplication record creation to the pure state helper');
  assert.match(sequenceActionsHookSource, /resolveWorkspaceSequenceDelete/, 'sequence action hook should delegate delete fallback decisions to the pure state helper');
  assert.match(sequenceActionsHookSource, /resolveWorkspaceSequenceBulkDelete/, 'sequence action hook should delegate bulk delete fallback decisions to the pure state helper');
  assert.match(workspaceSequenceOperationsSource, /export function createWorkspaceSequenceDuplicate/, 'sequence operations helper should own duplicate sequence record creation');
  assert.match(workspaceSequenceOperationsSource, /export function resolveWorkspaceSequenceDelete/, 'sequence operations helper should own delete fallback resolution');
  assert.match(workspaceSequenceOperationsSource, /export function resolveWorkspaceSequenceBulkDelete/, 'sequence operations helper should own bulk delete fallback resolution');
  assert.match(workspaceEditorLayoutSource, /onDeleteSequence=\{sequence\.handleDeleteSequence\}/, 'viewer project sidebar should delete sequences through sequence actions');
  assert.match(workspaceEditorLayoutSource, /onDeleteSequences=\{sequence\.handleDeleteSequences\}/, 'viewer project sidebar should bulk-delete sequences through sequence actions');
  assert.match(workspaceEditorLayoutSource, /onDuplicateSequence=\{sequence\.handleDuplicateSequence\}/, 'viewer project sidebar should duplicate sequences through sequence actions');
  assert.match(projectMediaControllerSource, /type: 'asset' \| 'folder' \| 'generated' \| 'sequence'/, 'project media controller should treat sequences and folders as first-class selectable project media items');
  assert.match(projectMediaActionsHookSource, /resolveProjectAssetTimelineInsert/, 'project media action hook should route asset insertion through the pure timeline helper');
  assert.match(projectMediaActionsHookSource, /handleImportProjectMedia/, 'project media action hook should open the import picker');
  assert.match(projectMediaActionsHookSource, /handleDeleteProjectAsset/, 'project media action hook should own imported asset deletion');
  assert.match(projectMediaActionsHookSource, /handleDeleteProjectAssets/, 'project media action hook should own bulk imported asset deletion');
  assert.match(projectMediaActionsHookSource, /handleDeleteGeneratedClip/, 'project media action hook should own generated media deletion');
  assert.match(projectMediaActionsHookSource, /handleDeleteGeneratedClips/, 'project media action hook should own bulk generated media deletion');
  assert.match(projectMediaActionsHookSource, /handleDeleteProjectMediaFolders/, 'project media action hook should own bulk project media folder deletion');
  assert.match(projectMediaActionsHookSource, /handleDropProjectAssetToTimeline/, 'project media action hook should own Project media drops to the timeline');
  assert.doesNotMatch(workspaceSource, /const handleImportProjectMedia = useCallback/, 'workspace orchestrator should not own Project media import internals');
  assert.doesNotMatch(workspaceSource, /const handleDeleteProjectAsset = useCallback/, 'workspace orchestrator should not own Project media deletion internals');
  assert.doesNotMatch(workspaceSource, /const handleDropProjectAssetToTimeline = useCallback/, 'workspace orchestrator should not own Project media timeline drop internals');
  assert.match(persistenceEffectsHookSource, /emptyTimelineItems: WorkspaceTimelineItem\[\] = \[\]/, 'new project canvas templates should start with a clean sequence instead of template demo timeline clips');
  const applyCanvasTemplateHandler = canvasTemplateActionsHookSource.match(/const handleApplyCanvasTemplate = useCallback\([\s\S]*?\n  \);\n/);
  assert.ok(applyCanvasTemplateHandler, 'canvas template action hook should define a canvas-only template application handler');
  assert.match(applyCanvasTemplateHandler[0], /commitCanvasGraph\(\(\) => \(\{[\s\S]*edges: template\.edges,[\s\S]*nodes: template\.nodes/, 'applying a canvas template should update the graph through canvas history');
  assert.doesNotMatch(applyCanvasTemplateHandler[0], /setTimelineItems/, 'applying a canvas template should not reset or replace the montage timeline');
  assert.doesNotMatch(applyCanvasTemplateHandler[0], /setSequences/, 'applying a canvas template should not replace project sequences');
  assert.doesNotMatch(applyCanvasTemplateHandler[0], /timelineItems/, 'applying a canvas template should not copy template demo timeline items into the active sequence');
  assert.doesNotMatch(workspaceSource, /Reset template/, 'workspace should not expose a global reset template button that can erase project context');
  assert.match(workspaceEditorLayoutSource, /NodeSettingsPanel/, 'editor layout should compose the settings inspector');
  assert.match(workspaceEditorLayoutSource, /TimelineClipInspector/, 'editor layout should compose a timeline clip inspector for Viewer mode');
  assert.match(workspaceEditorLayoutSource, /focusMode === 'canvas'[\s\S]*NodeSettingsPanel[\s\S]*TimelineClipInspector/, 'right inspector should switch from node settings in Canvas mode to clip settings in Viewer mode');
  assert.match(workspaceSource, /const \[isCanvasInspectorOpen, setIsCanvasInspectorOpen\] = useState\(false\)/, 'Canvas inspector open state should be explicit instead of derived from node selection');
  assert.match(workspaceEditorLayoutSource, /shouldShowCanvasInspector = focusMode === 'canvas' && isCanvasInspectorOpen && Boolean\(canvas\.selectedNode\)/, 'Canvas mode should only open the node inspector after an explicit inspect action');
  assert.match(workspaceEditorLayoutSource, /canvasInspectorSlot[\s\S]*shouldShowCanvasInspector \? \(/, 'Canvas mode should keep the inspector inside a collapsible slot instead of showing an empty panel');
  assert.match(canvasSource, /onNodeDoubleClick[\s\S]*onInspectNode\(node\.id\)/, 'Canvas node double-click should explicitly open the node inspector');
  assert.match(canvasSource, /event\.key\.toLowerCase\(\) !== 'i'/, 'Canvas should expose I as the keyboard shortcut for opening the selected node inspector');
  assert.match(canvasSource, /data-canvas-node-inspect-button/, 'Canvas should delegate node inspect button clicks from selected graph nodes');
  assert.match(canvasSource, /const selectedNodeId = selectedNodes\[0\]\?\.id \?\? null;[\s\S]*onSelectedNodeSync\(selectedNodeId\)/, 'Canvas selection sync should clear the selected node when React Flow deselects everything');
  assert.match(selectionActionsHookSource, /handleInspectCanvasNode[\s\S]*setIsCanvasInspectorOpen\(Boolean\(nodeId\)\)/, 'Selection actions should own the explicit canvas inspect command');
  assert.match(selectionActionsHookSource, /handleSelectedCanvasNodeChange[\s\S]*if \(!nodeId\) setIsCanvasInspectorOpen\(false\)/, 'Simple canvas selection should close only on empty selection, not open the inspector');
  assert.match(nodeFrameSource, /data-canvas-node-inspect-button=\{nodeId\}/, 'Selected canvas nodes should expose a visible inspect affordance');
  assert.match(canvasGraphStateHookSource, /const \[selectedNodeId, setSelectedNodeId\] = useState<string \| null>\(null\)/, 'Canvas mode should not preselect a node and open the inspector on workspace load');
  assert.match(canvasTemplateActionsHookSource, /setSelectedNodeId\(null\)/, 'Applying a canvas template should leave the canvas inspector collapsed until the user selects a node');
  assert.match(shellStyleSource, /\.canvasEditorBody[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*0/, 'Canvas body should collapse the inspector column when no node is selected');
  assert.match(shellStyleSource, /\.canvasEditorBodyInspectorOpen[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*340px/, 'Canvas body should expand the inspector column when a node is selected');
  assert.match(shellStyleSource, /\.canvasInspectorSlot[\s\S]*transition:/, 'Canvas inspector slot should animate open and close with lightweight transitions');
  assert.match(workspaceEditorLayoutSource, /WorkspaceTimeline/, 'editor layout should compose the bottom timeline');
  assert.match(workspaceEditorTopbarSource, /\/assets\/branding\/logo-mark\.svg/, 'editor header should use the real MaxVideoAI logo mark');
  assert.doesNotMatch(workspaceEditorTopbarSource, /brandMark[\s\S]*>\s*M\s*</, 'editor header should not render a placeholder M logo');
  assert.match(shellStyleSource, /\.brandLogo/, 'editor logo should be styled by isolated editor shell CSS');
  assert.match(workspaceEditorTopbarSource, /focusMode === 'viewer'/, 'top switch should expose a Viewer mode instead of a second Timeline mode');
  assert.match(workspaceEditorTopbarSource, /studioCopy\.topbar\.viewer/, 'top switch should label the montage surface from localized Studio copy');
  assert.doesNotMatch(workspaceSource, />\s*Timeline\s*</, 'top switch should not duplicate the bottom timeline as a top-level mode');
  assert.doesNotMatch(workspaceSource, /HeaderBar|AppSidebar|WorkspaceChrome/, 'editor chrome should not inherit app shell chrome');
  assert.doesNotMatch(workspaceSource, /selected:\s*node\.id === selectedNodeId/, 'orchestrator should not manually control React Flow selected flags');
  assert.match(workspaceApiPersistenceSource, /normalizeWorkspaceGraphNodes/, 'persisted workspace normalization should use the centralized graph node normalizer');
  assert.match(workspaceApiPersistenceSource, /normalizeOutputOnlySourceEdges/, 'persisted workspace normalization should normalize stale source edge handles');
  assert.match(workspaceApiPersistenceSource, /normalizeTimelineMediaUrls/, 'persisted workspace normalization should hydrate stale timeline clips with playable output media URLs');
  assert.match(canvasTimelineActionsHookSource, /isPlayableVideoUrl/, 'canvas timeline action hook should distinguish playable video URLs from image thumbnails');
  assert.match(canvasTimelineActionsHookSource, /isPlayableAudioUrl/, 'canvas timeline action hook should hydrate playable audio URLs for generic audio timeline clips');
  assert.match(workspaceApiPersistenceSource, /normalizeGeneratedOutputEdges/, 'persisted workspace normalization should normalize stale output edge handles');
  assert.match(workspaceApiPersistenceSource, /normalizeShotOutputEdges/, 'persisted workspace normalization should normalize stale generated-shot source edge handles');
  assert.match(workspaceApiPersistenceSource, /normalizeWorkspaceEdgeTypes/, 'persisted workspace normalization should normalize stale saved edge types');
  assert.match(canvasStyleSource, /react-flow__handle-left/, 'focused canvas CSS should position left handles without inheriting React Flow global CSS');
  assert.match(canvasStyleSource, /react-flow__handle-right/, 'focused canvas CSS should position right handles without inheriting React Flow global CSS');

  const visitorAccessSource = source(visitorAccessPath);
  assert.match(visitorAccessSource, /normalized === '\/app\/studio\/workspace'/, 'editor route should follow existing visitor workspace browse access');
  assert.match(visitorAccessSource, /normalized === '\/app\/studio\/projects'/, 'studio projects route should be available through visitor workspace browse access');
  assert.match(visitorAccessSource, /normalized\.startsWith\('\/app\/studio\/workspace\/'\)/, 'project-scoped studio workspaces should be available through visitor workspace browse access');
});

test('MaxVideoAI Studio owns route-local copy and theme boundaries', () => {
  assert.ok(existsSync(studioCopyPath), 'Studio copy helpers should live route-local under app/studio/_lib');
  assert.ok(existsSync(studioThemeHookPath), 'Studio theme preference should live route-local under app/studio/_hooks');

  const projectsSource = readFileSync(studioProjectsPageClientPath, 'utf8');
  const workspaceSource = readFileSync(workspacePageClientPath, 'utf8');
  const layoutSource = readFileSync(workspaceEditorLayoutPath, 'utf8');
  const topbarSource = readFileSync(workspaceEditorTopbarPath, 'utf8');
  const studioThemeHookSource = readFileSync(studioThemeHookPath, 'utf8');
  const canvasToolbarSource = readFileSync(canvasFloatingToolbarPath, 'utf8');
  const timelineToolbarSource = readFileSync(timelineToolbarPath, 'utf8');
  const exportDialogSource = readFileSync(exportDialogPath, 'utf8');

  assert.match(projectsSource, /useI18n\(\)/, 'Studio projects should resolve localized copy from the existing app i18n provider');
  assert.match(studioThemeHookSource, /DEFAULT_STUDIO_THEME_PREFERENCE: StudioThemePreference = 'light'/, 'Studio editor theme should default to light mode');
  assert.match(studioThemeHookSource, /useState<StudioThemePreference>\(DEFAULT_STUDIO_THEME_PREFERENCE\)/, 'Studio theme hook should hydrate from the light default before storage is read');
  assert.match(studioThemeHookSource, /STUDIO_THEME_USER_OVERRIDE_STORAGE_KEY/, 'Studio theme hook should distinguish explicit user choices from the old dark default');
  assert.doesNotMatch(studioThemeHookSource, /return 'dark';/, 'Studio theme fallback paths should not silently default to dark mode');
  assert.match(workspaceSource, /resolveStudioCopy/, 'WorkspacePage should resolve Studio copy once and pass typed props down');
  assert.match(layoutSource, /data-studio-theme/, 'Workspace editor shell should scope light and dark theme through a Studio data attribute');
  assert.match(topbarSource, /studioCopy\.topbar/, 'Workspace topbar should render typed localized copy instead of inline English labels');
  assert.match(layoutSource, /copy=\{studioCopy\.timeline\}/, 'Workspace layout should pass timeline copy from the route-local Studio copy owner');
  assert.match(layoutSource, /exportDialogCopy=\{studioCopy\.exportDialog\}/, 'Workspace layout should pass export dialog copy from the route-local Studio copy owner');

  const hardcodedCanvasToolbarLabels = [
    /Canvas creation toolbar/,
    /Image tools/,
    /Template name/,
    /No saved canvas templates yet\./,
  ];
  hardcodedCanvasToolbarLabels.forEach((pattern) => {
    assert.doesNotMatch(canvasToolbarSource, pattern, `canvas toolbar should localize ${pattern}`);
  });

  const hardcodedTimelineToolbarLabels = [
    /Selection tool/,
    /Blade \/ Cut tool/,
    /Undo timeline edit/,
    /Timeline zoom level/,
  ];
  hardcodedTimelineToolbarLabels.forEach((pattern) => {
    assert.doesNotMatch(timelineToolbarSource, pattern, `timeline toolbar should localize ${pattern}`);
  });

  const hardcodedExportDialogLabels = [
    /Export sequence/,
    /Close export dialog/,
    /Video export/,
    /Server render/,
    /Download MP4/,
  ];
  hardcodedExportDialogLabels.forEach((pattern) => {
    assert.doesNotMatch(exportDialogSource, pattern, `export dialog should localize ${pattern}`);
  });
});

test('MaxVideoAI editor owns authenticated Studio persistence contracts', () => {
  const projectsApiSource = source(studioProjectsApiPath);
  const projectApiSource = source(studioProjectApiPath);
  const projectSequencesApiSource = source(studioProjectSequencesApiPath);
  const projectSequenceApiSource = source(studioProjectSequenceApiPath);
  const canvasTemplatesApiSource = source(studioCanvasTemplatesApiPath);
  const canvasTemplateApiSource = source(studioCanvasTemplateApiPath);
  const routeUtilsSource = source(studioRouteUtilsPath);
  const schemaSource = source(studioServerSchemaPath);
  const repositorySource = source(studioServerRepositoryPath);
  const migrationSource = source(studioMigrationPath);

  assert.match(projectsApiSource, /runtime = 'nodejs'/, 'studio project API should run on the Node runtime for database access');
  assert.match(projectsApiSource, /listStudioProjects/, 'project list API should read projects through the server repository');
  assert.match(projectsApiSource, /upsertStudioProject/, 'project creation API should upsert projects through the server repository');
  assert.match(projectApiSource, /readStudioProject/, 'project detail API should read a user-scoped project');
  assert.match(projectApiSource, /deleteStudioProject/, 'project detail API should support project deletion for future project management');
  assert.match(projectSequencesApiSource, /listStudioSequences/, 'project sequence API should list sequence records through the repository');
  assert.match(projectSequencesApiSource, /upsertStudioSequence/, 'project sequence API should create sequence records through the repository');
  assert.match(projectSequenceApiSource, /readStudioSequence/, 'project sequence detail API should read one user-scoped sequence');
  assert.match(projectSequenceApiSource, /deleteStudioSequence/, 'project sequence detail API should support safe sequence deletion');
  assert.match(projectSequenceApiSource, /STUDIO_SEQUENCE_LAST_SEQUENCE/, 'sequence deletion should reject deleting the final project sequence');
  assert.match(canvasTemplatesApiSource, /listStudioCanvasTemplates/, 'canvas template API should read user templates through the repository');
  assert.match(canvasTemplatesApiSource, /upsertStudioCanvasTemplate/, 'canvas template API should save user templates through the repository');
  assert.match(canvasTemplateApiSource, /deleteStudioCanvasTemplate/, 'canvas template detail API should support deleting saved templates');
  assert.match(routeUtilsSource, /getRouteAuthContext/, 'studio APIs must require the existing route auth context');
  assert.match(routeUtilsSource, /isDatabaseConfigured/, 'studio APIs should return a clean unavailable response when DATABASE_URL is missing');
  assert.match(routeUtilsSource, /DATABASE_NOT_CONFIGURED/, 'database-missing responses should be explicit for client fallback logic');
  assert.match(schemaSource, /studio_projects/, 'server schema should create the studio_projects table');
  assert.match(schemaSource, /studio_sequences/, 'server schema should prepare studio_sequences for real sequence persistence');
  assert.match(schemaSource, /studio_canvas_templates/, 'server schema should create canvas template persistence');
  assert.match(schemaSource, /studio_project_assets/, 'server schema should prepare project asset persistence');
  assert.match(repositorySource, /ensureStudioProjectSchema/, 'repository methods should ensure schema availability before database access');
  assert.match(repositorySource, /listStudioSequences/, 'repository should expose durable Studio sequence listing');
  assert.match(repositorySource, /readStudioSequence/, 'repository should expose durable Studio sequence reads');
  assert.match(repositorySource, /upsertStudioSequence/, 'repository should expose durable Studio sequence saves');
  assert.match(repositorySource, /deleteStudioSequence/, 'repository should expose durable Studio sequence deletes');
  assert.match(repositorySource, /STUDIO_PROJECT_NOT_FOUND/, 'repository should reject sequence writes when the parent project is not user-scoped');
  assert.match(repositorySource, /last_sequence/, 'repository should preserve at least one sequence per project');
  assert.match(repositorySource, /WHERE user_id = \$1/, 'repository reads should be scoped to the authenticated user');
  assert.match(repositorySource, /workspace_state/, 'repository should persist the current editor workspace snapshot');
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS studio_projects/, 'Neon migration should create studio_projects');
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS studio_sequences/, 'Neon migration should create studio_sequences');
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS studio_canvas_templates/, 'Neon migration should create studio_canvas_templates');
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS studio_project_assets/, 'Neon migration should create studio_project_assets');
});

test('MaxVideoAI editor owns graph, node, generation, and capability contracts', () => {
  assert.ok(existsSync(typesPath), 'workspace graph and timeline contracts should live in _lib/workspace-types.ts');
  assert.ok(existsSync(capabilitiesPath), 'workspace capabilities should keep a narrow public facade');
  assert.ok(existsSync(modelCapabilityRegistryPath), 'model capability mapping should live in _lib/models/model-capability-registry.ts');
  assert.ok(existsSync(modelEngineFieldsPath), 'engine field scanning helpers should live in _lib/models/model-engine-fields.ts');
  assert.ok(existsSync(modelInputConnectorsPath), 'model input connectors should live in _lib/models/model-input-connectors.ts');
  assert.ok(existsSync(modelPricingAdapterPath), 'model render pricing options should live in _lib/models/model-pricing-adapter.ts');
  assert.ok(existsSync(blockPresetsPath), 'canvas block presets should live in a focused route-local helper');
  assert.ok(existsSync(generationPath), 'workspace generation adapter should live in _lib/workspace-generation.ts');
  assert.ok(existsSync(generationRoutingPath), 'generation routing should live outside WorkspacePage and UI components');
  assert.ok(existsSync(pricingPath), 'workspace pricing adapter should live in _lib/workspace-pricing.ts');
  assert.ok(existsSync(mediaAvailabilityPath), 'workspace media availability helpers should live in a pure route-local helper');
  assert.ok(existsSync(handleDropPath), 'handle-drop node creation should live in a pure route-local helper');
  assert.ok(existsSync(canvasImportsPath), 'canvas import helpers should live in a pure route-local helper');
  assert.ok(existsSync(programSnapshotPath), 'program snapshot image URL rules should live in a pure route-local helper');
  assert.ok(existsSync(graphHelpersPath), 'canvas graph selection and connection helpers should live in a pure route-local helper');
  assert.ok(existsSync(projectSettingsPath), 'project settings helpers should live in a pure route-local helper');
  assert.ok(existsSync(timecodePath), 'timeline timecode helpers should live in a pure route-local helper');
  assert.ok(existsSync(timelineEditingPath), 'timeline editing helpers should live in a pure route-local helper');
  assert.ok(existsSync(timelineRenderPath), 'timeline final-render manifest helpers should live in a pure route-local helper');
  assert.ok(existsSync(timelineExportPath), 'timeline export request and handoff helpers should live in a pure route-local helper');
  assert.ok(existsSync(timelineTracksPath), 'timeline track helpers should live in a pure route-local helper');
  assert.ok(existsSync(timelineFramesPath), 'timeline frame math should live under _lib/timeline');
  assert.ok(existsSync(timelineInteractionPath), 'timeline pointer interaction math should live under _lib/timeline');
  assert.ok(existsSync(timelineExternalDropPath), 'timeline external media drop rules should live under _lib/timeline');
  assert.ok(existsSync(timelinePerformancePath), 'timeline performance marks should live under _lib/timeline');
  assert.ok(existsSync(timelineCollisionsPath), 'timeline overlap detection should live under _lib/timeline');
  assert.ok(existsSync(timelineInsertPath), 'timeline insert and move package helpers should live under _lib/timeline');
  assert.ok(existsSync(timelineTrimPath), 'timeline trim and split math should live under _lib/timeline');
  assert.ok(existsSync(timelineResizeEditingPath), 'timeline resize and transition editing helpers should live under _lib/timeline');
  assert.ok(existsSync(timelineNormalizePath), 'timeline start normalization should live under _lib/timeline');
  assert.ok(existsSync(timelinePositioningPath), 'timeline pointer positioning helpers should live under _lib/timeline');
  assert.ok(existsSync(timelineLinkedAudioPath), 'timeline linked audio sync helpers should live under _lib/timeline');
  assert.ok(existsSync(timelineBuildersPath), 'timeline clip builders should live under _lib/timeline');
  assert.ok(existsSync(timelineIdentitiesPath), 'timeline identity normalization helpers should live under _lib/timeline');
  assert.ok(existsSync(timelineSelectionGroupsPath), 'timeline selection group helpers should live under _lib/timeline');
  assert.ok(existsSync(libraryAssetsPath), 'studio library assets should live in a pure route-local helper');
  assert.ok(existsSync(editorAssetLibraryHookPath), 'studio should load the signed-in user media library through a route-local hook');
  assert.ok(existsSync(editorNoticeHookPath), 'editor notice auto-clear should live in a route-local hook');
  assert.ok(existsSync(canvasControllerHookPath), 'workspace canvas controller should live in a route-local hook');
  assert.ok(existsSync(canvasGraphStateHookPath), 'canvas graph state should live in a route-local hook');
  assert.ok(existsSync(canvasHistoryHookPath), 'canvas undo and redo history should live in a route-local hook');
  assert.ok(existsSync(projectMediaLibraryModalPath), 'viewer project media import modal should live in a route-local component');
  assert.ok(existsSync(pricingHookPath), 'workspace pricing hook should live in _hooks/useWorkspaceShotPricing.ts');
  assert.ok(existsSync(generationActionsHookPath), 'workspace shot generation actions should live in a route-local hook');
  assert.ok(existsSync(graphActionsHookPath), 'workspace graph actions should live in a route-local hook');
  assert.ok(existsSync(selectionActionsHookPath), 'workspace timeline and canvas selection actions should live in a route-local hook');
  assert.ok(existsSync(persistenceEffectsHookPath), 'workspace persistence effects should live in a route-local hook');
  assert.ok(existsSync(sequenceSnapshotsHookPath), 'workspace sequence snapshot assembly should live in a route-local hook');
  assert.ok(existsSync(shellActionsHookPath), 'workspace shell actions should live in a route-local hook');
  assert.ok(existsSync(timelineClipActionsHookPath), 'timeline clip mutation actions should live in a route-local hook');
  assert.ok(existsSync(timelineHistoryHookPath), 'timeline undo and redo history should live in a route-local hook');
  assert.ok(existsSync(timelineTrackActionsHookPath), 'timeline track mutation actions should live in a route-local hook');
  assert.ok(existsSync(timelinePlaybackHookPath), 'timeline playback clock and in-out controls should live in a route-local hook');
  assert.ok(existsSync(timelineSelectionSyncHookPath), 'timeline selection synchronization should live in a route-local hook');
  assert.ok(existsSync(exportStateHookPath), 'workspace export state derivation should live in a route-local hook');
  assert.ok(existsSync(renderEdgesPath), 'renderable edge filtering should live in a pure route-local helper');
  assert.ok(existsSync(templatesPath), 'starter templates should live in _lib/workspace-templates.ts');
  assert.ok(existsSync(templateCorePath), 'template core edge and shot helpers should live in the templates domain');
  assert.ok(existsSync(templateRegistryPath), 'canvas templates should be exposed through a focused registry');
  assert.ok(existsSync(templateProductAdPath), 'Product Ad canvas template should live in its own builder file');
  assert.ok(existsSync(templateDevBlocksPath), 'Dev Blocks canvas template should live in its own builder file');
  assert.ok(existsSync(templateCharacterDialoguePath), 'Character Dialogue canvas template should live in its own builder file');
  assert.ok(existsSync(templateStoryboardToVideoPath), 'Storyboard canvas template should live in its own builder file');
  assert.ok(existsSync(templateUgcAdPath), 'UGC canvas template should live in its own builder file');
  assert.ok(existsSync(templateCinematicScenePath), 'Cinematic canvas template should live in its own builder file');
  assert.ok(existsSync(templateVariantBasePath), 'variant canvas templates should share a focused builder helper');
  assert.ok(existsSync(workspaceStatePath), 'workspace persisted state contracts should live in _state/workspace-state.ts');
  assert.ok(existsSync(workspaceSelectorsPath), 'workspace derived state selectors should live in _state/workspace-selectors.ts');
  assert.ok(existsSync(workspaceSequenceSnapshotPath), 'active sequence snapshots should live in a pure route-local state helper');
  assert.ok(existsSync(workspaceSequenceOperationsPath), 'workspace sequence list operations should live in a pure route-local state helper');
  assert.ok(existsSync(workspaceApiPersistencePath), 'workspace API persistence and persisted state normalization should live in _state/workspace-api-persistence.ts');
  assert.ok(existsSync(workspaceSequenceApiPersistencePath), 'workspace sequence API synchronization should live in a focused route-local state helper');
  assert.ok(existsSync(workspacePersistencePath), 'workspace local persistence helpers should live in _state/workspace-persistence.ts');
  assert.ok(existsSync(workspaceNormalizersPath), 'workspace graph and media normalization should live in _state/workspace-normalizers.ts');

  const canvasSource = source(canvasPath);
  const canvasMapSource = source(canvasMapPath);
  const canvasHandleDropPreviewSource = source(canvasHandleDropPreviewPath);
  const canvasFloatingToolbarSource = source(canvasFloatingToolbarPath);
  const canvasNavigatorPanelSource = source(canvasNavigatorPanelPath);
  const canvasPaletteDragPreviewSource = source(canvasPaletteDragPreviewPath);
  const canvasControllerSource = source(canvasControllerPath);
  const canvasImportActionsHookSource = source(canvasImportActionsHookPath);
  const canvasTimelineActionsHookSource = source(canvasTimelineActionsHookPath);
  const canvasTemplateActionsHookSource = source(canvasTemplateActionsHookPath);
  const generationActionsHookSource = source(generationActionsHookPath);
  const graphActionsHookSource = source(graphActionsHookPath);
  const renderNodesHookSource = source(renderNodesHookPath);
  const selectionActionsHookSource = source(selectionActionsHookPath);
  const persistenceEffectsHookSource = source(persistenceEffectsHookPath);
  const sequenceSnapshotsHookSource = source(sequenceSnapshotsHookPath);
  const shellActionsHookSource = source(shellActionsHookPath);
  const assetLibraryBrowserSource = source(assetLibraryBrowserPath);
  const edgeSource = source(edgeTypesPath);
  const timelineProjectSidebarSource = source(timelineProjectSidebarPath);
  const workspaceEditorLayoutSource = source(workspaceEditorLayoutPath);
  const workspaceEditorTopbarSource = source(workspaceEditorTopbarPath);
  const assetLibraryModalSource = source(assetLibraryModalPath);
  const projectMediaLibraryModalSource = source(projectMediaLibraryModalPath);
  const editorNoticeHookSource = source(editorNoticeHookPath);
  const canvasControllerHookSource = source(canvasControllerHookPath);
  const canvasGraphStateHookSource = source(canvasGraphStateHookPath);
  const canvasHistoryHookSource = source(canvasHistoryHookPath);
  const projectMediaControllerSource = source(projectMediaControllerPath);
  const projectMediaActionsHookSource = source(projectMediaActionsHookPath);
  const exportControllerSource = source(exportControllerPath);
  const exportDialogSource = source(exportDialogPath);
  const runtimeModalsSource = source(runtimeModalsPath);
  const nodeSource = source(nodeTypesPath);
  const nodeFrameSource = source(nodeFramePath);
  const shotInputDockSource = source(shotInputDockPath);
  const nodeMediaPreviewSource = source(nodeMediaPreviewPath);
  const settingsSource = source(settingsPath);
  const shotNodeInspectorSource = source(shotNodeInspectorPath);
  const nodeInspectorControlsSource = source(nodeInspectorControlsPath);
  const nodeInspectorConnectionsSource = source(nodeInspectorConnectionsPath);
  const nodeInspectorMediaPreviewSource = source(nodeInspectorMediaPreviewPath);
  const timelineClipInspectorSource = source(timelineClipInspectorPath);
  const workspaceSource = source(workspacePagePath);
  const capabilitySource = source(capabilitiesPath);
  const modelCapabilityRegistrySource = source(modelCapabilityRegistryPath);
  const modelEngineFieldsSource = source(modelEngineFieldsPath);
  const modelInputConnectorsSource = source(modelInputConnectorsPath);
  const modelPricingAdapterSource = source(modelPricingAdapterPath);
  const generationSource = source(generationPath);
  const pricingSource = source(pricingPath);
  const mediaAvailabilitySource = source(mediaAvailabilityPath);
  const handleDropSource = source(handleDropPath);
  const canvasImportsSource = source(canvasImportsPath);
  const graphHelpersSource = source(graphHelpersPath);
  const projectSettingsSource = source(projectSettingsPath);
  const timecodeSource = source(timecodePath);
  const timelineEditingSource = source(timelineEditingPath);
  const timelineRenderSource = source(timelineRenderPath);
  const timelineExportSource = source(timelineExportPath);
  const timelineTracksSource = source(timelineTracksPath);
  const timelineDropsSource = source(timelineDropsPath);
  const timelineSelectionSource = source(timelineSelectionPath);
  const projectMediaDragSource = source(projectMediaDragPath);
  const projectMediaTimelineSource = source(projectMediaTimelinePath);
  const projectMediaMetadataSource = source(projectMediaMetadataPath);
  const projectMediaUploadSource = source(projectMediaUploadPath);
  const projectMediaMetadataHydrationHookSource = source(projectMediaMetadataHydrationHookPath);
  const timelineFramesSource = source(timelineFramesPath);
  const timelineInteractionSource = source(timelineInteractionPath);
  const timelineExternalDropSource = source(timelineExternalDropPath);
  const timelinePerformanceSource = source(timelinePerformancePath);
  const timelineCollisionsSource = source(timelineCollisionsPath);
  const timelineSelectionSyncHookSource = source(timelineSelectionSyncHookPath);
  const timelineInsertSource = source(timelineInsertPath);
  const timelineTrimSource = source(timelineTrimPath);
  const timelineResizeEditingSource = source(timelineResizeEditingPath);
  const timelineNormalizeSource = source(timelineNormalizePath);
  const timelinePositioningSource = source(timelinePositioningPath);
  const timelineLinkedAudioSource = source(timelineLinkedAudioPath);
  const timelineBuildersSource = source(timelineBuildersPath);
  const timelineIdentitiesSource = source(timelineIdentitiesPath);
  const timelineSelectionGroupsSource = source(timelineSelectionGroupsPath);
  const libraryAssetsSource = source(libraryAssetsPath);
  const editorAssetLibraryHookSource = source(editorAssetLibraryHookPath);
  const pricingHookSource = source(pricingHookPath);
  const timelineClipActionsHookSource = source(timelineClipActionsHookPath);
  const timelineHistoryHookSource = source(timelineHistoryHookPath);
  const timelineTrackActionsHookSource = source(timelineTrackActionsHookPath);
  const timelinePlaybackHookSource = source(timelinePlaybackHookPath);
  const exportStateHookSource = source(exportStateHookPath);
  const renderEdgesSource = source(renderEdgesPath);
  const templateSource = source(templatesPath);
  const templateCoreSource = source(templateCorePath);
  const templateRegistrySource = source(templateRegistryPath);
  const templateProductAdSource = source(templateProductAdPath);
  const templateDevBlocksSource = source(templateDevBlocksPath);
  const templateCharacterDialogueSource = source(templateCharacterDialoguePath);
  const templateStoryboardToVideoSource = source(templateStoryboardToVideoPath);
  const templateUgcAdSource = source(templateUgcAdPath);
  const templateCinematicSceneSource = source(templateCinematicScenePath);
  const workspaceStateSource = source(workspaceStatePath);
  const workspaceSelectorsSource = source(workspaceSelectorsPath);
  const workspaceSequenceSnapshotSource = source(workspaceSequenceSnapshotPath);
  const workspaceApiPersistenceSource = source(workspaceApiPersistencePath);
  const workspacePersistenceSource = source(workspacePersistencePath);
  const workspaceNormalizersSource = source(workspaceNormalizersPath);
  const typesSource = source(typesPath);
  const styleSource = source(stylesPath);
  const timelineClipSource = source(timelineClipPath);
  const timelineContextMenusSource = source(timelineContextMenusPath);
  const timelineContextMenusHookSource = source(timelineContextMenusHookPath);
  const timelineSource = source(timelinePath);
  const timelineRulerSource = source(timelineRulerPath);
  const timelineTrackListSource = source(timelineTrackListPath);
  const timelineTrackRowSource = source(timelineTrackRowPath);
  const timelineToolbarSource = source(timelineToolbarPath);
  const timelineKeyboardShortcutsSource = source(timelineKeyboardShortcutsPath);
  const timelineClipInteractionHookSource = source(timelineClipInteractionHookPath);
  const timelineExternalDropHookSource = source(timelineExternalDropHookPath);
  const timelinePanelResizeHookSource = source(timelinePanelResizeHookPath);
  const timelinePlayheadDragHookSource = source(timelinePlayheadDragHookPath);
  const timelinePreviewItemsHookSource = source(timelinePreviewItemsHookPath);
  const timelineSurfaceSelectionHookSource = source(timelineSurfaceSelectionHookPath);
  const timelineVisibleRangeHookSource = source(timelineVisibleRangeHookPath);
  const timelineTrackDefinitionsSource = source(timelineTrackDefinitionsPath);
  const videoViewerSource = source(videoViewerPath);
  const shellStyleSource = source(shellStylesPath);
  const studioSessionStyleSource = source(studioSessionStylesPath);
  const canvasStyleSource = source(canvasStylesPath);
  const canvasToolbarStyleSource = source(canvasToolbarStylesPath);
  const canvasNavigatorStyleSource = source(canvasNavigatorStylesPath);
  const canvasNodeStyleSource = source(canvasNodeStylesPath);
  const canvasMapStyleSource = source(canvasMapStylesPath);
  const timelineStyleSource = source(timelineStylesPath);
  const timelineControlStyleSource = source(timelineControlStylesPath);
  const timelineClipStyleSource = source(timelineClipStylesPath);
  const timelineContextMenuStyleSource = source(timelineContextMenuStylesPath);
  const inspectorStyleSource = source(inspectorStylesPath);
  const mediaStyleSource = source(mediaStylesPath);
  const exportStyleSource = source(exportStylesPath);
  const assetLibraryStyleSource = source(assetLibraryStylesPath);
  const viewerStyleSource = source(viewerStylesPath);
  const programMonitorSource = source(programMonitorPath);
  const programPlaybackLayersSource = source(programPlaybackLayersPath);
  const programControlsSource = source(programControlsPath);
  const programPlaybackSyncSource = source(programPlaybackSyncPath);
  const shotInputDockStyle = cssBlock(canvasNodeStyleSource, '.shotInputDock');

  assert.ok(lineCount(nodeSource) <= 360, 'workspace node renderers should stay focused on block-specific markup');
  assert.ok(lineCount(nodeFrameSource) <= 260, 'workspace node frame should stay focused on shared React Flow behavior');
  assert.ok(lineCount(settingsSource) <= 330, 'node settings panel should stay focused on routing to specific inspectors');
  assert.ok(lineCount(shotNodeInspectorSource) <= 260, 'shot node inspector should stay focused on generation-model settings');
  assert.ok(lineCount(nodeInspectorControlsSource) <= 90, 'node inspector form controls should remain small and reusable');
  assert.match(canvasSource, /@xyflow\/react/, 'canvas should use React Flow for pan, zoom, nodes, handles, and edges');
  assert.match(canvasSource, /_styles\/canvas\.module\.css/, 'canvas surface should import focused canvas CSS');
  assert.match(canvasMapSource, /_styles\/canvas-map\.module\.css/, 'canvas map should import focused canvas map CSS');
  assert.match(canvasHandleDropPreviewSource, /_styles\/canvas\.module\.css/, 'canvas handle previews should import focused canvas CSS');
  assert.match(canvasPaletteDragPreviewSource, /_styles\/canvas\.module\.css/, 'canvas palette previews should import focused canvas CSS');
  assert.match(nodeSource, /_styles\/canvas-nodes\.module\.css/, 'workspace node renderers should import focused canvas node CSS');
  assert.match(nodeFrameSource, /_styles\/canvas-nodes\.module\.css/, 'workspace node frame should import focused canvas node CSS');
  assert.match(nodeSource, /workspace-node-frame/, 'workspace node renderers should delegate shared frame behavior');
  assert.match(nodeMediaPreviewSource, /_styles\/canvas-nodes\.module\.css/, 'node media previews should import focused canvas node CSS');
  assert.match(timelineProjectSidebarSource, /WorkspaceProjectSequenceSummary/, 'viewer sidebar should receive summarized project sequences');
  assert.match(timelineProjectSidebarSource, /onSelectSequence/, 'viewer sidebar should expose sequence switching');
  assert.match(timelineProjectSidebarSource, /onNewSequence/, 'viewer sidebar should expose sequence creation');
  assert.doesNotMatch(canvasSource, /\bMiniMap\b/, 'canvas should not rely on the native React Flow minimap for the branded content overview');
  assert.match(canvasSource, /CanvasMap/, 'canvas should compose the focused branded graph navigation component');
  assert.match(canvasMapSource, /CanvasMiniatureMap/, 'canvas map should render a branded miniature of the real graph content');
  assert.match(canvasMapSource, /data-canvas-miniature-map/, 'canvas miniature should be directly testable');
  assert.match(canvasMapSource, /data-canvas-navigator/, 'canvas navigation should be testable and distinct from graph nodes');
  assert.doesNotMatch(canvasSource, /\bControls\b/, 'canvas should not expose unclear native React Flow controls');
  assert.match(canvasSource, /Background/, 'canvas should render an infinite-canvas background');
  assert.match(canvasSource, /onNodeClick/, 'canvas should select a node when it is clicked');
  assert.match(canvasSource, /SelectionMode\.Partial/, 'canvas marquee selection should include nodes partially covered by the selection box');
  assert.match(canvasSource, /selectionOnDrag=\{isMarqueeSelectionTool\}/, 'canvas should enable drag selection only for the marquee tool');
  assert.match(canvasSource, /panOnDrag=\{!isMarqueeSelectionTool\}/, 'canvas should disable pane panning while the marquee tool is active');
  assert.match(canvasSource, /deleteElements\(\{ nodes: selectedNodeIds\.map/, 'canvas should delete the current React Flow node selection through React Flow');
  assert.match(canvasFloatingToolbarSource, /copy\.toolbar\.marqueeSelectNodes/, 'canvas toolbar should expose an explicit marquee selection tool through localized copy');
  assert.match(canvasFloatingToolbarSource, /copy\.toolbar\.deleteSelectedNodes/, 'canvas toolbar should expose a selected-node deletion action through localized copy');
  assert.match(canvasFloatingToolbarSource, /copy\.toolbar\.imageTools/, 'canvas toolbar should group image creation actions through localized copy');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('generate-image'/, 'canvas toolbar should expose image generation entry points through block presets');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('character-builder'/, 'canvas toolbar should expose character builder entry points through block presets');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('angle'/, 'canvas toolbar should expose angle tool entry points through block presets');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('upscale-image'/, 'canvas toolbar should expose image upscale entry points through block presets');
  assert.match(canvasFloatingToolbarSource, /copy\.toolbar\.videoTools/, 'canvas toolbar should group video creation actions through localized copy');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('modify-video'/, 'canvas toolbar should expose video modification entry points through block presets');
  assert.doesNotMatch(canvasFloatingToolbarSource, /presetBlock\('storyboard-video'/, 'canvas toolbar should not expose stale storyboard-video presets');
  assert.doesNotMatch(canvasFloatingToolbarSource, /presetBlock\('character-video'/, 'canvas toolbar should not expose stale character-video presets');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('upscale-video'/, 'canvas toolbar should expose video upscale entry points through block presets');
  assert.match(canvasFloatingToolbarSource, /copy\.toolbar\.audioTools/, 'canvas toolbar should group audio creation actions through localized copy');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('audio-music'/, 'canvas toolbar should expose music generation entry points through block presets');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('audio-sfx'/, 'canvas toolbar should expose SFX entry points through block presets');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('audio-voiceover'/, 'canvas toolbar should expose voice-over entry points through block presets');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('audio-sound-design'/, 'canvas toolbar should expose sound design entry points through block presets');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('audio-sound-design-voice'/, 'canvas toolbar should expose sound design with voice entry points through block presets');
  assert.match(canvasFloatingToolbarSource, /copy\.toolbar\.textTools/, 'canvas toolbar should expose text creation actions through localized copy');
  assert.match(canvasFloatingToolbarSource, /copy\.freeText/, 'canvas toolbar text action should create a connectable free-text block through localized copy');
  assert.match(canvasFloatingToolbarSource, /presetBlock\('chat-box'/, 'canvas toolbar should expose chat entry points through block presets');
  assert.match(canvasFloatingToolbarSource, /\bType\b/, 'canvas toolbar text action should use a T-style icon');
  assert.doesNotMatch(canvasFloatingToolbarSource, /Quick add|Import media|Fit graph|Canvas tools|Media blocks|Text blocks|Generate blocks/, 'canvas toolbar should only expose the requested tool groups');
  assert.match(canvasSource, /onConnectStart/, 'canvas should track drags that start from a connector handle');
  assert.match(canvasSource, /onConnectEnd/, 'canvas should create a matching node when a connector drag ends on the pane');
  assert.match(canvasSource, /onDragOver/, 'canvas should accept block template drags from the floating toolbar');
  assert.match(canvasSource, /onDrop/, 'canvas should create dropped block templates on the pane');
  assert.match(canvasPaletteDragPreviewSource, /maxvideoai:palette-drag-start/, 'canvas palette preview should define the pointer-based block template drag event');
  assert.match(canvasPaletteDragPreviewSource, /maxvideoai:palette-placement-arm/, 'canvas palette preview should define the click-to-place block template event');
  assert.match(canvasControllerSource, /PALETTE_DRAG_START_EVENT/, 'canvas controller should listen for pointer-based block template drags from the floating toolbar');
  assert.match(canvasControllerSource, /PALETTE_PLACEMENT_ARM_EVENT/, 'canvas controller should listen for click-to-place block template choices from the floating toolbar');
  assert.match(canvasSource, /paletteDragPreview/, 'canvas should show a ghost block while dragging a toolbar template');
  assert.match(canvasSource, /handlePalettePlacementCommit/, 'canvas should commit click-to-place block templates from pane clicks');
  assert.match(canvasControllerSource, /screenToFlowPosition/, 'canvas controller should convert dropped toolbar templates into flow coordinates');
  assert.match(canvasControllerSource, /handlePalettePlacementMove/, 'canvas controller should let the click-to-place ghost follow the pointer');
  assert.match(canvasControllerSource, /event\.key === 'Escape'/, 'canvas controller should cancel click-to-place placement with Escape');
  assert.match(canvasPaletteDragPreviewSource, /application\/x-maxvideoai-node-kind/, 'canvas palette preview should define the block template drag payload type');
  assert.match(canvasControllerSource, /WORKSPACE_NODE_KIND_DRAG_TYPE/, 'canvas controller should read the block template drag payload');
  assert.match(canvasSource, /WorkspaceCanvasFileDropRequest/, 'canvas should expose local file drops as a typed request to the orchestrator');
  assert.match(canvasControllerSource, /dataTransfer\.files/, 'canvas controller should accept files dragged from the operating system');
  assert.match(canvasControllerSource, /clipboardData/, 'canvas controller should accept pasted files and text from the clipboard');
  assert.match(canvasImportsSource, /workspaceNodeKindForCanvasFile/, 'canvas import helper should classify local dropped and pasted files');
  assert.match(canvasImportsSource, /workspaceAssetRecordFromCanvasFile/, 'canvas import helper should build local asset records from browser object URLs');
  assert.match(canvasImportsSource, /createAdHocWorkspaceNode/, 'canvas import helper should build ad hoc canvas nodes for drops and snapshots');
  assert.match(canvasControllerHookSource, /useWorkspaceCanvasImportActions/, 'canvas controller should delegate local canvas import actions to a route-local hook');
  assert.match(canvasImportActionsHookSource, /handleCanvasFileDrop/, 'canvas import hook should convert dropped local files into matching workspace nodes');
  assert.match(canvasImportActionsHookSource, /handleCanvasTextPaste/, 'canvas import hook should convert pasted plain text into prompt nodes');
  assert.match(canvasImportActionsHookSource, /handleSendProgramSnapshotToCanvas/, 'canvas import hook should convert program snapshots into image nodes');
  assert.match(canvasImportActionsHookSource, /setCanvasAutoCenterNodeId\(snapshotNode\.id\)/, 'canvas import hook should request viewport centering for program snapshots created from viewer mode');
  assert.match(canvasSource, /autoCenterNodeId/, 'canvas should accept a one-shot node id to center after opening from viewer mode');
  assert.match(canvasSource, /reactFlow\.setCenter/, 'canvas should use React Flow viewport centering for snapshot nodes');
  assert.match(canvasImportActionsHookSource, /URL\.createObjectURL/, 'local file drops should use browser object URLs for immediate preview');
  assert.doesNotMatch(workspaceSource, /URL\.createObjectURL/, 'orchestrator should not own browser object URL creation for local canvas imports');
  assert.doesNotMatch(workspaceSource, /function workspaceNodeKindForCanvasFile/, 'orchestrator should not own local file type detection');
  assert.doesNotMatch(workspaceSource, /function workspaceAssetRecordFromCanvasFile/, 'orchestrator should not own browser-local asset record builders');
  assert.doesNotMatch(workspaceSource, /function createAdHocNode/, 'orchestrator should not own default ad hoc canvas node builders');
  assert.match(canvasHandleDropPreviewSource, /ViewportPortal/, 'canvas should render handle-drag previews in flow coordinates');
  assert.match(canvasHandleDropPreviewSource, /workspaceGhostNode/, 'canvas should show a ghost block while dragging from a connector');
  assert.match(canvasHandleDropPreviewSource, /workspaceGhostLink/, 'canvas should show a ghost link while dragging from a connector');
  assert.match(canvasHandleDropPreviewSource, /draft\?: WorkspaceHandleDropDraft/, 'connector drag preview should not require a node-creation draft');
  assert.match(canvasHandleDropPreviewSource, /preview\.draft \?/, 'connector drag preview should render the ghost block only when a matching block can be created');
  assert.match(canvasSource, /updateHandleDropPreview\(\{[\s\S]*draft,[\s\S]*\}\)/, 'canvas should start a connector preview even when no matching dropped block exists');
  assert.match(canvasSource, /if \(!preview\.draft \|\| connectionState\.isValid/, 'canvas should only auto-create dropped blocks when the connector preview has a draft');
  assert.match(canvasPaletteDragPreviewSource, /workspaceGhostNode/, 'canvas should show a ghost block while dragging a toolbar template');
  assert.match(canvasSource, /useMemo\(\(\) => workspaceNodeTypes, \[\]\)/, 'canvas should memoize custom node type maps for React Flow');
  assert.match(canvasSource, /useMemo\(\(\) => workspaceEdgeTypes, \[\]\)/, 'canvas should memoize custom edge type maps for React Flow');
  assert.match(canvasSource, /workspaceEdgeTypes/, 'canvas should register route-aware workspace edge types');
  assert.match(canvasSource, /edgeTypes=\{edgeTypes\}/, 'React Flow should use the custom workspace edge renderer');
  assert.match(edgeSource, /export function WorkspaceSmartEdge/, 'smart edge renderer should be exported');
  assert.match(edgeSource, /useStore/, 'smart edge renderer should inspect node bounds from React Flow state');
  assert.match(edgeSource, /routeAvoidingNodes/, 'smart edge renderer should route around node rectangles');
  assert.match(edgeSource, /segmentIntersectsRect/, 'smart edge renderer should detect edge segments crossing nodes');
  assert.match(edgeSource, /selected/, 'smart edge renderer should read React Flow edge selection state');
  assert.match(edgeSource, /selectedEdgeStyle/, 'smart edge renderer should apply selection to the line path itself');
  assert.match(edgeSource, /selected \? selectedEdgeStyle/, 'selected workspace edges should highlight the line path instead of relying on the edge container');
  assert.match(canvasStyleSource, /react-flow__edge\.selected/, 'canvas CSS should target selected edge containers');
  assert.match(canvasStyleSource, /react-flow__edge:focus/, 'canvas CSS should remove the selected edge container focus box');
  assert.match(canvasStyleSource, /react-flow__edge\.selected[\s\S]*react-flow__edge-path/, 'canvas CSS should render selected edge glow from the line path');

  for (const nodeName of ['AssetImageNode', 'AssetVideoNode', 'AssetAudioNode', 'TextPromptNode', 'ShotNode', 'OutputNode']) {
    assert.match(nodeSource, new RegExp(`export function ${nodeName}`), `${nodeName} should be exported`);
  }
  assert.match(nodeFrameSource, /NodeResizeControl/, 'content source nodes should use React Flow resize controls');
  assert.match(nodeFrameSource, /SOURCE_RESIZABLE_NODE_KINDS/, 'node frame should centralize which block kinds can be resized');
  assert.match(nodeFrameSource, /'asset-image'[\s\S]*'asset-video'[\s\S]*'asset-audio'[\s\S]*'text-prompt'[\s\S]*'output'/, 'image, video, audio, prompt, and output blocks should be resizable');
  assert.doesNotMatch(nodeFrameSource, /SOURCE_RESIZABLE_NODE_KINDS = new Set<WorkspaceNodeKind>\(\[[^\]]*'shot'/, 'generate blocks should keep standard non-resizable layout');
  assert.match(nodeFrameSource, /position="bottom-left"/, 'resizable blocks should expose a discreet bottom-left resize selector');
  assert.match(nodeFrameSource, /styles\.nodeResizeControl/, 'resize selector should use isolated editor CSS');
  assert.match(nodeFrameSource, /styles\.sourceResizableNode/, 'resizable source nodes should opt into fluid card sizing');
  assert.match(nodeFrameSource, /minWidth=\{SOURCE_NODE_MIN_WIDTH\}/, 'resize control should keep a standard minimum width');
  assert.match(nodeFrameSource, /const SOURCE_NODE_MIN_HEIGHT = 132;/, 'non-output resize control should keep a standard minimum height');
  assert.match(canvasNodeStyleSource, /\.sourceResizableNode/, 'resizable source node sizing should be styled in focused canvas node CSS');
  assert.match(canvasNodeStyleSource, /\.nodeResizeControl/, 'bottom-left resize selector should be styled in focused canvas node CSS');
  assert.match(canvasNodeStyleSource, /\.nodeResizeGrip/, 'resize selector should have a discreet visual grip');
  assert.match(canvasNodeStyleSource, /\.nodeResizeControl[\s\S]*position:\s*absolute/, 'resize selector should be absolutely positioned by canvas node CSS');
  assert.match(canvasNodeStyleSource, /\.nodeResizeControl[\s\S]*bottom:\s*-8px/, 'resize selector should sit on the bottom edge');
  assert.match(canvasNodeStyleSource, /\.nodeResizeControl[\s\S]*left:\s*-8px/, 'resize selector should sit on the left edge');
  assert.match(canvasNodeStyleSource, /cursor:\s*nesw-resize/, 'bottom-left resize selector should communicate the mirrored diagonal resize affordance');
  assert.match(canvasStyleSource, /react-flow__node-asset-image[\s\S]*react-flow__node-asset-video[\s\S]*react-flow__node-text-prompt[\s\S]*react-flow__node-output/, 'media, prompt, and output blocks should have explicit default node dimensions');
  assert.match(canvasStyleSource, /react-flow__node-asset-audio/, 'audio blocks should have explicit default node dimensions');
  assert.match(canvasStyleSource, /width:\s*210px/, 'source node defaults should keep a compact standard width until manually resized');
  assert.match(canvasStyleSource, /height:\s*166px/, 'visual and prompt source nodes should keep a compact standard height until manually resized');
  assert.match(canvasStyleSource, /height:\s*138px/, 'audio source nodes should keep a compact standard height until manually resized');
  assert.match(canvasNodeStyleSource, /\.nodePreview img[\s\S]*object-fit:\s*contain/, 'media previews should scale inside the block while preserving their source ratio');

  assert.match(capabilitySource, /models\/model-capability-registry/, 'capabilities facade should re-export the model registry');
  assert.match(capabilitySource, /models\/model-input-connectors/, 'capabilities facade should re-export connector helpers');
  assert.match(capabilitySource, /models\/model-pricing-adapter/, 'capabilities facade should re-export render option helpers');
  assert.doesNotMatch(capabilitySource, /getBaseEngines|listFalEngines/, 'capabilities facade should not own engine provider mapping');
  assert.doesNotMatch(capabilitySource, /const WORKSPACE_ENGINE_CAPABILITIES = \[/, 'capabilities should not be a copied fake engine roster');
  assert.match(modelCapabilityRegistrySource, /getBaseEngines|listFalEngines/, 'model registry should derive from existing engine config');
  assert.match(modelCapabilityRegistrySource, /function buildCapability/, 'model registry should build capabilities from engine schemas');
  assert.match(modelCapabilityRegistrySource, /input_connectors/, 'model registry should expose engine-derived editor input connectors');
  assert.match(modelCapabilityRegistrySource, /required_inputs/, 'model registry should expose required connector kinds');
  assert.match(modelCapabilityRegistrySource, /optional_inputs/, 'model registry should expose optional connector kinds');
  assert.match(modelEngineFieldsSource, /export function fieldsFor/, 'engine field helpers should centralize schema scanning');
  assert.match(modelInputConnectorsSource, /sanitizeConnectorLabel/, 'input connector helpers should remove copied "up to N" counts from labels');
  assert.match(modelInputConnectorsSource, /export function isWorkspaceConnectionCompatible/, 'input connector helpers should reject graph links between incompatible media families');
  assert.match(modelInputConnectorsSource, /export function workspaceConnectionCapacity/, 'input connector helpers should expose per-input remaining connection capacity');
  assert.match(modelInputConnectorsSource, /export function getWorkspaceShotTargetHandles/, 'input connector helpers should expose shot target handles for the selected engine');
  assert.match(modelInputConnectorsSource, /export function resolveWorkspaceWorkflowType/, 'input connector helpers should infer the internal generation workflow from connected inputs');
  assert.match(modelPricingAdapterSource, /export function resolveWorkspaceRenderOptions/, 'pricing adapter should expose engine-derived render options');
  assert.match(modelPricingAdapterSource, /export function workspaceAudioEnabledForRequest/, 'pricing adapter should centralize when audio can be sent to generate and pricing');
  assert.match(capabilitySource, /getWorkspaceModelCapabilities/, 'capabilities facade should expose model capabilities');
  assert.match(capabilitySource, /export function validateShotConnections/, 'capabilities helper should validate connected shot inputs');
  assert.match(capabilitySource, /export function suggestWorkspaceModels/, 'capabilities helper should suggest compatible models');
  assert.match(typesSource, /WorkspaceOutputStatus/, 'workspace outputs should type placeholder, processing, and ready states');
  assert.match(typesSource, /WorkspaceRenderOption/, 'workspace capabilities should type render options separately from graph inputs');
  assert.match(workspaceStateSource, /type WorkspaceSequenceRecord/, 'workspace state module should own persisted sequence contracts');
  assert.match(workspaceStateSource, /type PersistedWorkspaceState/, 'workspace state module should own persisted workspace contracts');
  assert.match(workspaceSelectorsSource, /buildWorkspaceSequenceSummaries/, 'workspace selectors should derive sidebar sequence summaries outside the orchestrator');
  assert.match(workspaceSelectorsSource, /selectedWorkspaceTimelineItem/, 'workspace selectors should derive selected timeline items outside the orchestrator');
  assert.match(sequenceSnapshotsHookSource, /buildWorkspaceActiveSequenceSnapshot/, 'sequence snapshot hook should delegate active sequence record construction');
  assert.match(sequenceSnapshotsHookSource, /buildWorkspaceSequenceSummaries/, 'sequence snapshot hook should derive sidebar sequence summaries');
  assert.doesNotMatch(workspaceSource, /const snapshotActiveSequence = useCallback/, 'workspace orchestrator should not own active sequence snapshot construction inline');
  assert.match(workspaceSequenceSnapshotSource, /createWorkspaceSequenceRecord/, 'active sequence snapshot helper should compose canonical sequence records');
  assert.match(workspaceSequenceSnapshotSource, /sequenceNameForIndex/, 'active sequence snapshot helper should own active sequence fallback naming');
  assert.doesNotMatch(workspaceSource, /storedSequence\?\.name\s*\?\?\s*sequenceNameForIndex/, 'workspace orchestrator should not duplicate active sequence naming fallback inline');
  assert.match(workspaceApiPersistenceSource, /\/api\/studio\/projects\/\$\{encodeURIComponent\(projectId\)\}/, 'workspace API persistence should read project-scoped Studio workspaces');
  assert.match(workspaceApiPersistenceSource, /\/api\/studio\/canvas-templates/, 'workspace API persistence should sync user canvas templates through the Studio API');
  assert.match(workspaceApiPersistenceSource, /normalizePersistedProjectAssets/, 'workspace API persistence should normalize persisted project media assets');
  assert.match(workspacePersistenceSource, /function workspaceStorageKeyForProject/, 'workspace persistence module should own project-scoped local storage keys');
  assert.match(workspacePersistenceSource, /function readPersistedWorkspaceState/, 'workspace persistence module should own persisted workspace local reads');
  assert.match(workspacePersistenceSource, /function readUserCanvasTemplates/, 'workspace persistence module should own local canvas template reads');
  assert.match(workspacePersistenceSource, /function writeUserCanvasTemplates/, 'workspace persistence module should own local canvas template writes');
  assert.match(persistenceEffectsHookSource, /readPersistedWorkspaceState/, 'workspace persistence hook should own local workspace hydration side effects');
  assert.match(persistenceEffectsHookSource, /readStudioProjectFromApi/, 'workspace persistence hook should own server workspace hydration side effects');
  assert.match(persistenceEffectsHookSource, /saveStudioWorkspaceToApi/, 'workspace persistence hook should own server autosave side effects');
  assert.match(workspaceNormalizersSource, /function normalizeOutputOnlySourceNodes/, 'workspace normalizers should own stale source-node handle cleanup');
  assert.match(workspaceNormalizersSource, /function normalizeWorkspaceGraphNodes/, 'workspace normalizers should centralize graph node migrations');
  assert.match(workspaceNormalizersSource, /function generatedOutputSourceHandle/, 'workspace normalizers should keep output source handles media-specific');
  assert.match(workspaceNormalizersSource, /function shotOutputSourceHandle/, 'workspace normalizers should keep generation block source handles media-specific');
  assert.match(workspaceNormalizersSource, /function normalizeChatSettings/, 'workspace normalizers should own persisted chat node shape');
  assert.match(workspaceNormalizersSource, /function normalizePlaceholderOutputNodes/, 'workspace normalizers should own stale output placeholder cleanup');
  assert.match(workspaceNormalizersSource, /function normalizeTimelineMediaUrls/, 'workspace normalizers should own timeline media URL hydration');
  assert.match(workspaceNormalizersSource, /function playableOutputTimelineUrl/, 'workspace normalizers should own playable output media detection');
  assert.match(timelineEditingSource, /from '\.\/timeline\/timeline-frames'/, 'timeline editing facade should import frame math from the timeline domain');
  assert.match(timelineEditingSource, /from '\.\/timeline\/timeline-insert'/, 'timeline editing facade should import insertion helpers from the timeline domain');
  assert.match(timelineEditingSource, /from '\.\/timeline\/timeline-trim'/, 'timeline editing facade should import trim helpers from the timeline domain');
  assert.match(timelineEditingSource, /from '\.\/timeline\/timeline-linked-audio'/, 'timeline editing facade should import linked audio helpers from the timeline domain');
  assert.match(timelinePositioningSource, /from '\.\/timeline-collisions'/, 'timeline positioning helper should import overlap checks from the timeline domain');
  assert.match(timelineEditingSource, /timeline\/timeline-identities/, 'timeline editing facade should re-export timeline identity helpers');
  assert.match(timelineEditingSource, /timeline\/timeline-selection-groups/, 'timeline editing facade should re-export timeline selection group helpers');
  assert.match(timelineFramesSource, /secondsToTimelineFrame/, 'timeline frame helper should expose seconds-to-frame conversion');
  assert.match(timelineFramesSource, /snapSecondsToTimelineFrame/, 'timeline frame helper should expose frame-accurate second snapping');
  assert.match(timelineInteractionSource, /export function nextTimelineInteractionState/, 'timeline interaction helper should own pointer drag and resize projection');
  assert.match(timelineInteractionSource, /export function selectedItemIdsForMarquee/, 'timeline interaction helper should own marquee selection hit testing');
  assert.match(timelineSource, /timeline\/timeline-interaction/, 'timeline component should import pointer interaction helpers from the timeline domain');
  assert.match(timelineSource, /useTimelineClipInteraction/, 'timeline component should delegate clip drag and resize behavior to a focused hook');
  assert.match(timelineSource, /useTimelineContextMenus/, 'timeline component should delegate context menu state and actions to a focused hook');
  assert.match(timelineSource, /useTimelinePanelResize/, 'timeline component should delegate panel height drag behavior to a focused hook');
  assert.match(timelineSource, /useTimelinePlayheadDrag/, 'timeline component should delegate playhead drag behavior to a focused hook');
  assert.match(timelineSource, /useTimelinePreviewItems/, 'timeline component should delegate preview item projection to a focused hook');
  assert.match(timelineSource, /useTimelineSurfaceSelection/, 'timeline component should delegate empty-surface scrubbing and marquee selection to a focused hook');
  assert.match(timelineSource, /useTimelineVisibleRange/, 'timeline component should delegate visible range scheduling to a focused hook');
  assert.match(timelineClipInteractionHookSource, /nextTimelineInteractionState/, 'timeline clip interaction hook should own pointer projection during clip drags');
  assert.match(timelineClipInteractionHookSource, /trackAtClientY/, 'timeline clip interaction hook should own vertical track retargeting during drags');
  assert.match(timelineClipInteractionHookSource, /markTimelinePerformance\('drag-start'\)/, 'timeline clip interaction hook should preserve drag performance markers');
  assert.match(timelineContextMenusHookSource, /handleOpenClipContextMenu/, 'timeline context menu hook should own clip context menu opening');
  assert.match(timelineContextMenusHookSource, /handleOpenTrackContextMenu/, 'timeline context menu hook should own track context menu opening');
  assert.match(timelineContextMenusHookSource, /window\.addEventListener\('pointerdown'/, 'timeline context menu hook should own global context-menu dismissal');
  assert.match(timelinePanelResizeHookSource, /onBeginResize\?\.\(\)/, 'timeline panel resize hook should preserve caller-owned cleanup before resizing');
  assert.match(timelinePlayheadDragHookSource, /markTimelinePerformance\('playhead-frame'\)/, 'timeline playhead hook should keep requestAnimationFrame playhead performance markers');
  assert.match(timelinePreviewItemsHookSource, /moveWorkspaceTimelineSelectionWithMode/, 'timeline preview hook should project inserted multi-clip drags through the editing helper');
  assert.match(timelinePreviewItemsHookSource, /previewPlayheadForInteraction/, 'timeline preview hook should derive the preview playhead from the active interaction');
  assert.match(timelineSurfaceSelectionHookSource, /selectedItemIdsForMarquee/, 'timeline surface selection hook should own marquee selection hit testing');
  assert.match(timelineSurfaceSelectionHookSource, /suppressNextSurfaceClickRef/, 'timeline surface selection hook should prevent marquee pointer-up from also scrubbing');
  assert.match(timelineVisibleRangeHookSource, /requestAnimationFrame/, 'timeline visible range hook should throttle scroll range updates with requestAnimationFrame');
  assert.match(timelineVisibleRangeHookSource, /TIMELINE_VISIBLE_RANGE_BUFFER_PX/, 'timeline visible range hook should own the buffered render window');
  assert.match(timelinePerformanceSource, /export function markTimelinePerformance/, 'timeline performance markers should be shared outside the component');
  assert.doesNotMatch(timelineSource, /playheadDragFrameRef|pendingPlayheadDragSecRef/, 'timeline component should not own playhead drag animation refs inline');
  assert.doesNotMatch(timelineSource, /visibleRangeFrameRef/, 'timeline component should not own visible range animation refs inline');
  assert.doesNotMatch(timelineSource, /function updateVisibleTimelineRange|const updateVisibleTimelineRange/, 'timeline component should not own visible range projection inline');
  assert.doesNotMatch(timelineSource, /interactionRef|setPreviewInteraction|trackAtClientY/, 'timeline component should not own clip drag state refs or track retargeting inline');
  assert.doesNotMatch(timelineSource, /setContextMenu|setTrackContextMenu|handleOpenTrackContextMenu = useCallback/, 'timeline component should not own context menu state or track menu opening inline');
  assert.doesNotMatch(timelineSource, /setMarquee|suppressNextSurfaceClickRef|selectedItemIdsForMarquee/, 'timeline component should not own marquee state or hit testing inline');
  assert.doesNotMatch(timelineSource, /moveWorkspaceTimelineSelectionWithMode|TIMELINE_PREVIEW_ID_SEED/, 'timeline component should not own preview item projection inline');
  assert.doesNotMatch(timelineSource, /TIMELINE_CLIP_DRAG_THRESHOLD_PIXELS|markTimelinePerformance\('drag-start'\)/, 'timeline component should not own low-level clip drag thresholds or drag markers inline');
  assert.match(timelineClipSource, /timeline\/timeline-interaction/, 'timeline clips should share frame snap and interaction contracts from the timeline domain');
  assert.doesNotMatch(timelineSource, /function nextInteractionState/, 'timeline component should not own pointer interaction projection inline');
  assert.doesNotMatch(timelineSource, /function selectedItemIdsForMarquee/, 'timeline component should not own marquee hit testing inline');
  assert.match(timelineExternalDropSource, /export function parseTimelineNodeDragPayload/, 'timeline external drop helper should parse canvas and media drag payloads');
  assert.match(timelineExternalDropSource, /export function resolveTimelineExternalDropPreview/, 'timeline external drop helper should own external drop ghost resolution');
  assert.match(timelineExternalDropHookSource, /timeline\/timeline-external-drop/, 'timeline external drop hook should import external drop helpers from the timeline domain');
  assert.match(timelineSource, /useTimelineExternalDrop/, 'timeline component should delegate external drag-and-drop state to a focused hook');
  assert.match(timelineExternalDropHookSource, /parseTimelineNodeDragPayload/, 'timeline external drop hook should parse canvas and media drag payloads');
  assert.match(timelineExternalDropHookSource, /resolveTimelineExternalDropPreview/, 'timeline external drop hook should own external drop ghost resolution');
  assert.doesNotMatch(timelineSource, /function parseTimelineNodeDragPayload/, 'timeline component should not own external drop payload parsing inline');
  assert.doesNotMatch(timelineSource, /function updateExternalDropPreview|const updateExternalDropPreview/, 'timeline component should not own external drop preview state inline');
  assert.doesNotMatch(timelineSource, /function insertionBoundaryForTimelineTrack/, 'timeline component should not own external insertion boundary logic inline');
  assert.match(timelineCollisionsSource, /timelineRangeOverlapsItem/, 'timeline collision helper should expose range overlap checks');
  assert.match(timelineCollisionsSource, /timelineTrackHasOverlap/, 'timeline collision helper should expose same-track no-overlap assertions');
  assert.match(timelineInsertSource, /editTracksForPreparedItems/, 'timeline insert helper should determine affected tracks for insert packages');
  assert.match(timelineInsertSource, /insertionBoundaryForWholeClipInsert/, 'timeline insert helper should resolve whole-clip insertion boundaries');
  assert.match(timelineTrimSource, /resolveResizeTarget/, 'timeline trim helper should resolve source-capped resize targets');
  assert.match(timelineTrimSource, /resolveTimelineSplitOffset/, 'timeline trim helper should resolve frame-safe split offsets');
  assert.match(timelineLinkedAudioSource, /syncLinkedAudioWithVideo/, 'timeline linked audio helper should synchronize linked audio from its video peer');
  assert.match(timelineLinkedAudioSource, /hasLinkedVideoPeer/, 'timeline linked audio helper should detect video/audio pairs');
  assert.match(timelineIdentitiesSource, /export function normalizeWorkspaceTimelineIdentities/, 'timeline identity helper should normalize duplicate clip and linked group ids');
  assert.match(timelineIdentitiesSource, /export function uniqueTimelineIdentifier/, 'timeline identity helper should expose deterministic unique ids for split/link operations');
  assert.match(timelineSelectionGroupsSource, /export function linkWorkspaceTimelineSelection/, 'timeline selection group helper should own manual link operations');
  assert.match(timelineSelectionGroupsSource, /export function unlinkWorkspaceTimelineSelection/, 'timeline selection group helper should own manual unlink operations');
  assert.match(timelineSelectionGroupsSource, /export function timelineSelectionKeyForItem/, 'timeline selection group helper should own linked group selection keys');
  assert.match(typesSource, /WorkspaceProjectSettings/, 'workspace should type project-level aspect ratio, resolution, and FPS');
  assert.match(typesSource, /WorkspaceTimelineVideoTrack/, 'timeline should type multiple video tracks');
  assert.match(typesSource, /`video-\$\{number\}`/, 'timeline video tracks should allow V2, V3, and later video lanes');
  assert.match(typesSource, /WorkspaceTimelineAudioTrack/, 'timeline should keep audio track ids distinct from video track ids');
  assert.match(typesSource, /hasAudio\?: boolean/, 'workspace video outputs should record whether generated media includes audio');
  assert.match(typesSource, /audioUrl\?: string \| null/, 'workspace video outputs should optionally expose extracted or companion audio media');
  assert.match(typesSource, /mediaUrl\?: string \| null/, 'timeline clips should carry a playable media URL for the central viewer');
  assert.match(typesSource, /sourceStartSec\?: number/, 'timeline clips should carry source in-points for trim editing');
  assert.match(typesSource, /sourceDurationSec\?: number/, 'timeline clips should remember their original source duration');
  assert.match(typesSource, /linkedGroupId\?: string \| null/, 'timeline clips should be able to link video and audio segments');
  assert.match(typesSource, /`audio-\$\{number\}`/, 'timeline audio tracks should allow Audio 2, Audio 3, and later audio lanes');
  assert.match(typesSource, /WorkspaceTimelineClipTransform/, 'timeline should type clip transform edit properties');
  assert.match(typesSource, /WorkspaceTimelineAudioMix/, 'timeline should type clip audio mix edit properties');
  assert.match(typesSource, /transform\?: WorkspaceTimelineClipTransform/, 'timeline clips should store per-clip transform settings');
  assert.match(typesSource, /audioMix\?: WorkspaceTimelineAudioMix/, 'timeline clips should store per-clip audio mix settings');
  assert.match(typesSource, /render_options: WorkspaceRenderOption\[\]/, 'model capabilities should carry engine-derived render options');

  assert.match(generationSource, /runGenerate/, 'generation adapter should call the existing MaxVideoAI generation API');
  assert.match(generationSource, /export function createPendingWorkspaceOutput/, 'generation adapter should create a processing output block before media exists');
  assert.match(generationSource, /createMockWorkspaceOutput/, 'generation adapter should keep an isolated mock output fallback');
  assert.match(generationSource, /buildWorkspaceShotGenerateRequest/, 'generation adapter should expose a tested request builder');
  assert.match(generationSource, /workspaceAudioEnabledForRequest/, 'generation adapter should sanitize audio from engine render options');
  assert.match(pricingSource, /PreflightRequest/, 'pricing adapter should build the same preflight payload shape as generate video');
  assert.match(pricingSource, /resolveWorkspaceGenerationMode/, 'pricing adapter should reuse the generated-shot mode routing');
  assert.match(pricingSource, /workspaceAudioEnabledForRequest/, 'pricing adapter should price only supported engine audio toggles');
  assert.match(mediaAvailabilitySource, /export function isPlayableVideoUrl/, 'media availability helper should detect playable video sources');
  assert.match(mediaAvailabilitySource, /export function isPlayableAudioUrl/, 'media availability helper should detect playable audio sources');
  assert.match(mediaAvailabilitySource, /export function outputStatus/, 'media availability helper should derive placeholder, processing, and ready output states');
  assert.match(handleDropSource, /export function resolveWorkspaceHandleDropDraft/, 'handle-drop helper should resolve a connector into a matching source block draft');
  assert.match(handleDropSource, /export function createWorkspaceHandleDropNode/, 'handle-drop helper should create the matching graph node');
  assert.match(handleDropSource, /WorkspaceHandleDropDraft/, 'handle-drop helper should expose a typed drag draft contract');
  assert.match(projectSettingsSource, /DEFAULT_WORKSPACE_PROJECT_SETTINGS/, 'project settings helper should expose stable default video settings');
  assert.match(projectSettingsSource, /coerceWorkspaceProjectSettings/, 'project settings helper should sanitize persisted project settings');
  assert.match(projectSettingsSource, /workspaceProjectAspectParts/, 'project settings helper should expose numeric aspect parts for contained program monitor sizing');
  assert.match(projectSettingsSource, /workspaceProjectAspectCssValue/, 'project settings helper should convert project aspect ratio to CSS');
  assert.match(projectSettingsSource, /workspaceProjectDimensionsLabel/, 'project settings helper should expose project output dimensions for the program monitor');
  assert.match(timecodeSource, /secondsToWorkspaceFrame/, 'timecode helper should convert seconds into project frames');
  assert.match(timecodeSource, /formatWorkspaceTimecode/, 'timecode helper should format HH:MM:SS:FF labels');
  assert.match(timelineEditingSource, /timeline\/timeline-normalize/, 'timeline editing facade should re-export start normalization helpers');
  assert.match(timelineNormalizeSource, /export function normalizeWorkspaceTimelineStarts/, 'timeline normalize helper should recalculate clip start times per track');
  assert.match(timelineEditingSource, /export function moveWorkspaceTimelineItem/, 'timeline helper should reorder clips predictably');
  assert.match(timelineEditingSource, /export function reorderWorkspaceTimelineItem/, 'timeline helper should support drag/drop target positions');
  assert.match(timelineEditingSource, /export function splitWorkspaceTimelineItem/, 'timeline helper should split selected clips for cut editing');
  assert.match(timelineEditingSource, /export function insertWorkspaceTimelineItems/, 'timeline helper should support insert, overwrite, and replace edits from the canvas');
  assert.match(timelineEditingSource, /export function deleteWorkspaceTimelineItem/, 'timeline helper should delete selected linked clips with optional ripple behavior');
  assert.match(timelineEditingSource, /WorkspaceTimelineInsertMode/, 'timeline helper should type insert, overwrite, and replace edit modes');
  assert.match(timelineEditingSource, /WorkspaceTimelineTrimMode/, 'timeline helper should type normal, ripple, and roll trim modes');
  assert.match(timelineEditingSource, /export function trimWorkspaceTimelineItem/, 'timeline helper should trim clip starts and ends');
  assert.match(timelineEditingSource, /timeline\/timeline-positioning/, 'timeline editing facade should re-export pointer positioning helpers');
  assert.match(timelinePositioningSource, /export function positionWorkspaceTimelineItem/, 'timeline positioning helper should support direct pointer-based clip moves');
  assert.match(timelineEditingSource, /export function moveWorkspaceTimelineSelectionWithMode/, 'timeline helper should route pointer drags through insert, overwrite, and replace modes');
  assert.match(timelinePositioningSource, /nextTrack\?: WorkspaceTimelineTrack/, 'timeline positioning helper should support moving clips between video tracks');
  assert.match(timelineTracksSource, /isWorkspaceTimelineVideoTrack/, 'timeline track helper should distinguish video tracks from audio tracks');
  assert.match(timelineSelectionSource, /timelineSelectionTouchesLockedTrack/, 'timeline selection helper should own linked lock selection checks');
  assert.match(timelineSelectionSource, /filterHiddenVideoTrackItems/, 'timeline selection helper should own hidden-track preview filtering');
  assert.match(timelineSelectionSource, /muteAudioTrackItems/, 'timeline selection helper should own muted-track preview projection');
  assert.match(timelineSelectionSource, /defaultTimelineSelectionIds/, 'timeline selection helper should own default timeline selection ids');
  assert.match(workspaceSource, /useWorkspaceSelectionActions/, 'workspace should delegate canvas and timeline selection actions to a route-local hook');
  assert.match(workspaceSource, /useWorkspaceEditorNotice/, 'workspace should delegate editor notice lifetime to a route-local hook');
  assert.match(workspaceSource, /useWorkspaceTimelineSelectionSync/, 'workspace should delegate timeline selection synchronization to a route-local hook');
  assert.match(editorNoticeHookSource, /window\.setTimeout/, 'editor notice hook should own the auto-clear timer');
  assert.match(timelineSelectionSyncHookSource, /defaultTimelineSelectionIds/, 'timeline selection sync hook should repair invalid timeline selections');
  assert.match(selectionActionsHookSource, /applyTimelineSelection/, 'selection action hook should own multi-selection normalization');
  assert.match(selectionActionsHookSource, /handleSelectTimelineItem/, 'selection action hook should own single timeline item selection');
  assert.match(selectionActionsHookSource, /handleInspectSequence/, 'selection action hook should own sequence inspector selection');
  assert.match(selectionActionsHookSource, /handleSelectedCanvasNodeChange/, 'selection action hook should own canvas node selection surface changes');
  assert.match(selectionActionsHookSource, /uniqueTimelineSelectionIds/, 'selection action hook should reuse the pure timeline selection normalizer');
  assert.doesNotMatch(workspaceSource, /const applyTimelineSelection = useCallback/, 'workspace orchestrator should not own selection normalization internals');
  assert.doesNotMatch(workspaceSource, /const handleSelectTimelineItem = useCallback/, 'workspace orchestrator should not own timeline item selection internals');
  assert.doesNotMatch(workspaceSource, /window\.setTimeout\(\(\) => setNotice/, 'workspace orchestrator should not own notice auto-clear timers inline');
  assert.doesNotMatch(workspaceSource, /const existingItemIds = new Set\(timelineItems\.map/, 'workspace orchestrator should not own timeline selection repair inline');
  assert.doesNotMatch(workspaceSource, /function timelineSelectionTouchesLockedTrack/, 'orchestrator should not own linked lock selection checks inline');
  assert.doesNotMatch(workspaceSource, /function filterHiddenVideoTrackItems/, 'orchestrator should not own hidden-track preview filtering inline');
  assert.match(timelineEditingSource, /isWorkspaceTimelineVideoTrack/, 'timeline editing should use the shared video-track helper');
  assert.match(timelineEditingSource, /targetTrack/, 'timeline helper should apply a drag target video track');
  assert.match(timelinePositioningSource, /targetTrack/, 'timeline positioning helper should apply a direct drag target track');
  assert.match(timelineEditingSource, /timeline\/timeline-resize-editing/, 'timeline editing facade should re-export resize and transition editing helpers');
  assert.match(timelineResizeEditingSource, /export function resizeWorkspaceTimelineItem/, 'timeline resize helper should support direct pointer-based clip resizing');
  assert.match(timelineTrimSource, /maxResizeDurationForTimelineItem/, 'timeline trim helper should cap trim expansion to source media duration');
  assert.match(timelineResizeEditingSource, /sourceRightRoomForTimelineItem/, 'timeline resize helper should know how much source media remains after a clip out-point');
  assert.match(timelineResizeEditingSource, /clampSourceStartForDuration/, 'timeline resize helper should keep clip source in/out inside the original media');
  assert.match(timelineResizeEditingSource, /export function toggleWorkspaceTimelineCrossfade/, 'timeline resize helper should toggle crossfade transitions between adjacent clips');
  assert.match(timelineEditingSource, /timeline\/timeline-builders/, 'timeline editing facade should re-export timeline clip builders');
  assert.match(timelineBuildersSource, /export function buildWorkspaceTimelineItemsForOutput/, 'timeline builder helper should create linked audio and video clips from generated outputs');
  assert.match(timelineBuildersSource, /export function buildWorkspaceTimelineItemsForAsset/, 'timeline builder helper should create timeline clips from imported canvas media assets');
  assert.match(timelineBuildersSource, /workspaceAssetHasTimelineAudio/, 'timeline builder helper should treat imported video assets as video plus linked audio');
  assert.match(timelineRenderSource, /export function buildWorkspaceTimelineRenderManifest/, 'timeline render helper should build a final-render manifest from timeline clips');
  assert.match(timelineRenderSource, /WorkspaceTimelineRenderManifest/, 'timeline render helper should type the backend handoff contract');
  assert.match(timelineRenderSource, /projectSettings/, 'timeline render manifest should carry project settings for final composition');
  assert.match(timelineRenderSource, /timelineTrackOrderForItems/, 'timeline render helper should include dynamic video tracks in the final handoff');
  assert.match(timelineRenderSource, /isWorkspaceTimelineVideoTrack/, 'timeline render helper should treat V2 and later tracks as video tracks');
  assert.match(timelineRenderSource, /processing_media/, 'timeline render helper should block placeholder and processing media before export');
  assert.match(timelineRenderSource, /overlapping_clips/, 'timeline render helper should detect same-track overlaps before export');
  assert.match(timelineRenderSource, /transitionOut/, 'timeline render helper should preserve transition metadata for final render');
  assert.doesNotMatch(timelineRenderSource, /buildWorkspaceTimelineVideoExportRequest/, 'timeline render helper should not own MP4 export request construction');
  assert.match(timelineExportSource, /WORKSPACE_TIMELINE_EXPORT_QUALITY_PRESETS/, 'timeline export helper should own export quality presets');
  assert.match(timelineExportSource, /workspaceTimelineExportReadinessChecks/, 'timeline export helper should own export readiness checks');
  assert.match(timelineExportSource, /buildWorkspaceTimelineVideoExportRequest/, 'timeline export helper should own the MP4 video export request contract');
  assert.match(timelineExportSource, /buildWorkspaceTimelineEdl/, 'timeline export helper should keep EDL export local and separate from MP4 server render');
  assert.match(timelineRenderSource, /transform\?: WorkspaceTimelineItem\['transform'\]/, 'timeline render helper should carry clip transform settings');
  assert.match(timelineRenderSource, /composition\?: WorkspaceTimelineClipComposition/, 'timeline render helper should carry source-pixel composition geometry');
  assert.match(timelineRenderSource, /audioMix\?: WorkspaceTimelineItem\['audioMix'\]/, 'timeline render helper should carry clip audio mix settings');
  assert.match(timelineRenderSource, /transform: item\.transform/, 'timeline render manifest should serialize clip transform settings');
  assert.match(timelineRenderSource, /composition,/, 'timeline render manifest should serialize clip composition settings');
  assert.match(timelineRenderSource, /audioMix: item\.audioMix/, 'timeline render manifest should serialize clip audio mix settings');
  assert.match(timelineRenderSource, /node\?\.data\.output\?\.url \?\? node\?\.data\.asset\?\.url/, 'timeline render helper should resolve generated outputs and asset library media');
  assert.match(libraryAssetsSource, /WORKSPACE_LIBRARY_ASSETS/, 'studio library assets should be shared between sidebar and asset picker');
  assert.match(libraryAssetsSource, /buildWorkspaceUserLibraryUrl/, 'studio library helper should target the app media-library API');
  assert.match(libraryAssetsSource, /normalizeWorkspaceUserLibraryPayload/, 'studio library helper should normalize app user assets');
  assert.match(libraryAssetsSource, /workspaceUploadEndpointForNodeKind/, 'studio library helper should expose app upload endpoints by media node kind');
  assert.match(libraryAssetsSource, /workspaceUploadAcceptForNodeKind/, 'studio library helper should expose upload accept filters by media node kind');
  assert.match(libraryAssetsSource, /workspaceLibraryAssetFromUploadedAsset/, 'studio library helper should normalize uploaded app assets');
  assert.match(libraryAssetsSource, /WORKSPACE_LIBRARY_SOURCE_OPTIONS/, 'studio library helper should mirror the app library source filter options');
  assert.match(libraryAssetsSource, /WORKSPACE_LIBRARY_SOURCE_LABELS/, 'studio library helper should mirror the app library source labels');
  assert.match(libraryAssetsSource, /source !== 'all'/, 'studio library URL builder should route source filters to the app media-library API');
  assert.match(libraryAssetsSource, /workspaceAssetRecordFromLibraryAsset/, 'studio library assets should map into node asset records');
  assert.match(libraryAssetsSource, /workspaceLibraryAssetsForNodeKind/, 'studio library should filter assets by media node kind');
  assert.match(editorAssetLibraryHookSource, /authFetch/, 'studio user library hook should reuse app session-aware authFetch');
  assert.match(editorAssetLibraryHookSource, /buildWorkspaceUserLibraryUrl/, 'studio user library hook should call the app media library endpoint');
  assert.match(editorAssetLibraryHookSource, /normalizeWorkspaceUserLibraryPage/, 'studio user library hook should normalize paginated API results before rendering');
  assert.match(editorAssetLibraryHookSource, /useState<WorkspaceLibrarySource>\('all'\)/, 'studio user library hook should own the active app-library source filter');
  assert.match(editorAssetLibraryHookSource, /WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE/, 'studio user library hook should cache loaded assets between picker openings');
  assert.match(editorAssetLibraryHookSource, /shouldUseFallback[\s\S]*Boolean\(error\)/, 'studio user library hook should not show dev assets while a real user-library request is loading or merely empty');
  assert.match(editorAssetLibraryHookSource, /setSource/, 'studio user library hook should expose a source setter to the browser UI');
  assert.match(pricingHookSource, /runPreflight/, 'workspace pricing hook should call the existing generate video preflight API');
  assert.match(workspaceSource, /useWorkspaceShotPricing/, 'orchestrator should inject live shot pricing estimates into nodes');
  assert.match(canvasControllerHookSource, /useWorkspaceGenerationActions/, 'canvas controller should delegate shot generation actions to a route-local hook');
  assert.match(generationActionsHookSource, /handleGenerateShot/, 'generation action hook should own shot generation submission');
  assert.match(generationActionsHookSource, /createPendingWorkspaceOutput/, 'generation action hook should create or reuse an output placeholder as soon as generation starts');
  assert.match(generationActionsHookSource, /findGeneratedOutputNodeForShot/, 'generation action hook should reuse an upstream output block when one already exists');
  assert.match(generationActionsHookSource, /submitWorkspaceShotGeneration/, 'generation action hook should call the generation adapter');
  assert.doesNotMatch(workspaceSource, /const handleGenerateShot = useCallback/, 'workspace orchestrator should not own shot generation internals');
  assert.doesNotMatch(workspaceSource, /createPendingWorkspaceOutput/, 'workspace orchestrator should not create pending output nodes inline');
  assert.match(graphHelpersSource, /findGeneratedOutputNodeForShot/, 'graph helper should own generated-output node lookup');
  assert.match(workspaceEditorLayoutSource, /onCreateNodeFromHandleDrop=\{canvas\.handleCreateNodeFromHandleDrop\}/, 'editor layout should wire handle-drop node creation into the canvas');
  assert.match(graphHelpersSource, /isWorkspaceConnectionCompatible/, 'graph helper should reject incompatible graph links before adding edges');
  assert.match(graphHelpersSource, /workspaceConnectionCapacity/, 'graph helper should reject graph links when an input connector has no remaining capacity');
  assert.doesNotMatch(workspaceSource, /function workspaceConnectionRejectionReason/, 'orchestrator should not own graph connection rejection rules inline');
  assert.match(canvasControllerHookSource, /useWorkspaceGraphActions/, 'canvas controller should delegate canvas graph mutations to a route-local hook');
  assert.match(graphActionsHookSource, /workspaceConnectionRejectionReason/, 'graph action hook should own connection rejection handling');
  assert.match(graphActionsHookSource, /handleCreateNodeFromHandleDrop/, 'graph action hook should own handle-drop node creation');
  assert.match(graphActionsHookSource, /handleCreateNodeFromPaletteDrop/, 'graph action hook should own palette node creation');
  assert.match(graphActionsHookSource, /handleSelectLibraryAsset/, 'graph action hook should own filling media nodes from the library');
  assert.match(graphActionsHookSource, /appendSelectedWorkspaceGraphNode/, 'graph action hook should select newly added blocks so the inspector follows them');
  assert.doesNotMatch(workspaceSource, /const onConnect = useCallback/, 'workspace orchestrator should not own graph connection internals');
  assert.doesNotMatch(workspaceSource, /const handleCreateNodeFromHandleDrop = useCallback/, 'workspace orchestrator should not own handle-drop node creation internals');
  assert.doesNotMatch(workspaceSource, /const handleCreateNodeFromPaletteDrop = useCallback/, 'workspace orchestrator should not own palette node creation internals');
  assert.match(workspaceEditorLayoutSource, /onCreateNodeFromPaletteDrop=\{canvas\.handleCreateNodeFromPaletteDrop\}/, 'editor layout should wire sidebar block-template drops into the canvas');
  assert.match(graphHelpersSource, /appendSelectedWorkspaceGraphNode/, 'graph helper should own selected-node append behavior');
  assert.match(workspaceEditorLayoutSource, /WorkspaceRuntimeModals/, 'editor layout should delegate runtime modal rendering to a route-local component');
  assert.doesNotMatch(workspaceSource, /WorkspaceAssetLibraryModal/, 'orchestrator should not render the editor asset library modal inline');
  assert.match(runtimeModalsSource, /WorkspaceAssetLibraryModal/, 'runtime modals should open the editor asset library from empty media nodes');
  assert.match(canvasControllerHookSource, /useWorkspaceCanvasTimelineActions/, 'canvas controller should delegate canvas media timeline actions to a route-local hook');
  assert.match(canvasTimelineActionsHookSource, /handleSendOutputToTimeline/, 'canvas timeline action hook should own send-to-timeline insertion');
  assert.match(canvasTimelineActionsHookSource, /handleDropNodeToTimeline/, 'canvas timeline action hook should own canvas node timeline drops');
  assert.match(canvasTimelineActionsHookSource, /handleInvalidNodeDropToTimeline/, 'canvas timeline action hook should own rejected canvas node timeline drops');
  assert.match(canvasTimelineActionsHookSource, /buildWorkspaceTimelineItemsForAsset/, 'canvas timeline action hook should send imported canvas media blocks into the montage timeline');
  assert.match(canvasTimelineActionsHookSource, /buildWorkspaceTimelineItemsForOutput/, 'canvas timeline action hook should send generated outputs into the montage timeline');
  assert.match(canvasTimelineActionsHookSource, /workspaceTimelineItemsCompatibleWithTrack/, 'canvas timeline action hook should preserve target track compatibility checks');
  assert.doesNotMatch(canvasTimelineActionsHookSource, /setFocusMode\('viewer'\)/, 'sending a canvas item to the timeline should not automatically switch to Viewer mode');
  assert.doesNotMatch(workspaceSource, /const handleSendOutputToTimeline = useCallback/, 'workspace orchestrator should not own send-to-timeline internals');
  assert.doesNotMatch(workspaceSource, /buildWorkspaceTimelineItemsForAsset/, 'workspace orchestrator should not build imported canvas media timeline items inline');
  assert.match(settingsSource, /AssetInspector[\s\S]*timelineInsertActions[\s\S]*copy\.insertAtPlayhead/, 'asset inspector should expose timeline insert actions for imported media blocks through localized copy');
  assert.match(programPlaybackSyncSource, /playableImageUrlForItem/, 'montage viewer should preview imported image assets as still clips');
  assert.match(workspaceStateSource, /focusMode\?: WorkspaceFocusMode/, 'persisted workspace state should remember whether the user was in canvas or viewer mode');
  assert.match(persistenceEffectsHookSource, /setFocusMode\(persisted\.focusMode/, 'workspace hydration should restore the active canvas/viewer mode');
  assert.match(workspaceSource, /selectedTimelineItemId/, 'orchestrator should track which timeline clip controls the montage viewer');
  assert.match(workspaceSource, /playheadSec/, 'orchestrator should track the montage playhead');
  assert.match(workspaceSource, /useWorkspaceTimelineClipActions/, 'workspace should delegate timeline clip mutations to a route-local hook');
  assert.match(workspaceEditorLayoutSource, /onCutItem=\{timelineClip\.handleCutTimelineItem\}/, 'editor layout should wire basic cut editing from the bottom timeline');
  assert.match(workspaceEditorLayoutSource, /onPositionItem=\{timelineClip\.handlePositionTimelineItem\}/, 'editor layout should wire pointer-based clip movement');
  assert.match(workspaceEditorLayoutSource, /onResizeItem=\{timelineClip\.handleResizeTimelineItem\}/, 'editor layout should wire pointer-based clip resizing');
  assert.match(timelineClipActionsHookSource, /handleCutTimelineItem/, 'timeline clip action hook should own cut editing');
  assert.match(timelineClipActionsHookSource, /handlePositionTimelineItem/, 'timeline clip action hook should own pointer-based clip movement');
  assert.match(timelineClipActionsHookSource, /handleResizeTimelineItem/, 'timeline clip action hook should own pointer-based clip resizing');
  assert.match(timelineClipActionsHookSource, /handleLinkTimelineItems/, 'timeline clip action hook should own clip linking');
  assert.match(timelineClipActionsHookSource, /handleDeleteTimelineItem/, 'timeline clip action hook should own clip deletion');
  assert.match(timelineClipActionsHookSource, /timelineSelectionTouchesLockedTrack/, 'timeline clip action hook should preserve locked-track safety checks');
  assert.doesNotMatch(workspaceSource, /const handleCutTimelineItem = useCallback/, 'workspace orchestrator should not own cut editing internals');
  assert.doesNotMatch(workspaceSource, /const handlePositionTimelineItem = useCallback/, 'workspace orchestrator should not own pointer move internals');
  assert.doesNotMatch(workspaceSource, /const handleDeleteTimelineItem = useCallback/, 'workspace orchestrator should not own timeline deletion internals');
  assert.match(workspaceStateSource, /DEFAULT_WORKSPACE_SHOT_MODEL_ID = 'seedance-2-0'/, 'new shot blocks should default to Seedance 2.0');
  assert.match(workspaceSource, /capability\.id === DEFAULT_WORKSPACE_SHOT_MODEL_ID/, 'orchestrator should resolve the default shot model from the current capabilities');
  assert.match(templateSource, /from '\.\/templates\/registry'/, 'workspace template facade should export the focused registry');
  assert.match(templateSource, /from '\.\/templates\/template-core'/, 'workspace template facade should export shared edge helpers');
  assert.match(templateCoreSource, /DEFAULT_WORKSPACE_TEMPLATE_SHOT_MODEL_ID = 'seedance-2-0'/, 'template shot defaults should use Seedance 2.0');
  assert.match(workspaceSource, /videoTrackCount/, 'workspace should remember added video timeline tracks');
  assert.match(workspaceEditorLayoutSource, /MAX_TIMELINE_VIDEO_TRACKS/, 'editor layout should cap added video tracks to a small editor-friendly count');
  assert.match(workspaceSource, /useWorkspaceTimelineTrackActions/, 'workspace should delegate timeline track mutations to a route-local hook');
  assert.match(workspaceEditorLayoutSource, /onAddVideoTrack=\{timelineTrack\.handleAddTimelineVideoTrack\}/, 'editor layout should let the timeline add video tracks without a separate panel');
  assert.match(timelineTrackActionsHookSource, /handleAddTimelineVideoTrack/, 'timeline track action hook should own video track creation');
  assert.match(timelineTrackActionsHookSource, /handleToggleVideoTrackVisibility/, 'timeline track action hook should own video track visibility');
  assert.match(timelineTrackActionsHookSource, /handleToggleAudioTrackMute/, 'timeline track action hook should own audio track mute');
  assert.match(timelineTrackActionsHookSource, /handleDeleteTimelineTrack/, 'timeline track action hook should own track deletion');
  assert.match(timelineTrackActionsHookSource, /deleteWorkspaceTimelineTrackItems/, 'timeline track action hook should reuse state-level track deletion retargeting');
  assert.doesNotMatch(workspaceSource, /const handleAddTimelineVideoTrack = useCallback/, 'workspace orchestrator should not own video track creation internals');
  assert.doesNotMatch(workspaceSource, /const handleDeleteTimelineTrack = useCallback/, 'workspace orchestrator should not own timeline track deletion internals');
  assert.match(canvasControllerHookSource, /useWorkspaceEditorAssetLibrary/, 'canvas controller should feed the picker from the signed-in user media library');
  assert.match(canvasControllerHookSource, /useWorkspaceEditorAssetLibrary\(assetPickerNode \? assetPickerNode\.data\.kind : undefined, studioAssetLibraryCopy\)/, 'canvas controller should load the signed-in media library only when the picker modal is open and pass localized library copy');
  assert.doesNotMatch(workspaceSource, /selectedMediaNodeKind/, 'selecting a media node should not preload the signed-in media library before the picker opens');
  assert.doesNotMatch(workspaceSource, /sidebarLibrary\s*=\s*useWorkspaceEditorAssetLibrary\(null\)/, 'orchestrator should not load the user media library directly in the sidebar');
  assert.match(workspaceSource, /assetPickerNodeId/, 'orchestrator should track which media node is being filled from the library');
  assert.match(graphActionsHookSource, /workspaceAssetRecordFromLibraryAsset/, 'graph action hook should store selected library assets on media nodes');
  assert.match(projectMediaActionsHookSource, /handleSelectProjectMediaAsset/, 'project media action hook should own library asset selection into Project media');
  assert.match(projectMediaActionsHookSource, /workspaceAssetRecordFromLibraryAsset/, 'project media action hook should normalize selected library assets before storing them in the project bin');
  assert.doesNotMatch(workspaceSource, /workspaceAssetRecordFromLibraryAsset/, 'workspace orchestrator should not convert library assets inline');
  assert.match(renderEdgesSource, /filterRenderableWorkspaceEdges/, 'renderable edge helper should omit edges whose handles are unavailable');
  assert.match(renderEdgesSource, /isWorkspaceConnectionCompatible/, 'renderable edge helper should omit persisted incompatible media-family edges');
  assert.match(canvasControllerHookSource, /filterRenderableWorkspaceEdges/, 'canvas controller should avoid passing invalid handle edges to React Flow');
  assert.match(templateProductAdSource, /createProductAdWorkspaceTemplate/, 'Product Ad starter template should be implemented in its own builder');
  assert.match(typesSource, /thumbnailUrl\?: string/, 'canvas template summaries should support visual thumbnails');
  assert.match(templateRegistrySource, /flow: 'Product ref -> style clip -> 4 shots'/, 'canvas template summaries should expose an AI workflow path');
  assert.match(canvasNavigatorPanelSource, /template\.thumbnailUrl/, 'canvas navigator should render image-backed template cards');
  assert.match(templateCoreSource, /type: 'workspace-smart'/, 'workspace edges should use the custom smart edge type');
  assert.match(templateDevBlocksSource, /createDevBlocksWorkspaceTemplate/, 'Dev Blocks starter template should be implemented in its own builder');
  assert.match(templateRegistrySource, /id: 'dev-blocks'/, 'Dev Blocks should be exposed as a starter template');
  assert.match(templateRegistrySource, /WORKSPACE_TEMPLATE_REGISTRY/, 'canvas templates should be routed through an additive registry');
  assert.match(templateCharacterDialogueSource, /createCharacterDialogueWorkspaceTemplate/, 'Character Dialogue should have a focused template builder');
  assert.match(templateStoryboardToVideoSource, /createStoryboardToVideoWorkspaceTemplate/, 'Storyboard should have a focused template builder');
  assert.match(templateUgcAdSource, /createUgcAdWorkspaceTemplate/, 'UGC should have a focused template builder');
  assert.match(templateCinematicSceneSource, /createCinematicSceneWorkspaceTemplate/, 'Cinematic Scene should have a focused template builder');
  assert.match(canvasControllerHookSource, /useWorkspaceRenderNodes/, 'canvas controller should delegate graph node render enrichment to a focused hook');
  assert.doesNotMatch(workspaceSource, /getWorkspaceShotTargetHandles/, 'orchestrator should not derive rendered shot target handles inline');
  assert.match(renderNodesHookSource, /getWorkspaceShotTargetHandles/, 'rendered shot nodes should derive target handles from the selected engine');
  assert.match(renderNodesHookSource, /sourceHandles:\s*\[shotOutputSourceHandle\(node\.data\.shot\)\]/, 'rendered shot nodes should expose one media-specific output source handle');
  assert.match(renderNodesHookSource, /inputConnectors/, 'rendered shot nodes should receive connector labels and metadata');
  assert.match(renderNodesHookSource, /validateShotConnections/, 'render node hook should own shot connection validation for rendered nodes');
  assert.match(renderNodesHookSource, /workspaceConnectionCapacity/, 'render node hook should own connector capacity labels for rendered nodes');
  assert.match(nodeSource, /workspace-shot-input-dock/, 'generate block input handles should delegate to a focused dock component');
  assert.match(shotInputDockSource, /function ShotInputDock/, 'generate block input handles should render in a dedicated bottom dock');
  assert.match(shotInputDockSource, /capacityLabel/, 'generate block input handles should render remaining/max counts for multi-reference connectors');
  assert.match(shotInputDockSource, /remainingCount === 0/, 'generate block input handles should mark full connectors as unavailable');
  assert.match(nodeSource, /statusPill[\s\S]*ShotInputDock/, 'generate block connector dock should render below the Ready status');
  assert.match(shotInputDockSource, /styles\.shotInputDock/, 'generate block should place connector labels in a bottom dock, not over the preview');
  assert.match(shotInputDockStyle, /display:\s*grid/, 'generate block connector dock should be styled in normal card flow');
  assert.doesNotMatch(shotInputDockStyle, /position:\s*absolute/, 'generate block connector dock should not be side-mounted');
  assert.match(shotInputDockStyle, /background:\s*transparent/, 'generate block connector dock should not render as a separate box');
  assert.doesNotMatch(shotInputDockStyle, /border:\s*1px/, 'generate block connector dock should not draw a boxed border');
  assert.match(canvasNodeStyleSource, /\.shotInputRow/, 'generate block connector rows should be styled in focused canvas node CSS');
  assert.match(shotInputDockSource, /left:\s*-12/, 'generate block input handles should sit on the card edge, not inside the label row');
  assert.match(typesSource, /pricingEstimate\?: WorkspacePricingEstimate/, 'shot nodes should carry a live parameter-based pricing estimate');
  assert.match(nodeSource, /pricingEstimate/, 'shot nodes should render live parameter-based pricing estimates');
  assert.doesNotMatch(nodeSource, /estimated_cost_or_credits/, 'shot nodes should not render static engine pricing as the estimate');
  assert.doesNotMatch(nodeSource, /function isPlayableVideoUrl/, 'node renderers should not redefine playable video detection inline');
  assert.doesNotMatch(nodeSource, /function isPlayableAudioUrl/, 'node renderers should not redefine playable audio detection inline');
  assert.match(nodeSource, /from '..\/..\/_lib\/workspace-media-availability'/, 'node renderers should consume shared media availability helpers');
  assert.match(nodeSource, /VideoPreview/, 'video-capable blocks should delegate playable preview markup');
  assert.match(nodeMediaPreviewSource, /<video[\s\S]*controls/, 'video-capable blocks should render playable previews when a video URL exists');
  assert.match(nodeMediaPreviewSource, /<audio[\s\S]*controls/, 'audio blocks should render playable controls when an audio URL exists');
  assert.match(nodeSource, /outputStatus/, 'output blocks should use shared placeholder, processing, and ready display state derivation');
  assert.match(nodeSource, /Processing/, 'output blocks should show a processing placeholder while generation is running');
  assert.match(nodeSource, /disabled=\{!canSendToTimeline\}/, 'output blocks should not send placeholders or processing outputs to the timeline');
  assert.match(nodeFrameSource, /const OUTPUT_NODE_MIN_HEIGHT/, 'output nodes should have a dedicated resize minimum for timeline actions');
  assert.match(nodeFrameSource, /sourceNodeMinHeight\(data\.kind\)/, 'node resize controls should use kind-specific minimum heights');
  assert.match(canvasNodeStyleSource, /\.sourceResizableNode\.outputNode[\s\S]*min-height:\s*190px/, 'output nodes should reserve enough default height for media, metadata, and Send to timeline');
  assert.match(nodeSource, /function EmptyMediaPicker/, 'media nodes should render an empty picker state when no media is attached');
  assert.match(nodeSource, /onOpenAssetLibrary/, 'media node plus button should open the editor asset library');
  assert.doesNotMatch(nodeSource, /asset\.filename\s*\?\?\s*data\.subtitle/, 'media node meta rows should not duplicate the filename already shown below the node title');
  assert.match(nodeSource, /styles\.assetMetaRow/, 'media node meta rows should use a focused alignment class');
  assert.match(canvasNodeStyleSource, /\.assetMetaRow[\s\S]*justify-content:\s*flex-end/, 'media node meta rows should keep media details aligned to the trailing edge');
  assert.match(settingsSource, /ShotNodeInspector/, 'node settings panel should delegate shot settings to a focused component');
  assert.match(shotNodeInspectorSource, /pricingEstimate/, 'shot inspector should render the same live pricing estimate');
  assert.match(shotNodeInspectorSource, /render_options/, 'shot inspector should render engine-derived render options');
  assert.doesNotMatch(shotNodeInspectorSource, /<span>Lip-sync<\/span>[\s\S]*lipSyncEnabled/, 'shot inspector should not always render a generic lip-sync toggle');
  assert.match(shotNodeInspectorSource, /recommendedModels[\s\S]*slice\(0,\s*4\)/, 'shot inspector model selector should cap inline recommendations at four models');
  assert.match(shotNodeInspectorSource, /<optgroup label=\{copy\.recommended\}>[\s\S]*recommendedModels\.map/, 'shot inspector model selector should expose recommended models inside the model dropdown through localized copy');
  assert.match(shotNodeInspectorSource, /remainingCapabilities = compatibleCapabilities\.filter/, 'shot inspector model selector should derive the compatible remaining model list after recommendations');
  assert.match(shotNodeInspectorSource, /<optgroup label=\{copy\.allModels\}>[\s\S]*remainingCapabilities\.map/, 'shot inspector model selector should keep the full model list available after recommendations through localized copy');
  assert.doesNotMatch(shotNodeInspectorSource, /styles\.recommendationList|<span>Recommended models<\/span>/, 'shot inspector should not render a separate recommended models section');
  assert.doesNotMatch(styleSource, /\.recommendationList/, 'editor CSS should not keep styling for the removed recommendation section');
  assert.match(shotNodeInspectorSource, /styles\.pricingActionSummary[\s\S]*pricingEstimate[\s\S]*styles\.primaryPanelButton[\s\S]*copy\.routing[\s\S]*copy\.availableInputs/, 'shot inspector should keep routing and available inputs below the price and generate action through localized copy');
  assert.match(settingsSource, /_styles\/inspector\.module\.css/, 'node settings inspector should import its focused inspector CSS module');
  assert.match(timelineClipInspectorSource, /_styles\/inspector\.module\.css/, 'timeline clip inspector should import its focused inspector CSS module');
  assert.match(inspectorStyleSource, /\.settingsPanel/, 'inspector CSS module should own the settings panel shell');
  assert.match(inspectorStyleSource, /\.settingsInput/, 'inspector CSS module should own form controls');
  assert.match(inspectorStyleSource, /\.pricingActionSummary/, 'shot inspector price action summary should be styled in focused inspector CSS');
  assert.doesNotMatch(styleSource, /\.pricingActionSummary/, 'main editor CSS should no longer own inspector price summary styles after modularization');
  assert.match(settingsSource, /NodeInspectorMediaPreview/, 'node settings panel should delegate media previews to a focused component');
  assert.match(settingsSource, /NodeInspectorConnections/, 'node settings panel should delegate connection rows to a focused component');
  assert.match(settingsSource, /copy\.blockName/, 'node settings panel should expose a localized block name field');
  assert.match(settingsSource, /onPatchNodeData\(selectedNode\.id,\s*\{\s*title:/, 'node settings panel should rename the selected canvas block through the shared graph patch action');
  assert.doesNotMatch(settingsSource, /connections\.map/, 'node settings panel should not render graph connection rows inline');
  assert.match(nodeInspectorConnectionsSource, /connectedEdges/, 'node inspector connection component should own graph connection row derivation');
  assert.match(nodeInspectorConnectionsSource, /localizeStudioEdgeKindLabel/, 'node inspector connection component should render localized connector labels');
  assert.doesNotMatch(settingsSource, /<video[\s\S]*controls/, 'node settings panel should not own playable media preview markup inline');
  assert.match(nodeInspectorMediaPreviewSource, /<video[\s\S]*controls/, 'output and video inspectors should render playable media when a video URL exists');
  assert.match(nodeInspectorMediaPreviewSource, /workspace-media-availability/, 'node inspector media preview should consume shared playable media helpers');
  assert.match(settingsSource, /disabled=\{!canSendOutputToTimeline\}/, 'output inspector should disable timeline send for placeholder and processing outputs');
  assert.match(settingsSource, /onOpenAssetLibrary/, 'asset inspector should expose the same library picker action');
  assert.match(videoViewerSource, /export function WorkspaceVideoViewer/, 'viewer component should be exported');
  assert.match(videoViewerSource, /useProgramPlaybackSync/, 'viewer component should delegate media sync to a focused hook');
  assert.match(videoViewerSource, /ProgramMonitor/, 'viewer component should compose the program monitor surface');
  assert.match(videoViewerSource, /ProgramPlaybackLayers/, 'viewer component should compose stable media playback layers');
  assert.match(videoViewerSource, /ProgramControls/, 'viewer component should compose the playback and IN/OUT controls');
  assert.match(videoViewerSource, /selectedItemId/, 'viewer should follow timeline clip selection');
  assert.match(videoViewerSource, /onSelectItem/, 'viewer should keep timeline selection synchronized with the active program clip');
  assert.match(videoViewerSource, /playheadSec/, 'viewer should follow the shared timeline playhead');
  assert.doesNotMatch(videoViewerSource, /onPlayheadChange/, 'viewer should not duplicate timeline scrubbing or thumbnail strip navigation');
  assert.match(videoViewerSource, /isPlaying/, 'viewer should receive shared montage playback state from the workspace');
  assert.doesNotMatch(videoViewerSource, /onPlaybackChange/, 'viewer should not duplicate play/pause controls already owned by the timeline toolbar');
  assert.match(programPlaybackSyncSource, /sourceStartSec/, 'playback sync should seek into split clips instead of replaying the media from zero');
  assert.match(programPlaybackSyncSource, /currentTime/, 'playback sync should seek underlying media elements to the clip source in-point');
  assert.match(programPlaybackSyncSource, /PlaybackLayer/, 'playback sync should build stable timeline playback layers instead of swapping one video source');
  assert.match(programPlaybackSyncSource, /playbackVideoRefs/, 'playback sync should keep one video element per timeline clip for smoother cut playback');
  assert.match(programPlaybackSyncSource, /itemsAtPlayhead\.forEach/, 'playback sync should reveal only video layers that cover the current playhead');
  assert.doesNotMatch(programPlaybackSyncSource, /itemsAtPlayhead\.length \? itemsAtPlayhead : activeItem/, 'playback sync should render video gaps as black instead of falling back to the selected clip');
  assert.match(programPlaybackSyncSource, /activePlaybackItem = itemAtPlayhead/, 'playback sync should only preload across actual timeline video clips, not selected fallback clips');
  assert.match(programPlaybackSyncSource, /shouldShowEmptyState = items\.length === 0 && !hasVisiblePlayableLayer/, 'playback sync should reserve the empty message for an empty timeline so audio-only or video-gap playback stays black');
  assert.match(programPlaybackSyncSource, /AudioPlaybackLayer/, 'playback sync should model audio timeline playback separately from visual video layers');
  assert.match(programPlaybackSyncSource, /playbackAudioRefs/, 'playback sync should keep audio track elements synchronized with the shared playhead');
  assert.match(programPlaybackSyncSource, /isPlayableAudioUrl/, 'playback sync should detect playable audio timeline sources');
  assert.match(programPlaybackLayersSource, /<audio[\s\S]*data-playback-audio-item-id/, 'playback layers should mount audio tracks for synchronized montage playback');
  assert.match(programPlaybackLayersSource, /linkedAudioGroupIds/, 'playback layers should mute video layers when a linked audio timeline track owns that sound');
  assert.match(videoViewerSource, /_styles\/viewer\.module\.css/, 'viewer shell should import its focused viewer CSS module');
  assert.match(programMonitorSource, /_styles\/viewer\.module\.css/, 'program monitor should import its focused viewer CSS module');
  assert.match(programPlaybackLayersSource, /_styles\/viewer\.module\.css/, 'program playback layers should import their focused viewer CSS module');
  assert.match(programControlsSource, /_styles\/viewer\.module\.css/, 'program controls should import their focused viewer CSS module');
  assert.match(viewerStyleSource, /\.viewerAudioLayer/, 'hidden audio playback elements should be styled in focused viewer CSS');
  assert.match(programPlaybackSyncSource, /PRELOAD_NEXT_CLIP_WINDOW_SEC/, 'playback sync should preload the next cut before the playhead reaches it');
  assert.match(programPlaybackSyncSource, /crossfadeDurationFor/, 'playback sync should preview crossfade transitions between adjacent timeline clips');
  assert.match(programPlaybackLayersSource, /viewerVideoLayerVisible/, 'playback layers should use opacity layers for smooth visual transitions');
  assert.match(programPlaybackLayersSource, /clipVisualStyleFor/, 'playback layers should apply selected clip transform settings to program monitor layers');
  assert.match(programPlaybackSyncSource, /resolveWorkspaceClipComposition/, 'viewer playback should share sequence/source composition logic with final renders');
  assert.match(programPlaybackSyncSource, /composition\.width \/ composition\.sequenceWidth/, 'viewer playback should scale source-pixel composition into the responsive program frame');
  assert.match(programPlaybackSyncSource, /layer\.item\.transform/, 'playback sync should read transform settings from timeline clips');
  assert.match(programPlaybackSyncSource, /video\.volume = layer\.item\.audioMix/, 'playback sync should apply timeline clip volume during playback');
  assert.match(programPlaybackLayersSource, /layer\.item\.audioMix\?\.muted/, 'playback layers should support muting timeline clip playback');
  assert.doesNotMatch(programPlaybackLayersSource, /onTimeUpdate/, 'playback layers should not let native video timeupdate fight the sequence playhead clock');
  assert.doesNotMatch(programPlaybackLayersSource, /key=\{playableUrl\}/, 'playback layers should not swap a single keyed video source at every cut');
  assert.match(programPlaybackLayersSource, /preload="auto"/, 'playback layers should warm the next media source instead of flashing a timeline thumbnail poster');
  assert.doesNotMatch(programPlaybackLayersSource, /poster=\{activeItem\?\.thumbnailUrl/, 'playback layers should not show clip thumbnails as subliminal posters between shot changes');
  assert.match(videoViewerSource, /projectSettings/, 'viewer should receive project-level playback settings');
  assert.match(programMonitorSource, /programMonitor/, 'program monitor should render a program monitor surface around the video');
  assert.match(programMonitorSource, /programFrameViewport/, 'program monitor should render the preview inside a contained program viewport');
  assert.match(programMonitorSource, /programFrame/, 'program monitor should constrain preview media to the project aspect-ratio frame');
  assert.match(programMonitorSource, /ProgramZoom/, 'program monitor should separate monitor zoom from sequence resolution settings');
  assert.match(programMonitorSource, /PROGRAM_ZOOM_VALUES/, 'program monitor should expose standard program zoom options');
  assert.match(programMonitorSource, /copy\.zoomTitle/, 'program monitor should label zoom as a monitor display setting through localized copy');
  assert.match(programMonitorSource, /programFrameScaled/, 'program monitor should support pixel-based sequence preview sizing outside Fit zoom');
  assert.match(programMonitorSource, /workspaceProjectDimensions/, 'program monitor should derive pixel preview size from project sequence dimensions');
  assert.match(programMonitorSource, /workspaceProjectAspectParts/, 'program monitor should use numeric aspect parts for contained program frame sizing');
  assert.match(programMonitorSource, /workspaceProjectAspectCssValue/, 'program monitor should derive frame aspect ratio from project settings');
  assert.match(programMonitorSource, /workspaceProjectDimensionsLabel/, 'program monitor should show project output dimensions');
  assert.match(programControlsSource, /data-viewer-playback-controls/, 'program controls should expose a stable playback controls test surface');
  assert.match(programControlsSource, /onGoToPreviousCut/, 'program controls should jump to the previous edit cut');
  assert.match(programControlsSource, /onGoToNextCut/, 'program controls should jump to the next edit cut');
  assert.match(programControlsSource, /onMarkIn/, 'program controls should expose Mark In');
  assert.match(programControlsSource, /onMarkOut/, 'program controls should expose Mark Out');
  assert.match(programControlsSource, /onSendSnapshotToCanvas/, 'program controls should send the current frame snapshot back to canvas');
  assert.match(programPlaybackSyncSource, /resolveProgramSnapshotFallbackSourceUrl/, 'viewer snapshots should only fall back to image-safe preview URLs when frame capture is unavailable');
  assert.doesNotMatch(videoViewerSource, /isSequenceSettingsOpen/, 'viewer should not own project settings dialog state');
  assert.doesNotMatch(videoViewerSource, /sequenceSettingsButton/, 'viewer should not expose project settings in its footer');
  assert.doesNotMatch(workspaceSource, /aria-label="Open project settings"/, 'topbar should not expose sequence settings as a project-level action');
  assert.doesNotMatch(workspaceSource, /WorkspaceProjectSettingsDialog/, 'workspace should not render a project settings dialog at shell level');
  assert.match(workspaceEditorLayoutSource, /selectedSequence=\{exportState\.selectedSequenceForInspector\}/, 'viewer mode inspector should receive selected sequence settings');
  assert.match(timelineProjectSidebarSource, /useProjectMediaController/, 'project media sidebar should delegate media behavior to the project media controller');
  assert.match(timelineProjectSidebarSource, /_styles\/media\.module\.css/, 'project media sidebar should import its focused media CSS module');
  assert.match(timelineProjectSidebarSource, /copy\.openSequence/, 'sequence cards should open a sequence from the Project media context menu through localized copy');
  assert.match(timelineProjectSidebarSource, /copy\.duplicate/, 'sequence cards should expose duplication from the Project media context menu through localized copy');
  assert.match(timelineProjectSidebarSource, /onDuplicate=\{projectMedia\.duplicateMenuItem\}/, 'project media sidebar should wire sequence duplication through its controller');
  assert.match(projectMediaControllerSource, /onInspectSequence\(sequenceId\)/, 'project media sequence cards should route sequence selection into the inspector');
  assert.match(projectMediaControllerSource, /onDuplicateSequence\(menu\.id\)/, 'project media controller should route sequence duplication to sequence actions');
  assert.match(timelineClipInspectorSource, /copy\.sequenceSettings/, 'timeline inspector should expose selected sequence settings through localized copy');
  assert.match(timelineClipInspectorSource, /copy\.aspectRatio/, 'timeline inspector should expose a sequence aspect ratio selector through localized copy');
  assert.match(timelineClipInspectorSource, /copy\.resolution/, 'timeline inspector should expose a sequence resolution selector through localized copy');
  assert.match(timelineClipInspectorSource, /copy\.fps/, 'timeline inspector should expose a sequence FPS selector through localized copy');
  assert.doesNotMatch(videoViewerSource, /viewerSequenceControls/, 'viewer should not keep sequence settings as always-visible footer controls');
  assert.match(videoViewerSource, /formatWorkspaceTimecode/, 'viewer should display frame-based timecode');
  assert.doesNotMatch(videoViewerSource, /viewerFooter/, 'viewer should not render a duplicate footer below the program monitor');
  assert.doesNotMatch(videoViewerSource, /viewerStrip/, 'viewer should not render duplicate clip thumbnails when the timeline is visible');
  assert.doesNotMatch(videoViewerSource, /viewerPlaybackButton/, 'viewer should not render duplicate playback controls when the timeline toolbar is visible');
  assert.doesNotMatch(videoViewerSource, /activeItem\?\.title \?\? 'Montage viewer'/, 'viewer footer should not repeat the selected shot title as low-value summary text');
  assert.doesNotMatch(videoViewerSource, /videoItems\.length\} clips/, 'viewer footer should not show a low-value clip count summary');
  assert.match(programPlaybackSyncSource, /video\.play\(\)/, 'playback sync should drive visible media layers from the shared montage playback state');
  assert.match(programPlaybackSyncSource, /video\.pause\(\)/, 'playback sync should pause inactive media layers cleanly');
  assert.doesNotMatch(videoViewerSource, /data-tooltip/, 'viewer should not carry toolbar tooltip responsibilities');
  assert.doesNotMatch(styleSource, /\.viewerFooter/, 'editor CSS should not keep a duplicate viewer footer');
  assert.doesNotMatch(styleSource, /\.viewerStrip/, 'editor CSS should not keep duplicate viewer thumbnail strip styling');
  assert.doesNotMatch(styleSource, /\.viewerPlaybackButton/, 'editor CSS should not keep duplicate viewer playback button styling');
  assert.match(workspaceSource, /useWorkspaceTimelinePlayback/, 'workspace should delegate shared montage playback state to a route-local hook');
  assert.match(timelinePlaybackHookSource, /isTimelinePlaying/, 'timeline playback hook should own shared montage playback state');
  assert.match(timelinePlaybackHookSource, /setInterval/, 'timeline playback hook should advance the playhead from a timeline clock, not only native video controls');
  assert.match(timelinePlaybackHookSource, /handleToggleTimelinePlayback/, 'timeline playback hook should expose a shared play/pause toggle');
  assert.doesNotMatch(workspaceSource, /setInterval\(tick, 50\)/, 'workspace orchestrator should not own the playback tick loop inline');
  assert.match(workspaceSource, /useWorkspaceTimelineHistory/, 'workspace should delegate timeline undo and redo history to a route-local hook');
  assert.match(timelineHistoryHookSource, /TimelineHistoryState/, 'timeline history hook should own the undo and redo history state');
  assert.match(timelineHistoryHookSource, /TIMELINE_HISTORY_LIMIT/, 'timeline history hook should enforce the shared history limit');
  assert.match(timelineHistoryHookSource, /normalizeWorkspaceTimelineIdentities/, 'timeline history hook should normalize committed timeline item identities');
  assert.doesNotMatch(workspaceSource, /useState<TimelineHistoryState>/, 'orchestrator should not own the timeline history state container');
  assert.doesNotMatch(workspaceSource, /\bsetTimelineHistory\s*\(/, 'orchestrator should not mutate timeline history directly');
  assert.match(workspaceEditorLayoutSource, /onUndo=\{timelineHistory\.undoTimeline\}/, 'workspace should support timeline undo');
  assert.match(workspaceEditorLayoutSource, /onRedo=\{timelineHistory\.redoTimeline\}/, 'workspace should support timeline redo');
  assert.match(workspaceSource, /useWorkspaceCanvasGraphState/, 'workspace should delegate canvas graph state to a route-local hook');
  assert.match(canvasGraphStateHookSource, /useWorkspaceCanvasHistory/, 'canvas graph state hook should delegate undo and redo to the history hook');
  assert.match(canvasHistoryHookSource, /CanvasGraphHistoryState/, 'canvas history hook should own graph undo and redo state');
  assert.match(canvasHistoryHookSource, /commitCanvasGraph/, 'canvas history hook should expose a graph commit wrapper');
  assert.match(canvasHistoryHookSource, /undoCanvas/, 'canvas history hook should expose canvas undo');
  assert.match(canvasHistoryHookSource, /redoCanvas/, 'canvas history hook should expose canvas redo');
  assert.doesNotMatch(workspaceSource, /useState<CanvasGraphHistoryState>/, 'workspace orchestrator should not own canvas history state directly');
  assert.match(workspaceEditorLayoutSource, /onUndo:\s*canvas\.undoCanvas/, 'canvas toolbar should receive canvas undo');
  assert.match(workspaceEditorLayoutSource, /onRedo:\s*canvas\.redoCanvas/, 'canvas toolbar should receive canvas redo');
  assert.match(canvasFloatingToolbarSource, /Undo2/, 'canvas toolbar should render an undo button');
  assert.match(canvasFloatingToolbarSource, /Redo2/, 'canvas toolbar should render a redo button');
  assert.match(canvasSource, /canvasHistoryShortcut/, 'canvas should centralize undo and redo shortcut parsing');
  assert.match(canvasSource, /key === 'z'[\s\S]*'undo'/, 'canvas should treat Cmd/Ctrl+Z as undo before considering physical key codes');
  assert.match(canvasSource, /key === 'y'[\s\S]*'redo'/, 'canvas should treat Cmd/Ctrl+Y as redo');
  assert.match(canvasSource, /isEditableCanvasShortcutTarget/, 'canvas shortcuts should not intercept native text editing undo');
  assert.match(canvasSource, /contentEditable\.toLowerCase\(\) !== 'false'/, 'canvas shortcuts should skip all editable contenteditable targets');
  assert.doesNotMatch(workspaceSource, /timelineEditMode/, 'workspace should no longer expose selectable insert, overwrite, or replace timeline modes');
  assert.match(canvasTimelineActionsHookSource, /insertWorkspaceTimelineItems/, 'canvas outputs should enter the sequence through timeline insert operations');
  assert.match(workspaceEditorLayoutSource, /onNodeDropToTimeline=\{canvas\.handleDropNodeToTimeline\}/, 'canvas media nodes should be droppable directly onto a timeline track');
  assert.match(canvasTimelineActionsHookSource, /retargetWorkspaceTimelineItemsForTrack/, 'timeline drops should retarget visual and audio clips to the dropped lane');
  assert.doesNotMatch(workspaceSource, /retargetWorkspaceTimelineItemsForTrack/, 'workspace orchestrator should not own canvas node timeline retargeting inline');
  assert.match(exportStateHookSource, /selectedTimelineItem/, 'workspace export state should derive the selected timeline item for Viewer mode editing');
  assert.match(workspaceEditorLayoutSource, /onPatchItem=\{timelineClip\.handlePatchTimelineItem\}/, 'editor layout should expose timeline clip patching for the clip inspector');
  assert.match(workspaceSource, /projectSettings/, 'workspace should persist and pass project-level aspect ratio, resolution, and FPS');
  assert.match(shellActionsHookSource, /handleSequenceSettingsChange/, 'workspace shell action hook should expose sequence settings changes from the inspector');
  assert.doesNotMatch(shellActionsHookSource, /handleProjectSettingsChange/, 'sequence settings should not be named as project-level settings in the shell action contract');
  assert.match(shellActionsHookSource, /coerceWorkspaceProjectSettings/, 'workspace shell action hook should sanitize sequence settings before use');
  assert.doesNotMatch(workspaceSource, /coerceWorkspaceProjectSettings/, 'workspace orchestrator should not sanitize sequence settings inline');
  assert.match(shellActionsHookSource, /coerceTimelinePanelHeight/, 'workspace shell action hook should sanitize timeline panel height updates');
  assert.match(workspaceSource, /useExportController/, 'workspace should delegate export job state and server calls to the export controller');
  assert.match(workspaceSource, /useWorkspaceExportState/, 'workspace should delegate viewer and export derived state to a route-local hook');
  assert.doesNotMatch(workspaceSource, /RENDER_MANIFEST_STORAGE_KEY/, 'workspace should not persist render handoff storage inline');
  assert.doesNotMatch(workspaceSource, /VIDEO_EXPORT_REQUEST_STORAGE_KEY/, 'workspace should not persist video export request storage inline');
  assert.doesNotMatch(workspaceSource, /\/api\/studio\/timeline-exports/, 'workspace should not call server export endpoints inline');
  assert.match(exportControllerSource, /RENDER_MANIFEST_STORAGE_KEY/, 'export controller should persist the latest timeline render handoff locally');
  assert.match(exportControllerSource, /VIDEO_EXPORT_REQUEST_STORAGE_KEY/, 'export controller should persist the latest MP4 video export request locally');
  assert.match(exportControllerSource, /\/api\/studio\/timeline-exports\/estimate/, 'export controller should estimate server export cost before queueing the job');
  assert.match(exportControllerSource, /\/api\/studio\/timeline-exports\/\$\{activeExportJob\.id\}/, 'export controller should poll server render export jobs');
  assert.match(exportControllerSource, /\/api\/studio\/timeline-exports/, 'export controller should create server render export jobs');
  assert.doesNotMatch(workspaceSource, /Render backend pending/, 'export action should no longer present a fake pending backend');
  assert.doesNotMatch(workspaceSource, /buildWorkspaceTimelineRenderManifest\(/, 'workspace orchestrator should not build timeline render manifests inline');
  assert.match(exportStateHookSource, /buildWorkspaceTimelineRenderManifest/, 'workspace export state hook should build a timeline render manifest');
  assert.match(exportStateHookSource, /activeSequenceId/, 'workspace export state should attach the active sequence identity to render manifests');
  assert.match(exportStateHookSource, /filterHiddenVideoTrackItems/, 'workspace export state hook should filter hidden video tracks for viewer and export state');
  assert.match(exportStateHookSource, /muteAudioTrackItems/, 'workspace export state hook should apply muted audio tracks for viewer and export state');
  assert.match(timelineRenderSource, /sequenceId/, 'timeline render manifests should include the source Studio sequence id');
  assert.match(timelineRenderSource, /sequenceName/, 'timeline render manifests should include the source Studio sequence name');
  assert.match(exportControllerSource, /serializeWorkspaceTimelineRenderManifest/, 'export controller should serialize the render manifest contract');
  assert.match(exportControllerSource, /workspace-timeline-export/, 'export controller should import export-specific contracts from the timeline export helper');
  assert.match(exportControllerSource, /buildWorkspaceTimelineVideoExportRequest/, 'export controller should build the MP4 video export request contract');
  assert.match(exportControllerSource, /serializeWorkspaceTimelineVideoExportRequest/, 'export controller should serialize the video export request contract');
  assert.match(exportControllerSource, /buildWorkspaceTimelineEdl/, 'export controller should keep EDL export local and separate from MP4 server render');
  assert.match(exportControllerSource, /setInterval/, 'export controller should poll queued and rendering server jobs');
  assert.match(exportControllerSource, /humanizeTimelineExportError/, 'export controller should translate server worker failures into user-facing export messages');
  assert.match(exportControllerSource, /MISSING_TIMELINE_EXPORT_ECS_/, 'export controller should explain missing ECS worker configuration');
  assert.match(exportControllerSource, /if \(job\) setActiveExportJob\(job\)/, 'export controller should keep failed server jobs visible after create failures');
  assert.match(exportControllerSource, /activeExportJob && isTerminalExportJob\(activeExportJob\)/, 'export retries after terminal jobs should use a fresh idempotency key');
  assert.match(exportDialogSource, /copy\.queuedServerWorker/, 'export dialog should explain queued jobs are claimed by the Fargate worker through localized copy');
  assert.match(exportDialogSource, /exportJobStatusLabel/, 'export dialog should show user-facing server export statuses');
  assert.match(exportDialogSource, /copy\.retryExport/, 'export dialog should expose an explicit retry label after failed jobs through localized copy');
  assert.match(exportDialogSource, /copy\.downloadMp4/, 'export dialog should expose the rendered MP4 output link through localized copy');
  assert.match(workspaceSource, /exportQualityPreset/, 'workspace export action should keep the selected video quality preset');
  assert.match(workspaceEditorLayoutSource, /onExportVideo=\{exportController\.exportTimelineVideo\}/, 'workspace should wire the primary export video action from the export controller');
  assert.match(workspaceEditorLayoutSource, /onPrepareRender=\{exportController\.exportTimelineRender\}/, 'workspace should wire the export dialog render action to timeline render handoff');
  assert.match(timelineSource, /TimelineClip/, 'timeline should compose focused clip components instead of owning clip JSX inline');
  assert.match(timelineSource, /TimelineContextMenus/, 'timeline should compose focused context menu components instead of owning menu JSX inline');
  assert.match(timelineSource, /TimelineRuler/, 'timeline should compose a focused ruler component instead of owning ruler JSX inline');
  assert.match(timelineSource, /TimelineTrackList/, 'timeline should compose a focused track list component instead of owning track mapping JSX inline');
  assert.match(timelineTrackListSource, /TimelineTrackRow/, 'timeline track list should compose focused track row components');
  assert.match(timelineTrackListSource, /TimelineClip/, 'timeline track list should compose focused clip components');
  assert.match(timelineSource, /TimelineToolbar/, 'timeline should compose a focused toolbar component instead of owning toolbar JSX inline');
  assert.match(timelineToolbarSource, /Scissors/, 'timeline toolbar should expose a cut tool');
  assert.match(timelineRulerSource, /Magnet/, 'timeline ruler should expose a snapping toggle');
  assert.match(timelineRulerSource, /SplitSquareHorizontal/, 'timeline ruler should expose the insert-into-clip toggle beside snapping');
  assert.match(timelineToolbarSource, /ZoomIn/, 'timeline toolbar should expose compact zoom-in control');
  assert.match(timelineToolbarSource, /ZoomOut/, 'timeline toolbar should expose compact zoom-out control');
  assert.match(timelineSource, /DEFAULT_TIMELINE_PIXELS_PER_SECOND/, 'timeline should own a default horizontal zoom scale');
  assert.match(timelineSource, /MIN_TIMELINE_PIXELS_PER_SECOND/, 'timeline should cap zooming out to a usable density');
  assert.match(timelineSource, /MAX_TIMELINE_PIXELS_PER_SECOND/, 'timeline should cap zooming in to a usable density');
  assert.match(timelineSource, /buildTimelineTracks/, 'timeline should consume focused track definitions');
  assert.match(timelineTrackDefinitionsSource, /buildTimelineTracks/, 'timeline track definitions should build video tracks dynamically before fixed audio tracks');
  assert.match(timelineTrackDefinitionsSource, /displayedVideoTracks = \[\.\.\.videoTracks\]\.reverse\(\)/, 'new video tracks should display above V1 while audio tracks stay below video tracks');
  assert.match(timelineTrackDefinitionsSource, /timelineVideoTrackId/, 'timeline should label added video tracks as V2, V3, and later');
  assert.match(timelineTrackRowSource, /data-timeline-add-track="video"/, 'timeline track row should own compact add-video-track controls');
  assert.match(timelineTrackRowSource, /data-timeline-add-track="audio"/, 'timeline track row should own compact add-audio-track controls');
  assert.match(timelineTrackRowSource, /data-timeline-video-visibility/, 'timeline track row should own video track visibility toggles');
  assert.match(timelineTrackRowSource, /data-timeline-audio-mute/, 'timeline track row should own audio track mute toggles');
  assert.match(timelineTrackRowSource, /data-timeline-track-lock/, 'timeline track row should own track lock toggles');
  assert.match(timelineSource, /snapEnabled/, 'timeline should keep snap mode state');
  assert.match(timelineInteractionSource, /SNAP_TARGET_THRESHOLD_PIXELS/, 'timeline snapping should use a subtle proximity threshold');
  assert.match(timelineInteractionSource, /buildSnapTargets/, 'timeline should snap to clip edges, playhead, and zero');
  assert.doesNotMatch(timelineSource, /function buildSnapTargets/, 'timeline component should not own snap-target calculation inline');
  assert.match(timelineRulerSource, /timelineSnapGuide/, 'timeline ruler should render a visible snap guide while editing');
  assert.match(timelineTrackRowSource, /timelineSnapGuide/, 'timeline track rows should render visible snap guides while editing');
  assert.match(timelineSource, /activeTimelineTool/, 'timeline should keep a selected edit tool mode');
  assert.match(timelineToolbarSource, /copy\.blade/, 'cut should be a selected blade tool instead of only a per-clip duplicate action');
  assert.match(timelineToolbarSource, /copy\.editingTools/, 'timeline should expose editing tools as a toolbar');
  assert.match(
    timelineToolbarSource,
    /timelineZoomSlot[\s\S]*timelineTransport[\s\S]*timelineToolGroup[\s\S]*timelineZoomControl/,
    'timeline undo, redo, and editing tools should sit in the right action slot immediately before zoom'
  );
  assert.match(timelineToolbarSource, /copy\.selection/, 'timeline should expose selection as an editing tool');
  assert.doesNotMatch(timelineToolbarSource, /aria-label="Trim tool"/, 'timeline toolbar should not expose trim as a selected tool while clip handles own simple trimming');
  assert.doesNotMatch(timelineToolbarSource, /aria-label="Ripple trim tool"/, 'timeline toolbar should not expose ripple trim for now');
  assert.doesNotMatch(timelineToolbarSource, /aria-label="Roll trim tool"/, 'timeline toolbar should not expose roll trim for now');
  assert.match(timelineToolbarSource, /data-tooltip/, 'timeline editing tools should expose shortcut tooltips');
  assert.match(timelineSource, /useTimelineKeyboardShortcuts/, 'timeline should delegate shortcut registration to the focused hook');
  assert.doesNotMatch(timelineSource, /isTimelineShortcutTarget|event\.code === 'Space'|event\.code === 'KeyC'/, 'timeline component should not own keyboard shortcut routing inline');
  assert.match(timelineSource, /_styles\/timeline\.module\.css/, 'workspace timeline shell should import focused timeline CSS');
  assert.match(timelineToolbarSource, /_styles\/timeline-controls\.module\.css/, 'timeline toolbar should import focused timeline control CSS');
  assert.match(timelineRulerSource, /_styles\/timeline\.module\.css/, 'timeline ruler should import focused timeline CSS');
  assert.match(timelineRulerSource, /_styles\/timeline-controls\.module\.css/, 'timeline ruler should reuse focused timeline control button CSS');
  assert.match(timelineTrackRowSource, /_styles\/timeline\.module\.css/, 'timeline track rows should import focused timeline CSS');
  assert.match(timelineClipSource, /_styles\/timeline-clips\.module\.css/, 'timeline clips should import focused timeline clip CSS');
  assert.match(timelineKeyboardShortcutsSource, /event\.code === 'Space'/, 'Space should toggle montage playback');
  assert.match(timelineKeyboardShortcutsSource, /event\.key === ' '/, 'Space shortcut should tolerate browser key/code differences');
  assert.match(timelineKeyboardShortcutsSource, /event\.code === 'KeyC'/, 'C should activate the cut tool');
  assert.match(timelineKeyboardShortcutsSource, /event\.code === 'KeyV'/, 'V should return to the select and drag tool');
  assert.match(timelineKeyboardShortcutsSource, /event\.code === 'KeyM'/, 'M should toggle timeline snapping');
  assert.doesNotMatch(timelineKeyboardShortcutsSource, /event\.code === 'KeyT'/, 'T should not activate a hidden trim tool');
  assert.doesNotMatch(timelineKeyboardShortcutsSource, /event\.code === 'KeyR'/, 'R should not activate hidden ripple trim');
  assert.doesNotMatch(timelineKeyboardShortcutsSource, /event\.code === 'KeyY'/, 'Y should not activate hidden roll trim');
  assert.match(timelineKeyboardShortcutsSource, /event\.code === 'Delete'/, 'Delete should remove the selected timeline clip');
  assert.match(timelineKeyboardShortcutsSource, /Cmd\/Ctrl \+ Z|KeyZ/, 'timeline should expose undo and redo shortcuts');
  assert.match(
    timelineKeyboardShortcutsSource,
    /event\.code === 'KeyZ'[\s\S]*if \(!isShortcutActive\) return/,
    'timeline undo and redo shortcuts should run before the surface-scoped shortcut gate'
  );
  assert.doesNotMatch(timelineSource, /Timeline insert mode/, 'timeline toolbar should not expose insert, overwrite, or replace mode switches');
  assert.doesNotMatch(timelineSource, /Timeline trim mode/, 'timeline should not expose trim, ripple, and roll as a text mode switch');
  assert.doesNotMatch(timelineSource, /Toggle crossfade transition/, 'timeline toolbar should not expose ad hoc crossfade controls before the effects menu exists');
  assert.match(timelineKeyboardShortcutsSource, /event\.code === 'KeyS'|KeyB/, 'timeline should expose a keyboard split shortcut at the playhead');
  assert.match(timelineClipSource, /timelineClipCutMode/, 'timeline clip should render a dedicated cut-mode pointer state');
  assert.match(timelineSource, /getBoundingClientRect/, 'cut tool should convert the mouse position on the clip into a split time');
  assert.match(timelineSource, /playheadSec/, 'timeline should render and control a playhead');
  assert.match(timelineSource, /projectFps/, 'timeline should format playhead and ruler labels from project FPS');
  assert.match(timelineSource, /formatWorkspaceTimecode/, 'timeline should display HH:MM:SS:FF timecode labels');
  assert.match(timelineSource, /handleBeginPlayheadDrag/, 'timeline should let users drag the playhead line directly');
  assert.match(timelineSource, /handleBeginTimelineSurfacePointerDown/, 'timeline should let users drag empty timeline space to scrub');
  assert.match(timelineRulerSource, /data-playhead-handle="true"/, 'timeline ruler playhead should expose an interactive handle on the line');
  assert.match(timelineTrackRowSource, /data-playhead-handle="true"/, 'timeline track rows should expose interactive playhead handles on each lane');
  assert.match(timelineRulerSource, /copy\.dragPlayhead/, 'timeline ruler playhead handle should have a clear accessible label through localized copy');
  assert.match(timelineTrackRowSource, /copy\.dragPlayheadOnTrack/, 'timeline row playhead handles should have clear accessible labels through localized copy');
  assert.match(timelineRulerSource, /copy\.scrubber/, 'timeline ruler should expose a scrubber for playhead positioning through localized copy');
  assert.match(timelineSource, /onResizeItem/, 'timeline clips should wire resize controls');
  assert.match(timelineClipSource, /copy\.trimStart/, 'timeline clips should expose a start trim handle through localized copy');
  assert.match(timelineClipSource, /copy\.trimEnd/, 'timeline clips should expose an end trim handle through localized copy');
  assert.match(timelineContextMenusSource, /copy\.clips\.unlinkSelected/, 'timeline context menus should expose clip unlink actions through localized copy');
  assert.match(timelineContextMenusSource, /copy\.clips\.linkSelected/, 'timeline context menus should expose clip link actions through localized copy');
  assert.match(timelineContextMenusSource, /copy\.tracks\.addTrack/, 'timeline context menus should expose track add actions through localized copy');
  assert.match(timelineContextMenusSource, /copy\.tracks\.deleteTrack/, 'timeline context menus should expose track delete actions through localized copy');
  assert.match(timelineClipInteractionHookSource, /TimelineInteractionState/, 'timeline clip interaction hook should keep lightweight preview state during pointer edits');
  assert.match(timelineClipInteractionHookSource, /originSourceStartSec/, 'timeline drag preview should remember the selected clip source in-point');
  assert.match(timelineClipInteractionHookSource, /originSourceDurationSec/, 'timeline drag preview should remember the selected clip source duration');
  assert.match(timelineClipInteractionHookSource, /previewTrack/, 'timeline drag preview should track the target video lane under the pointer');
  assert.match(timelineClipInteractionHookSource, /trackAtClientY/, 'timeline should infer the destination video track from pointer position');
  assert.match(timelineTrackRowSource, /data-timeline-track/, 'timeline lanes should expose stable track ids for vertical clip dragging');
  assert.match(timelineInteractionSource, /maxResizeDurationForInteraction/, 'timeline drag preview should cap handle extension to available source media');
  assert.match(timelineSource, /onPointerDown/, 'timeline should start mouse and pen edits from pointer events');
  assert.match(timelineClipInteractionHookSource, /pointermove/, 'timeline clip interaction hook should preview clip movement while dragging');
  assert.match(timelineClipInteractionHookSource, /pointerup/, 'timeline clip interaction hook should commit movement and resize edits on release');
  assert.match(timelineExternalDropSource, /application\/x-maxvideoai-timeline-node/, 'timeline should accept ready canvas media node drops');
  assert.match(timelineTrackRowSource, /timelineExternalDropGhost/, 'timeline track rows should preview external block insertions before drop');
  assert.match(timelineTrackRowSource, /data-timeline-external-drop-duration/, 'timeline external drop preview should expose the incoming clip duration for browser tests');
  assert.match(timelineExternalDropSource, /hasTimelineAudio/, 'timeline external drop payloads should carry whether a video drop will create linked audio');
  assert.match(timelineTrackRowSource, /ghostItems/, 'timeline track rows should render every external drop ghost, including linked audio peers');
  assert.match(timelineTrackRowSource, /data-timeline-external-drop-linked-audio-ghost/, 'timeline track rows should expose linked audio drop ghosts for browser tests');
  assert.match(timelineExternalDropSource, /localizeWorkspaceTimelineItemTitle\(item,\s*copy\)/, 'timeline displacement previews should localize generated titles through timeline provenance');
  assert.match(timelineTrackRowSource, /\{item\.title\}/, 'timeline displacement ghost titles should render the preview label resolved by the external-drop helper');
  assert.doesNotMatch(timelineTrackRowSource, /localizeStudioGeneratedCanvasText/, 'timeline track rows should not relocalize raw clip titles by text pattern');
  assert.match(timelineProjectSidebarSource, /data-project-media-duration-sec/, 'viewer media cards should include clip duration in their timeline drag payload');
  assert.match(timelineClipInteractionHookSource, /setPointerCapture/, 'timeline clip interaction hook should capture pointer drags instead of relying on HTML drag/drop');
  assert.match(timelineSource, /onPositionItem/, 'timeline should commit direct clip movement');
  assert.match(timelineSource, /onResizeItem/, 'timeline should commit direct clip resizing');
  assert.doesNotMatch(timelineSource, /draggable/, 'timeline clips should not use native HTML drag/drop for editor movement');
  assert.doesNotMatch(timelineClipStyleSource, /\.timelineClip[\s\S]*min-width:\s*160px/, 'timeline clip widths should reflect time positions instead of overlapping cut segments with a large fixed minimum');
  assert.match(timelineSource, /selectedItemId/, 'timeline should expose selected clip state');
  assert.match(timelineSource, /onCutItem/, 'timeline should wire the cut tool to selected clips');
  assert.match(timelineToolbarSource, /timelineZoomControl/, 'timeline toolbar should keep zoom controls visually compact');
  assert.match(timelineClipSource, /timelineWaveform/, 'timeline audio clips should render lightweight waveform previews');
  assert.match(workspaceEditorLayoutSource, /<WorkspaceVideoViewer[\s\S]*playheadSec=\{previewPlayheadSec\}/, 'workspace should pass the shared playhead into the montage viewer');
  assert.doesNotMatch(workspaceEditorLayoutSource, /<WorkspaceVideoViewer(?:(?!\/>)[\s\S])*onPlayheadChange=/, 'workspace should keep playhead editing in the timeline instead of the viewer');
  assert.match(workspaceEditorLayoutSource, /<TimelineClipInspector[\s\S]*selectedItem=\{exportState\.selectedTimelineItem\}/, 'viewer mode inspector should edit the selected timeline item');
  assert.match(workspaceEditorLayoutSource, /<TimelineClipInspector[\s\S]*selectedAsset=\{exportState\.selectedProjectAssetForInspector\}/, 'viewer mode inspector should inspect the selected project media asset');
  assert.match(workspaceEditorLayoutSource, /<TimelineClipInspector[\s\S]*onPatchItem=\{timelineClip\.handlePatchTimelineItem\}/, 'viewer mode inspector should patch timeline clip edit properties');
  assert.match(workspaceEditorLayoutSource, /<TimelineClipInspector[\s\S]*onRenameProjectAsset=\{projectMedia\.handleRenameProjectAsset\}/, 'viewer mode inspector should rename selected project media assets through project media actions');
  assert.match(timelineClipInspectorSource, /export function TimelineClipInspector/, 'timeline clip inspector should be exported');
  assert.match(timelineClipInspectorSource, /function ProjectMediaAssetInspector/, 'timeline inspector should include a project media asset inspector');
  assert.match(timelineClipInspectorSource, /if \(selectedAsset\)[\s\S]*<ProjectMediaAssetInspector/, 'project media asset selection should drive the viewer inspector before timeline clips');
  assert.match(timelineClipInspectorSource, /onRenameProjectAsset\(asset\.id/, 'project media asset inspector should rename the selected asset');
  assert.match(timelineClipInspectorSource, /asset\.durationSec[\s\S]*asset\.dimensions[\s\S]*asset\.kind/, 'project media asset inspector should expose file duration, resolution, and type');
  assert.match(timelineClipInspectorSource, /if \(selectedSequence\)[\s\S]*<SequenceInspector/, 'project media sequence selection should drive the viewer inspector even when a timeline clip remains selected');
  assert.match(timelineProjectSidebarSource, /onInspectProjectAsset\(assetId\)/, 'project media sidebar should request asset inspection when an asset card is selected');
  assert.match(timelineClipInspectorSource, /copy\.clipInspector/, 'timeline clip inspector should render a focused empty state through localized copy');
  assert.match(timelineClipInspectorSource, /formatWorkspaceTimecode/, 'timeline clip inspector should show frame-accurate clip timing');
  assert.match(timelineClipInspectorSource, /copy\.scale/, 'timeline clip inspector should expose video scale through localized copy');
  assert.match(timelineClipInspectorSource, /copy\.positionX/, 'timeline clip inspector should expose video horizontal position through localized copy');
  assert.match(timelineClipInspectorSource, /copy\.positionY/, 'timeline clip inspector should expose video vertical position through localized copy');
  assert.match(timelineClipInspectorSource, /copy\.rotation/, 'timeline clip inspector should expose video rotation through localized copy');
  assert.match(timelineClipInspectorSource, /copy\.opacity/, 'timeline clip inspector should expose video opacity through localized copy');
  assert.match(timelineClipInspectorSource, /isWorkspaceTimelineVideoTrack/, 'timeline clip inspector should expose audio controls for every video track');
  assert.match(timelineClipInspectorSource, /copy\.volume/, 'timeline clip inspector should expose clip volume through localized copy');
  assert.match(timelineClipInspectorSource, /copy\.muteClip/, 'timeline clip inspector should expose clip mute through localized copy');
  assert.match(timelineClipInspectorSource, /copy\.crossfade/, 'timeline clip inspector should expose selected-clip transition controls through localized copy');
  assert.match(timelineClipInspectorSource, /onPatchItem\(selectedItem\.id/, 'timeline clip inspector should patch the selected timeline item only');
  assert.match(settingsSource, /copy\.insertAtPlayhead/, 'output inspector should expose insert at playhead through localized copy');
  assert.doesNotMatch(settingsSource, /Overwrite/, 'output inspector should not expose overwrite edit');
  assert.doesNotMatch(settingsSource, /Replace selected/, 'output inspector should not expose replace selected edit');
  assert.match(assetLibraryBrowserSource, /export function WorkspaceAssetLibraryBrowser/, 'studio should wrap the app library structure in a route-local browser component');
  assert.match(assetLibraryBrowserSource, /searchQuery/, 'studio library browser should keep the app library search interaction');
  assert.match(assetLibraryBrowserSource, /filteredAssets/, 'studio library browser should filter visible assets from the search query');
  assert.match(assetLibraryBrowserSource, /role="tablist"/, 'studio library browser should expose source filters as tabs like the app library');
  assert.match(assetLibraryBrowserSource, /aria-selected/, 'studio library browser source tabs should expose selected state');
  assert.match(assetLibraryBrowserSource, /countLabel/, 'studio library browser should expose an asset count label');
  assert.match(assetLibraryBrowserSource, /isLoading/, 'studio library browser should render the app library loading state');
  assert.match(assetLibraryBrowserSource, /error/, 'studio library browser should render the app library error state');
  assert.match(assetLibraryBrowserSource, /emptySearchLabel/, 'studio library browser should render empty states for searches and sources');
  assert.match(assetLibraryBrowserSource, /headerActions\?: ReactNode/, 'studio library browser should accept route-local header actions like upload');
  assert.match(canvasFloatingToolbarSource, /toolbarBlocks\(copy\.nodes\)/, 'canvas toolbar should derive workflow block templates from localized node copy');
  assert.match(canvasFloatingToolbarSource, /image:\s*\[/, 'canvas toolbar should expose image workflow block templates');
  assert.match(canvasFloatingToolbarSource, /video:\s*\[/, 'canvas toolbar should expose video workflow block templates');
  assert.match(canvasFloatingToolbarSource, /audio:\s*\[/, 'canvas toolbar should expose audio workflow block templates');
  assert.match(canvasFloatingToolbarSource, /text:\s*\[/, 'canvas toolbar should expose text workflow block templates');
  assert.match(canvasFloatingToolbarSource, /data-canvas-toolbar-block-kind/, 'canvas toolbar block templates should expose a stable drag test target');
  assert.match(canvasFloatingToolbarSource, /data-canvas-toolbar-block-id/, 'canvas toolbar block templates should expose stable workflow action ids');
  assert.doesNotMatch(canvasFloatingToolbarSource, /draggable/, 'canvas toolbar block templates should not use native HTML drag because it can leave the custom ghost stuck');
  assert.doesNotMatch(canvasFloatingToolbarSource, /dataTransfer\.setData\('application\/x-maxvideoai-node-kind'/, 'canvas toolbar block templates should avoid native drag payloads');
  assert.match(canvasFloatingToolbarSource, /PALETTE_DRAG_START_EVENT/, 'canvas toolbar should start pointer-based template drags for robust canvas drops');
  assert.match(canvasFloatingToolbarSource, /PALETTE_PLACEMENT_ARM_EVENT/, 'canvas toolbar should arm click-to-place template placement for block choices');
  assert.match(canvasFloatingToolbarSource, /handleBlockClick/, 'canvas toolbar block templates should support click-to-place placement');
  assert.match(canvasFloatingToolbarSource, /onClick=\{\(event\) => onBlockClick\(event, block\.kind, block\.presetId\)\}/, 'canvas toolbar block template clicks should close the menu and arm a ghost placement');
  assert.match(canvasFloatingToolbarSource, /event\.preventDefault\(\)/, 'canvas toolbar pointer drags should prevent native text selection');
  assert.match(canvasFloatingToolbarSource, /selectstart/, 'canvas toolbar should block selectstart while a block template drag is armed');
  assert.match(canvasFloatingToolbarSource, /window\.getSelection\(\)\?\.removeAllRanges/, 'canvas toolbar should clear accidental selection after palette drags');
  assert.doesNotMatch(canvasFloatingToolbarSource, /onAddNode/, 'canvas toolbar block template clicks should arm placement rather than adding at a hidden default position');
  assert.doesNotMatch(canvasFloatingToolbarSource, /WorkspaceAssetLibraryBrowser/, 'canvas toolbar should not render the user media asset browser directly');
  assert.doesNotMatch(canvasFloatingToolbarSource, /libraryAssets\.map/, 'canvas toolbar should not keep a second ad-hoc asset list');
  assert.match(assetLibraryModalSource, /WorkspaceAssetLibraryBrowser/, 'asset picker modal should reuse the same studio browser structure as the sidebar');
  assert.match(assetLibraryModalSource, /authFetch/, 'asset picker modal should upload through the existing session-aware app fetcher');
  assert.match(assetLibraryModalSource, /prepareImageFileForUpload/, 'asset picker modal should reuse app image upload preparation');
  assert.match(assetLibraryModalSource, /workspaceUploadEndpointForNodeKind/, 'asset picker modal should choose the app upload endpoint from the selected media node kind');
  assert.match(assetLibraryModalSource, /workspaceUploadAcceptForNodeKind/, 'asset picker modal should limit accepted files to the selected media node kind');
  assert.match(assetLibraryModalSource, /workspaceLibraryAssetFromUploadedAsset/, 'asset picker modal should normalize uploaded assets before filling the node');
  assert.match(assetLibraryModalSource, /FormData/, 'asset picker modal should send uploads as form data');
  assert.match(assetLibraryModalSource, /formData\.append\('file'/, 'asset picker modal should append the selected file to the upload payload');
  assert.match(assetLibraryModalSource, /type="file"/, 'asset picker modal should include a hidden file input');
  assert.match(assetLibraryModalSource, /headerActions=/, 'asset picker modal should place the upload action in the library header');
  assert.match(assetLibraryModalSource, /onSourceChange\('upload'\)/, 'asset picker modal should switch to the Uploaded library source after upload');
  assert.doesNotMatch(assetLibraryModalSource, /assets\.map/, 'asset picker modal should not keep a second ad-hoc asset grid');
  assert.match(assetLibraryBrowserSource, /_styles\/asset-library\.module\.css/, 'studio library browser should import focused asset library CSS');
  assert.match(assetLibraryModalSource, /_styles\/asset-library\.module\.css/, 'asset picker modal should import focused asset library CSS');
  assert.match(projectMediaLibraryModalSource, /_styles\/asset-library\.module\.css/, 'project media modal should import focused asset library CSS');
  assert.match(assetLibraryStyleSource, /\.assetBrowser/, 'studio library browser should be styled with focused asset library CSS');
  assert.match(assetLibraryStyleSource, /\.assetLibraryUploadButton/, 'asset library upload button should be styled in focused asset library CSS');
  assert.match(assetLibraryStyleSource, /\.assetLibraryUploadInput/, 'asset library hidden file input should be styled in focused asset library CSS');
  assert.match(assetLibraryStyleSource, /\.assetBrowserSourceButton/, 'studio library source tabs should be styled with focused asset library CSS');
  assert.match(assetLibraryStyleSource, /\.assetBrowserCard/, 'studio library asset cards should be styled with focused asset library CSS');
  assert.doesNotMatch(styleSource, /\.assetBrowserCard/, 'main editor CSS should no longer own asset browser card styles after modularization');
  assert.match(canvasToolbarStyleSource, /\.blockOptionList/, 'canvas toolbar block template list should be styled with focused toolbar CSS');
  assert.match(canvasToolbarStyleSource, /\.canvasToolbar[\s\S]*user-select:\s*none/, 'canvas toolbar labels should not be selectable during block drags');
  assert.match(canvasToolbarStyleSource, /\.blockOption/, 'canvas toolbar block template cards should be styled with focused toolbar CSS');
  assert.match(canvasFloatingToolbarSource, /onKeyDown=\{handleMenuKeyDown\}/, 'canvas toolbar menus should close with keyboard handling');
  assert.match(canvasFloatingToolbarSource, /data-canvas-toolbar-menu-id/, 'canvas toolbar menu buttons should expose stable menu ids');
  assert.match(canvasFloatingToolbarSource, /block\.meta/, 'canvas toolbar block cards should expose compact metadata chips');
  assert.match(canvasFloatingToolbarSource, /copy\.toolbar\.saveCanvas/, 'canvas toolbar should expose saving as a direct canvas action');
  assert.doesNotMatch(canvasFloatingToolbarSource, /copy\.toolbar\.canvasTemplates/, 'canvas toolbar should not expose starter templates as an active creation tool');
  assert.doesNotMatch(canvasFloatingToolbarSource, /onApplyUserTemplate/, 'canvas toolbar should not own saved canvas navigation');
  assert.match(canvasNavigatorPanelSource, /copy\.templates\.canvasPanel/, 'canvas navigator should own canvas navigation copy');
  assert.match(canvasNavigatorPanelSource, /onKeyDown=\{handlePanelKeyDown\}/, 'canvas navigator should support keyboard dismissal');
  assert.match(canvasNavigatorPanelSource, /template\.flow/, 'canvas navigator should show template workflow context while preserving thumbnails');
  assert.match(canvasNavigatorPanelSource, /onCreateCanvasFromTemplate/, 'canvas navigator should create project canvases from starter templates');
  assert.match(canvasNavigatorPanelSource, /replaceCurrentCanvasConfirm/, 'canvas navigator should confirm replacing the current canvas graph');
  assert.match(canvasNavigatorPanelSource, /onAddTemplate/, 'canvas navigator should let users add a starter template to the existing canvas');
  assert.match(canvasNavigatorPanelSource, /copy\.templates\.newCanvas/, 'canvas navigator starter cards should expose a compact New action');
  assert.match(canvasNavigatorPanelSource, /copy\.templates\.replaceCanvas/, 'canvas navigator starter cards should expose a compact Replace action');
  assert.match(canvasNavigatorPanelSource, /copy\.templates\.addTemplate/, 'canvas navigator starter cards should expose a compact Add action');
  assert.match(canvasNavigatorPanelSource, /onApplyUserTemplate/, 'canvas navigator should let users switch saved project canvases');
  assert.match(canvasNavigatorPanelSource, /onDuplicateUserTemplate/, 'canvas navigator should let users duplicate saved project canvases');
  assert.match(canvasNavigatorPanelSource, /onDeleteUserTemplate/, 'canvas navigator should let users delete saved project canvases');
  assert.match(workspaceEditorLayoutSource, /onSaveActiveCanvas:\s*canvas\.handleSaveActiveCanvasTemplate/, 'workspace should wire saving the current project canvas through the toolbar');
  assert.match(workspaceEditorLayoutSource, /onCreateCanvasFromTemplate:\s*canvas\.handleCreateCanvasFromTemplate/, 'workspace should wire template clicks to create a new project canvas');
  assert.match(workspaceEditorLayoutSource, /onAddTemplate:\s*canvas\.handleAddCanvasTemplate/, 'workspace should wire additive starter templates through canvas actions');
  assert.match(workspaceEditorLayoutSource, /onApplyUserTemplate:\s*canvas\.handleApplyUserCanvasTemplate/, 'workspace should wire saved canvas switching without touching timeline state');
  assert.match(canvasTemplateActionsHookSource, /handleSaveCanvasTemplate/, 'canvas template action hook should own saving the current graph as a project canvas');
  assert.match(canvasTemplateActionsHookSource, /handleAddCanvasTemplate/, 'canvas template action hook should own additive starter-template insertion');
  assert.match(canvasTemplateActionsHookSource, /remapStarterTemplateGraph/, 'additive templates should remap node and edge ids before insertion');
  assert.match(canvasTemplateActionsHookSource, /offsetTemplateNodes/, 'additive templates should offset inserted nodes away from the existing graph');
  assert.match(canvasTemplateActionsHookSource, /handleCreateCanvasFromTemplate/, 'canvas template action hook should own creating a new canvas from a starter template');
  assert.match(canvasTemplateActionsHookSource, /handleApplyUserCanvasTemplate/, 'canvas template action hook should own applying project canvases without touching timeline state');
  assert.match(canvasToolbarStyleSource, /\.toolbarPopover[\s\S]*overflow:\s*auto/, 'canvas toolbar menus should scroll inside the floating toolbar when vertical space is tight');
  assert.match(canvasNavigatorStyleSource, /\.navigatorPanel[\s\S]*overflow:\s*auto/, 'canvas navigator should scroll saved canvases and starter templates without showing a sidebar');
  assert.match(canvasNavigatorStyleSource, /\.templatePreview/, 'canvas navigator templates should keep a visible preview area');
  assert.match(canvasNavigatorStyleSource, /\.templateActions[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/, 'canvas navigator template actions should fit New, Replace, and Add on one row');
  assert.doesNotMatch(styleSource, /\.viewerFocus \.blockOptionList/, 'Viewer mode should not compact canvas block templates because they are not mounted there');
  assert.doesNotMatch(styleSource, /\.viewerFocus \.templateButton/, 'Viewer mode should not compact canvas templates because they are not mounted there');
  assert.doesNotMatch(styleSource, /\.blockTemplateCard/, 'main editor CSS should no longer own canvas block template cards after modularization');
  assert.match(canvasFloatingToolbarSource, /_styles\/canvas-toolbar\.module\.css/, 'canvas toolbar should import the focused canvas toolbar CSS module');
  assert.match(timelineProjectSidebarSource, /copy\.title/, 'viewer sidebar should lead with project media through localized copy');
  assert.match(timelineProjectSidebarSource, /copy\.importMedia/, 'viewer sidebar should expose a media import entry point through localized copy');
  assert.match(timelineProjectSidebarSource, /projectAssets/, 'viewer sidebar should render persisted project media assets, not canvas nodes');
  assert.match(projectMediaControllerSource, /onInsertProjectAsset/, 'viewer sidebar should insert imported project media at the playhead through its controller');
  assert.match(timelineProjectSidebarSource, /data-project-media-asset-id/, 'viewer sidebar should expose imported media as timeline-draggable project assets');
  assert.match(projectMediaDragSource, /assetId/, 'viewer sidebar timeline drag payload should identify the imported project asset');
  assert.match(projectMediaDragSource, /TIMELINE_NODE_DRAG_TYPE/, 'project media drag helper should own timeline drag payload creation');
  assert.match(projectMediaDragSource, /PROJECT_MEDIA_ITEM_DRAG_TYPE/, 'project media drag helper should also identify media cards for folder drops');
  assert.match(projectMediaDragSource, /setDragImage/, 'project media drag helper should set a visible drag image for timeline drops');
  assert.match(projectMediaControllerSource, /applyProjectMediaTimelineDragPayload/, 'project media controller should apply the shared timeline drag payload helper');
  assert.match(timelineProjectSidebarSource, /projectMediaGrid/, 'viewer sidebar should present sequences, imports, and generated clips in one media grid');
  assert.match(mediaStyleSource, /\.timelineProjectSidebar/, 'project media CSS module should own the viewer media sidebar shell styles');
  assert.match(mediaStyleSource, /\.projectMediaGrid/, 'project media CSS module should own the media grid styles');
  assert.match(mediaStyleSource, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/, 'project media should use a compact three-column grid');
  assert.match(mediaStyleSource, /\.projectMediaGrid[\s\S]*grid-auto-rows:\s*max-content/, 'project media cards should keep their intrinsic thumbnail size instead of shrinking rows');
  assert.match(mediaStyleSource, /\.projectMediaGrid[\s\S]*scrollbar-width:\s*none/, 'project media grid should stay scrollable without showing a scrollbar');
  assert.match(mediaStyleSource, /\.projectMediaGrid::-webkit-scrollbar[\s\S]*display:\s*none/, 'project media grid should hide WebKit scrollbars while preserving scroll');
  assert.match(mediaStyleSource, /\.projectMediaTile/, 'project media CSS module should own media card styles');
  assert.doesNotMatch(timelineProjectSidebarSource, /ProjectMediaBadge/, 'project media thumbnails should not duplicate media-type badges over artwork');
  assert.doesNotMatch(mediaStyleSource, /\.projectMediaBadge/, 'project media CSS should not keep removed thumbnail badge styling');
  assert.doesNotMatch(styleSource, /\.projectMediaGrid/, 'main editor CSS should no longer own project media grid styles after modularization');
  assert.ok(lineCount(mediaStyleSource) <= 1200, 'project media CSS module should stay under the focused module size threshold');
  assert.match(timelineProjectSidebarSource, /data-project-media-generated-id/, 'viewer sidebar should expose generated clips as timeline-draggable media cards');
  assert.match(projectMediaDragSource, /nodeId/, 'viewer sidebar timeline drag payload should identify generated output nodes');
  assert.match(timelineProjectSidebarSource, /copy\.newFolder/, 'viewer sidebar should expose project media folder creation in the footer through localized copy');
  assert.match(timelineProjectSidebarSource, /copy\.newFolderDefaultName/, 'viewer sidebar should localize default project media folder names');
  assert.match(typesSource, /WorkspaceProjectMediaFolder/, 'project media folders should have a first-class workspace type');
  assert.match(workspaceStateSource, /projectMediaFolders\?: WorkspaceProjectMediaFolder\[\]/, 'persisted workspace state should remember project media folders');
  assert.match(projectMediaActionsHookSource, /handleCreateProjectMediaFolder/, 'project media actions should own folder creation');
  assert.match(projectMediaActionsHookSource, /handleDeleteProjectMediaFolder/, 'project media actions should own folder deletion');
  assert.match(projectMediaActionsHookSource, /handleRenameProjectMediaFolder/, 'project media actions should own folder renaming');
  assert.match(projectMediaActionsHookSource, /handleMoveProjectAssetToFolder/, 'project media actions should own moving imported assets into folders');
  assert.match(projectMediaActionsHookSource, /handleMoveGeneratedClipToFolder/, 'project media actions should own moving generated clips into folders');
  assert.match(projectMediaActionsHookSource, /pendingImportFolderIdRef/, 'project media imports should remember the currently opened folder');
  assert.doesNotMatch(projectMediaActionsHookSource, /Backend folder persistence will be wired/, 'project media folder creation should no longer be a placeholder notice');
  assert.doesNotMatch(projectMediaActionsHookSource, /window\.prompt/, 'project media folder actions should receive explicit UI inputs instead of opening browser prompts');
  assert.match(projectMediaControllerSource, /visibleFolders/, 'project media controller should expose folders as visible media cards');
  assert.match(projectMediaControllerSource, /activeFolder/, 'project media controller should own the currently opened project media folder');
  assert.match(projectMediaControllerSource, /onImportMedia\(activeFolderId\)/, 'project media controller should import new media into the active folder');
  assert.match(projectMediaControllerSource, /generatedNodeFolderId/, 'project media controller should keep generated clip folder filtering deterministic');
  assert.match(timelineProjectSidebarSource, /data-project-media-folder-id/, 'viewer sidebar should render project media folders as selectable cards');
  assert.match(timelineProjectSidebarSource, /data-project-media-folder-drop-target/, 'viewer sidebar should render media folders as visible drag targets');
  assert.match(projectMediaControllerSource, /handleFolderDrop/, 'project media controller should own dropping imported and generated media into folders');
  assert.match(timelineProjectSidebarSource, /copy\.backToProjectMedia/, 'viewer sidebar should show an explicit back action when a project media folder is open through localized copy');
  assert.match(timelineProjectSidebarSource, /projectMediaBackButton/, 'viewer sidebar should style the active folder back action separately from ordinary breadcrumbs');
  assert.match(mediaStyleSource, /\.projectMediaFolderGlyph/, 'project media folder cards should render a clear folder icon in the artwork area');
  assert.match(timelineProjectSidebarSource, /copy\.moveToFolder/, 'project media context menu should move media cards into folders through localized copy');
  assert.match(timelineProjectSidebarSource, /copy\.renameFolder/, 'project media context menu should rename folders through localized copy');
  assert.match(timelineProjectSidebarSource, /ProjectMediaFolderDialog/, 'project media folder create, rename, and move actions should use an in-app dialog');
  assert.match(mediaStyleSource, /\.projectMediaDialog/, 'project media folder dialogs should be styled in the focused project media CSS module');
  assert.match(timelineProjectSidebarSource, /copy\.newSequence/, 'viewer sidebar should expose sequence creation in the footer through localized copy');
  assert.match(timelineProjectSidebarSource, /copy\.insertAtPlayhead/, 'viewer sidebar should keep insertion available through the media context menu through localized copy');
  assert.match(projectMediaControllerSource, /onDeleteProjectAsset/, 'viewer sidebar should let project media assets be deleted from the bin through its controller');
  assert.match(projectMediaControllerSource, /onDeleteGeneratedClip/, 'viewer sidebar should let generated clips be removed from project media through its controller');
  assert.match(workspaceStateSource, /projectAssets\?: WorkspaceAssetRecord\[\]/, 'persisted workspace state should remember imported project media assets');
  assert.doesNotMatch(workspaceSource, /WorkspaceProjectMediaLibraryModal/, 'orchestrator should not render the project media import modal inline');
  assert.match(runtimeModalsSource, /WorkspaceProjectMediaLibraryModal/, 'runtime modals should open a project media import modal in Viewer mode');
  assert.match(runtimeModalsSource, /WorkspaceExportDialog/, 'runtime modals should render the export dialog');
  assert.doesNotMatch(workspaceEditorTopbarSource, /onOpenExportDialog|exportButton|studioCopy\.topbar\.export/, 'workspace topbar should not own timeline export actions');
  assert.match(workspaceEditorTopbarSource, /<div className=\{styles\.topbarRight\}>[\s\S]*onClick=\{onToggleMockMode\}[\s\S]*<StudioHeaderSession/, 'workspace mock toggle should render to the left of the wallet/session cluster');
  assert.doesNotMatch(workspaceEditorLayoutSource, /<WorkspaceEditorTopbar(?:(?!\/>)[\s\S])*onOpenExportDialog=/, 'workspace layout should not wire export into the topbar');
  assert.match(workspaceEditorLayoutSource, /<WorkspaceTimeline[\s\S]*onOpenExportDialog=\{shell\.handleOpenExportDialog\}/, 'workspace layout should wire export into the timeline toolbar');
  assert.match(timelineSource, /onOpenExportDialog/, 'timeline should receive the export action from the workspace shell controller');
  assert.match(timelineToolbarSource, /onOpenExportDialog/, 'timeline toolbar should expose the export action beside timeline tools');
  assert.match(timelineToolbarSource, /copy\.exportAria/, 'timeline toolbar export button should keep the existing localized export aria label');
  assert.match(timelineControlStyleSource, /\.timelineExportButton/, 'timeline control CSS module should own timeline export button styling');
  assert.match(canvasControllerHookSource, /useWorkspaceEditorAssetLibrary\(isProjectMediaPickerOpen \? null : undefined, studioAssetLibraryCopy\)/, 'project media import should load the signed-in library only while its modal is open and pass localized library copy');
  assert.match(projectMediaLibraryModalSource, /PROJECT_MEDIA_UPLOAD_ACCEPT/, 'project media library modal should accept direct image, video, and audio uploads');
  assert.match(projectMediaLibraryModalSource, /uploadWorkspaceProjectMediaFile/, 'project media library modal should delegate local file uploads to a shared helper');
  assert.match(projectMediaUploadSource, /WORKSPACE_PROJECT_MEDIA_UPLOAD_ENDPOINTS/, 'project media uploads should reuse the app media upload endpoints');
  assert.match(projectMediaUploadSource, /workspaceLibraryAssetFromUploadedAsset/, 'project media uploads should normalize into reusable library assets');
  assert.match(workspaceSource, /useWorkspaceProjectMediaMetadataHydration/, 'workspace should hydrate missing project media dimensions from browser metadata');
  assert.match(projectMediaMetadataHydrationHookSource, /video\.videoWidth/, 'project media metadata hydration should read native video dimensions');
  assert.match(projectMediaMetadataHydrationHookSource, /applyWorkspaceProjectAssetMetadataToTimelineItems/, 'project media metadata hydration should repair timeline clips inserted before dimensions were known');
  assert.match(projectMediaMetadataSource, /workspaceAssetNeedsMeasuredDimensions/, 'project media metadata helper should identify videos missing dimensions');
  assert.match(projectMediaActionsHookSource, /handleImportLocalProjectMediaFiles/, 'project media actions should own importing compatible local files dropped from the desktop');
  assert.match(projectMediaControllerSource, /onImportLocalMediaFiles/, 'project media controller should route local file drops to project media actions');
  assert.match(timelineProjectSidebarSource, /onDrop=\{projectMedia\.handleProjectMediaDrop\}/, 'viewer sidebar grid should accept compatible local file drops from the desktop');
  assert.match(workspaceEditorLayoutSource, /onInsertProjectAsset=\{projectMedia\.handleInsertProjectAssetToTimeline\}/, 'editor layout should insert imported project media into the timeline');
  assert.match(workspaceEditorLayoutSource, /onProjectAssetDropToTimeline=\{projectMedia\.handleDropProjectAssetToTimeline\}/, 'editor layout should insert dragged project media on the target timeline track');
  assert.doesNotMatch(workspaceSource, /resolveProjectAssetTimelineInsert/, 'orchestrator should not own project media timeline insert resolution');
  assert.match(projectMediaActionsHookSource, /resolveProjectAssetTimelineInsert/, 'project media action hook should delegate project media timeline insert resolution to a pure helper');
  assert.match(projectMediaTimelineSource, /retargetWorkspaceTimelineItemsForTrack\(draftItems, params\.targetTrack\)/, 'project media drops should honor the compatible target timeline track');
  assert.match(projectMediaTimelineSource, /insertWorkspaceTimelineItems/, 'project media timeline insertion should reuse the shared insert resolver');
  assert.match(timelineDropsSource, /workspaceTimelineItemsCompatibleWithTrack/, 'timeline drop compatibility should live in a shared pure helper');
  assert.match(timelineDropsSource, /projectAssetTimelineNodeId/, 'project media timeline node ids should live outside the orchestrator');
  assert.doesNotMatch(workspaceSource, /function projectAssetTimelineNodeId/, 'orchestrator should not own project media timeline node id creation');
  assert.match(timelineSource, /onProjectAssetDropToTimeline/, 'timeline should route project media drops separately from canvas node drops');
  assert.match(typesSource, /onOpenAssetLibrary\?:/, 'node data should carry a media library open handler');
  assert.match(shellStyleSource, /\.editorShell/, 'shell CSS module should own workspace shell layout');
  assert.match(shellStyleSource, /\.modeSwitch/, 'shell CSS module should own Canvas/Viewer switch styling');
  assert.doesNotMatch(shellStyleSource, /\.exportButton/, 'shell CSS module should not keep unused topbar export button styling');
  assert.match(shellStyleSource, /\.iconButton/, 'shell CSS module should own compact header icon buttons');
  assert.doesNotMatch(styleSource, /\.brandLogo/, 'main editor CSS should no longer own brand logo styles after shell extraction');
  assert.ok(lineCount(shellStyleSource) <= 1200, 'editor shell CSS module should stay under the focused module size threshold');
  assert.ok(lineCount(studioSessionStyleSource) <= 320, 'Studio session CSS module should stay under the focused module size threshold');
  assert.match(studioSessionStyleSource, /\.studioSessionCluster/, 'Studio session CSS module should own session header layout');
  assert.match(studioSessionStyleSource, /\.studioWalletPrompt/, 'Studio session CSS module should own wallet top-up prompt styles');
  assert.doesNotMatch(canvasStyleSource, /\.blockOptionList/, 'canvas surface CSS should no longer own canvas toolbar list styles');
  assert.doesNotMatch(canvasStyleSource, /\.templateButton/, 'canvas surface CSS should no longer own canvas template card styles');
  assert.ok(lineCount(canvasStyleSource) <= 300, 'canvas CSS module should stay under the focused surface threshold');
  assert.ok(lineCount(canvasToolbarStyleSource) <= 520, 'canvas toolbar CSS module should stay under the focused toolbar threshold');
  assert.ok(lineCount(canvasNodeStyleSource) <= 520, 'canvas node CSS module should stay under the focused node styling threshold');
  assert.ok(lineCount(canvasMapStyleSource) <= 300, 'canvas map CSS module should stay small and focused');
  assert.match(canvasStyleSource, /\.canvasShell/, 'canvas surface should be styled in focused canvas CSS');
  assert.match(canvasMapStyleSource, /\.canvasNavigator/, 'canvas map CSS should own canvas navigation shell styles');
  assert.match(canvasMapStyleSource, /\.canvasMiniMapViewport/, 'canvas map CSS should own the draggable viewport styles');
  assert.doesNotMatch(canvasStyleSource, /\.canvasNavigator/, 'canvas CSS should no longer own canvas map shell styles');
  assert.doesNotMatch(canvasStyleSource, /\.canvasMiniMap/, 'canvas CSS should no longer own canvas map miniature styles');
  assert.match(canvasNodeStyleSource, /\.graphNode/, 'workspace nodes should be styled in focused canvas node CSS');
  assert.match(canvasNodeStyleSource, /\.mediaPickerEmpty/, 'empty media picker state should be styled in focused canvas node CSS');
  assert.match(canvasNodeStyleSource, /\.processingPreview/, 'processing output placeholders should be styled in focused canvas node CSS');
  assert.match(canvasNodeStyleSource, /\.previewVideo/, 'playable video previews should be styled in focused canvas node CSS');
  assert.doesNotMatch(canvasStyleSource, /\.graphNode/, 'canvas surface CSS should no longer own workspace node card styles');
  assert.doesNotMatch(canvasStyleSource, /\.shotInputDock/, 'canvas surface CSS should no longer own generate block connector styles');
  assert.doesNotMatch(canvasStyleSource, /\.mediaPickerEmpty/, 'canvas surface CSS should no longer own media picker node styles');
  assert.match(exportDialogSource, /_styles\/export\.module\.css/, 'export dialog should import focused export CSS');
  assert.match(exportStyleSource, /\.exportOverlay/, 'export dialog overlay should be styled in focused export CSS');
  assert.match(exportStyleSource, /\.exportDialogBody/, 'export dialog body should be styled in focused export CSS');
  assert.match(assetLibraryStyleSource, /\.assetBrowser/, 'asset picker browser should be styled in focused asset library CSS');
  assert.match(assetLibraryStyleSource, /\.assetLibraryUploadButton/, 'asset library upload button should be styled in focused asset library CSS');
  assert.doesNotMatch(styleSource, /\.canvasShell/, 'main editor CSS should no longer own canvas surface styles after canvas extraction');
  assert.doesNotMatch(styleSource, /\.graphNode/, 'main editor CSS should no longer own workspace node styles after canvas extraction');
  assert.doesNotMatch(styleSource, /\.shotInputDock/, 'main editor CSS should no longer own generate block connector styles after canvas extraction');
  assert.doesNotMatch(styleSource, /\.mediaPickerEmpty/, 'main editor CSS should no longer own media picker node styles after canvas extraction');
  assert.doesNotMatch(styleSource, /\.exportDialogBody/, 'main editor CSS should no longer own export dialog styles after export extraction');
  assert.doesNotMatch(styleSource, /\.assetBrowser/, 'main editor CSS should no longer own asset browser styles after asset library extraction');
  assert.match(viewerStyleSource, /\.videoViewerShell/, 'central montage viewer should be styled in focused viewer CSS');
  assert.match(viewerStyleSource, /\.programMonitor/, 'central viewer should style a program monitor shell');
  assert.match(viewerStyleSource, /\.programZoomControl/, 'program monitor should style zoom as a display control');
  assert.match(viewerStyleSource, /\.programFrameViewport[\s\S]*container-type:\s*size/, 'program monitor viewport should provide size containment for aspect-ratio fitting');
  assert.match(viewerStyleSource, /\.programFrameViewport[\s\S]*overflow:\s*auto/, 'program monitor viewport should allow inspection of 100% sequence pixels without resizing the app shell');
  assert.match(viewerStyleSource, /\.programFrame/, 'central viewer should style a project-ratio program frame');
  assert.match(viewerStyleSource, /\.viewerVideoLayer/, 'program monitor should stack stable video layers for smoother sequence playback');
  assert.match(viewerStyleSource, /\.viewerVideoLayer[\s\S]*transform-origin:\s*center/, 'program monitor layers should transform around the project frame center');
  assert.match(viewerStyleSource, /\.viewerVideoLayerVisible/, 'program monitor should expose the active video layer without recreating the video source');
  assert.match(viewerStyleSource, /\.programFrameFit/, 'program monitor should fit the full sequence frame by default');
  assert.match(viewerStyleSource, /\.programFrameScaled/, 'program monitor should support pixel-based sequence zoom levels');
  assert.match(viewerStyleSource, /--workspace-project-aspect-ratio/, 'program frame should use a project aspect-ratio CSS variable');
  assert.match(viewerStyleSource, /--workspace-project-aspect-width/, 'program frame should use numeric aspect width for contained fitting');
  assert.match(viewerStyleSource, /--workspace-project-aspect-height/, 'program frame should use numeric aspect height for contained fitting');
  assert.match(viewerStyleSource, /--workspace-project-preview-width/, 'program frame should use project pixel width for non-Fit monitor zoom');
  assert.match(viewerStyleSource, /--workspace-project-preview-height/, 'program frame should use project pixel height for non-Fit monitor zoom');
  assert.match(viewerStyleSource, /--workspace-program-zoom-scale/, 'program frame should use monitor zoom scale separately from project resolution');
  assert.doesNotMatch(styleSource, /\.videoViewerShell/, 'main editor CSS should no longer own viewer shell styles after modularization');
  assert.doesNotMatch(styleSource, /\.programMonitor/, 'main editor CSS should no longer own program monitor styles after modularization');
  assert.ok(lineCount(viewerStyleSource) <= 1200, 'program viewer CSS module should stay under the focused module size threshold');
  assert.doesNotMatch(styleSource, /\.viewerSettingsSlot/, 'viewer should not reserve a footer slot for project settings');
  assert.doesNotMatch(styleSource, /\.sequenceSettingsButton/, 'viewer should not style a footer project settings button');
  assert.match(exportStyleSource, /\.exportOverlay/, 'export dialog overlay should be styled in focused export CSS');
  assert.match(exportStyleSource, /\.exportDialogShell/, 'export dialog shell should be styled in focused export CSS');
  assert.match(exportStyleSource, /\.exportServerCard/, 'server render card should be styled in focused export CSS');
  assert.ok(lineCount(exportStyleSource) <= 450, 'export CSS module should stay small and focused');
  assert.doesNotMatch(styleSource, /\.sequenceSettingsOverlay/, 'main editor CSS should no longer own removed project settings dialog styles');
  assert.doesNotMatch(styleSource, /\.exportServerCard/, 'main editor CSS should no longer own export server render styles');
  assert.doesNotMatch(styleSource, /\.viewerSequenceControls/, 'viewer should not style always-visible sequence settings controls');
  assert.match(timelineClipStyleSource, /\.timelineClipSelected/, 'selected timeline clips should be visually distinct');
  assert.match(cssBlock(timelineStyleSource, '.timelinePanel'), /min-width:\s*0/, 'timeline panel should shrink inside the app shell instead of widening the page when zoomed');
  assert.match(cssBlock(timelineStyleSource, '.timelinePanel'), /overflow:\s*hidden/, 'timeline panel should keep horizontal zoom overflow inside timeline scrollers');
  assert.match(timelineStyleSource, /\.timelineViewport/, 'timeline should use one shared scroll viewport for ruler and all tracks');
  assert.match(cssBlock(timelineStyleSource, '.timelineViewport'), /overflow:\s*auto/, 'timeline zoom should create one shared scrollbar instead of per-track scrollbars');
  assert.match(cssBlock(timelineStyleSource, '.trackLane'), /overflow:\s*visible/, 'individual timeline lanes should not render native horizontal scrollbars');
  assert.match(cssBlock(timelineStyleSource, '.trackLabel'), /position:\s*sticky/, 'timeline track labels should stay pinned while the shared viewport scrolls horizontally');
  assert.match(timelineControlStyleSource, /\.timelineToolButton/, 'timeline editing tools should be styled in focused timeline control CSS');
  assert.match(timelineControlStyleSource, /\.timelineToolGroup/, 'timeline editing tool group should be styled in focused timeline control CSS');
  assert.doesNotMatch(styleSource, /\.timelineModeControl/, 'timeline trim tools should not keep segmented mode control styling');
  assert.match(styleSource, /\.timelineInsertActions/, 'output inspector insert actions should be styled in isolated editor CSS');
  assert.match(timelineControlStyleSource, /\.timelineZoomControl/, 'timeline zoom control should be styled in focused timeline control CSS');
  assert.match(timelineClipStyleSource, /\.timelineWaveform/, 'timeline audio waveforms should be styled in focused timeline clip CSS');
  assert.match(timelineContextMenusSource, /timeline-context-menu\.module\.css/, 'timeline context menu component should import its focused CSS module');
  assert.match(timelineContextMenuStyleSource, /\.timelineContextMenu/, 'timeline context menu styles should live in the focused context menu CSS module');
  assert.doesNotMatch(styleSource, /\.timelineClipSelected/, 'main editor CSS should no longer own timeline clip selection styles after modularization');
  assert.doesNotMatch(timelineStyleSource, /\.timelineClipSelected/, 'timeline shell CSS should no longer own selected timeline clip styles after clip extraction');
  assert.doesNotMatch(timelineStyleSource, /\.timelineToolGroup/, 'timeline shell CSS should no longer own toolbar group styles after control extraction');
  assert.doesNotMatch(timelineStyleSource, /\.timelineZoomControl/, 'timeline shell CSS should no longer own zoom control styles after control extraction');
  assert.doesNotMatch(timelineStyleSource, /\.timelineContextMenu/, 'timeline shell CSS should no longer own context menu styles after context menu extraction');
  assert.ok(lineCount(timelineStyleSource) <= 580, 'timeline CSS module should stay under the focused shell/ruler/track threshold');
  assert.ok(lineCount(timelineControlStyleSource) <= 220, 'timeline control CSS module should stay under the focused toolbar threshold');
  assert.ok(lineCount(timelineClipStyleSource) <= 260, 'timeline clip CSS module should stay under the focused clip styling threshold');
  assert.ok(lineCount(timelineContextMenuStyleSource) <= 80, 'timeline context menu CSS module should stay under the focused menu styling threshold');
  assert.match(inspectorStyleSource, /\.timelineInspectorGroup/, 'timeline clip inspector groups should be styled in focused inspector CSS');
  assert.match(inspectorStyleSource, /\.timelineInspectorControlRow/, 'timeline clip inspector slider rows should be styled in focused inspector CSS');
  assert.match(inspectorStyleSource, /\.settingsRange/, 'timeline clip inspector ranges should be styled in focused inspector CSS');
  assert.match(inspectorStyleSource, /\.timelineInspectorCheckbox/, 'timeline clip inspector toggles should be styled in focused inspector CSS');
  assert.match(inspectorStyleSource, /\.timelineInspectorResetButton/, 'timeline clip inspector reset button should be styled in focused inspector CSS');
  assert.match(inspectorStyleSource, /\.infoGrid/, 'inspector CSS module should own timing and metadata grids');
  assert.doesNotMatch(styleSource, /\.timelineInspectorGroup/, 'main editor CSS should no longer own timeline inspector group styles after modularization');
  assert.doesNotMatch(styleSource, /\.infoGrid/, 'main editor CSS should no longer own inspector metadata grid styles after modularization');
  assert.ok(lineCount(inspectorStyleSource) <= 1200, 'inspector CSS module should stay under the focused module size threshold');
  assert.match(timelineStyleSource, /\.timelinePlayhead/, 'timeline playhead should be styled in focused timeline CSS');
  assert.match(timelineStyleSource, /\.timelinePlayhead::before/, 'timeline playhead should draw the visible line from an interactive handle');
  assert.match(timelineStyleSource, /\.timelinePlayhead[\s\S]*pointer-events:\s*auto/, 'timeline playhead should be directly draggable instead of decorative only');
  assert.match(timelineStyleSource, /\.timelineRulerPlayhead/, 'timeline should expose a dedicated ruler playhead handle');
  assert.match(timelineStyleSource, /--timeline-track-label-width:\s*150px/, 'timeline should define the track label width once for ruler and lane alignment');
  assert.match(timelineStyleSource, /--timeline-track-lane-padding-x:\s*10px/, 'timeline should define the lane padding once for ruler and lane alignment');
  assert.match(timelineStyleSource, /\.timelineRulerLane/, 'timeline ruler should align with track lane content after the sticky track label');
  assert.match(timelineStyleSource, /\.timelineTrack[\s\S]*grid-template-columns:\s*var\(--timeline-track-label-width\) minmax\(0,\s*1fr\)/, 'timeline track layout should share the same label width variable as the ruler');
  assert.match(timelineStyleSource, /\.timelineRulerInner span[\s\S]*font-variant-numeric:\s*tabular-nums/, 'timeline ruler timecodes should use tabular frame digits');
  assert.match(timelineStyleSource, /\.trackLaneContent[\s\S]*cursor:\s*ew-resize/, 'empty timeline lanes should communicate playhead scrubbing');
  assert.match(timelineStyleSource, /\.timelineSnapGuide/, 'timeline snap guide should be styled in focused timeline CSS');
  assert.match(timelineStyleSource, /\.timelineScrubber/, 'timeline scrubber should be styled in focused timeline CSS');
  assert.match(timelineClipStyleSource, /\.trimHandle/, 'timeline trim handles should be styled in focused timeline clip CSS');
  assert.match(assetLibraryStyleSource, /\.assetLibraryOverlay/, 'asset library modal overlay should be styled in focused asset library CSS');
  assert.match(assetLibraryStyleSource, /\.assetLibraryModal/, 'asset library modal shell should be styled in focused asset library CSS');
  assert.ok(lineCount(assetLibraryStyleSource) <= 420, 'asset library CSS module should stay small and focused');
  for (const nodeType of ["type: 'asset-image'", "type: 'asset-video'", "type: 'asset-audio'", "type: 'text-prompt'", "type: 'shot'", "type: 'output'"]) {
    assert.match(templateDevBlocksSource, new RegExp(nodeType), `Dev Blocks template should include ${nodeType}`);
  }

  for (const typeName of [
    'WorkspaceNodeKind',
    'WorkspaceEdgeKind',
    'WorkspaceShotSettings',
    'WorkspaceTimelineItem',
    'WorkspaceModelCapability',
  ]) {
    assert.match(typesSource, new RegExp(`export type ${typeName}`), `${typeName} should be exported`);
  }
});

test('MaxVideoAI editor canvas template registry exposes complete additive templates', () => {
  assert.equal(new Set(WORKSPACE_TEMPLATE_SUMMARIES.map((summary) => summary.id)).size, WORKSPACE_TEMPLATE_SUMMARIES.length, 'template summaries should use unique ids');

  for (const summary of WORKSPACE_TEMPLATE_SUMMARIES) {
    assert.ok(summary.description.trim().length > 0, `${summary.id} should describe the template outcome`);
    assert.ok(summary.thumbnailUrl?.trim(), `${summary.id} should provide an image thumbnail for template cards`);
    assert.ok(summary.flow?.trim(), `${summary.id} should expose the AI workflow path`);

    const template = createStarterWorkspaceTemplate(summary.id);
    assert.equal(template.id, summary.id, `${summary.id} builder should return the requested template id`);
    assert.equal(template.name, summary.name, `${summary.id} builder should keep the summary display name`);
    assert.ok(template.nodes.length > 0, `${summary.id} should create canvas nodes`);
    assert.ok(template.edges.length > 0, `${summary.id} should create canvas edges`);

    const nodeIds = new Set(template.nodes.map((node) => node.id));
    for (const edge of template.edges) {
      assert.ok(nodeIds.has(edge.source), `${summary.id} edge ${edge.id} should reference an existing source node`);
      assert.ok(nodeIds.has(edge.target), `${summary.id} edge ${edge.id} should reference an existing target node`);
    }
  }
});

test('MaxVideoAI editor timeline track helpers reject impossible video lanes', async () => {
  const {
    isWorkspaceTimelineAudioTrack,
    isWorkspaceTimelineVideoTrack,
    workspaceTimelineAudioTrackId,
    workspaceTimelineAudioTrackIndex,
    workspaceTimelineVideoTrackId,
    workspaceTimelineTrackLabel,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-tracks');

  assert.equal(isWorkspaceTimelineVideoTrack('video'), true, 'base video track should be treated as video');
  assert.equal(isWorkspaceTimelineVideoTrack('video-2'), true, 'added video tracks should be treated as video');
  assert.equal(
    isWorkspaceTimelineVideoTrack('video-0' as WorkspaceTimelineTrack),
    false,
    'timeline should reject impossible V0 tracks at runtime'
  );
  assert.equal(workspaceTimelineVideoTrackId(3), 'video-3', 'timeline should generate stable added video track ids');
  assert.equal(workspaceTimelineTrackLabel('video-2'), 'V2', 'timeline should label added video tracks as editing lanes');
  assert.equal(isWorkspaceTimelineAudioTrack('audio'), true, 'base audio track should be treated as audio');
  assert.equal(isWorkspaceTimelineAudioTrack('audio-3'), true, 'added audio tracks should be treated as audio');
  assert.equal(
    isWorkspaceTimelineAudioTrack('audio-0' as WorkspaceTimelineTrack),
    false,
    'timeline should reject impossible A0 tracks at runtime'
  );
  assert.equal(workspaceTimelineAudioTrackId(4), 'audio-4', 'timeline should generate stable added audio track ids');
  assert.equal(workspaceTimelineAudioTrackIndex('audio-3'), 3, 'timeline should parse added audio track indexes');
  assert.equal(workspaceTimelineTrackLabel('audio'), 'Audio 1', 'timeline should label the base audio lane generically');
  assert.equal(workspaceTimelineTrackLabel('audio-3'), 'Audio 3', 'timeline should label added audio tracks generically');
});

test('MaxVideoAI editor timeline defaults to one video track and two audio tracks', async () => {
  const {
    MIN_TIMELINE_AUDIO_TRACKS,
    audioTrackCountForTimelineItems,
    createWorkspaceSequenceRecord,
    videoTrackCountForTimelineItems,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state');
  const { DEFAULT_WORKSPACE_PROJECT_SETTINGS } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-settings'
  );

  assert.equal(MIN_TIMELINE_AUDIO_TRACKS, 2, 'timeline should expose two audio tracks by default');
  assert.equal(videoTrackCountForTimelineItems([]), 1, 'empty timelines should start with one video track');
  assert.equal(audioTrackCountForTimelineItems([]), 2, 'empty timelines should start with two audio tracks');

  const emptySequence = createWorkspaceSequenceRecord({
    id: 'sequence-default-tracks',
    name: 'Default tracks',
    timelineItems: [],
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  });

  assert.equal(emptySequence.videoTrackCount, 1, 'new empty sequences should persist one video track');
  assert.equal(emptySequence.audioTrackCount, 2, 'new empty sequences should persist two audio tracks');
});

test('MaxVideoAI editor render options reflect each engine audio capability', async () => {
  const includedAudioEngine: EngineCaps = {
    id: 'test-native-audio-video',
    label: 'Test Native Audio Video',
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes: ['t2v'],
    maxDurationSec: 12,
    resolutions: ['720p'],
    aspectRatios: ['16:9'],
    fps: [24],
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {},
    inputSchema: {
      required: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
      optional: [],
    },
    modeCaps: {
      t2v: {
        modes: ['t2v'],
        audioToggle: false,
      },
    },
    updatedAt: '2026-06-05T00:00:00.000Z',
    ttlSec: 3600,
    availability: 'available',
  };
  const toggledAudioEngine: EngineCaps = {
    ...includedAudioEngine,
    id: 'test-toggle-audio-video',
    label: 'Test Toggle Audio Video',
    inputSchema: {
      required: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
      optional: [
        {
          id: 'generate_audio',
          type: 'boolean',
          label: 'Generate audio',
          default: true,
        },
      ],
    },
    modeCaps: {
      t2v: {
        modes: ['t2v'],
        audioToggle: true,
      },
    },
  };
  const lipSyncEngine: EngineCaps = {
    ...toggledAudioEngine,
    id: 'test-lip-sync-video',
    label: 'Test Lip Sync Video',
    inputSchema: {
      required: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
      optional: [
        {
          id: 'generate_audio',
          type: 'boolean',
          label: 'Generate audio',
          default: true,
        },
        {
          id: 'lip_sync',
          type: 'boolean',
          label: 'Lip-sync',
          default: false,
        },
      ],
    },
  };
  const silentEngine: EngineCaps = {
    ...includedAudioEngine,
    id: 'test-silent-video',
    label: 'Test Silent Video',
    audio: false,
    modeCaps: {
      t2v: {
        modes: ['t2v'],
        audioToggle: false,
      },
    },
  };

  const [includedCapability, toggledCapability, lipSyncCapability, silentCapability] = getWorkspaceModelCapabilities([
    includedAudioEngine,
    toggledAudioEngine,
    lipSyncEngine,
    silentEngine,
  ]);
  assert.ok(includedCapability);
  assert.ok(toggledCapability);
  assert.ok(lipSyncCapability);
  assert.ok(silentCapability);

  assert.deepEqual(
    resolveWorkspaceRenderOptions(includedAudioEngine).map((option) => [option.id, option.control, option.defaultEnabled]),
    [['audio', 'included', true]],
    'native audio engines should expose included audio without a user toggle'
  );
  assert.equal(includedCapability.lip_sync, false, 'native audio alone should not imply a lip-sync option');
  assert.deepEqual(
    toggledCapability.render_options.map((option) => [option.id, option.control, option.defaultEnabled]),
    [['audio', 'toggle', true]],
    'engines with mode audioToggle should expose a user-controlled audio option'
  );
  assert.deepEqual(
    lipSyncCapability.render_options.map((option) => option.id),
    ['audio', 'lip_sync'],
    'lip-sync should be visible only when the engine schema exposes a lip-sync field'
  );
  assert.deepEqual(silentCapability.render_options, [], 'silent engines should not expose audio render options');

  const settings: WorkspaceShotSettings = {
    modelId: 'test-toggle-audio-video',
    workflowType: 'text_to_video',
    durationSec: 5,
    aspectRatio: '16:9',
    resolution: '720p',
    fps: 24,
    seed: null,
    audioEnabled: true,
    lipSyncEnabled: true,
    referenceStrength: 0.5,
    outputName: 'Audio routing test',
    status: 'ready',
  };
  assert.equal(
    workspaceAudioEnabledForRequest(settings, includedCapability),
    undefined,
    'included native audio should not send a fake generate_audio toggle'
  );
  assert.equal(
    workspaceAudioEnabledForRequest(settings, toggledCapability),
    true,
    'toggle-capable engines should send the selected audio state'
  );
  assert.equal(
    workspaceAudioEnabledForRequest({ ...settings, audioEnabled: false }, toggledCapability),
    false,
    'toggle-capable engines should preserve disabled audio for pricing and generation'
  );
  assert.equal(
    workspaceAudioEnabledForRequest(settings, silentCapability),
    undefined,
    'silent engines should omit audio from requests'
  );

  const { buildWorkspaceShotGenerateRequest } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation'
  );
  const baseGenerateRequest = {
    settings,
    capability: toggledCapability,
    prompt: 'Prompt',
    connectedInputs: ['prompt'] as const,
    referenceImages: [] as string[],
    videoReferences: [] as string[],
    audioReferences: [] as string[],
    shotNodeId: 'shot-test',
    outputName: 'Audio routing test',
  };
  assert.equal(
    buildWorkspaceShotGenerateRequest(baseGenerateRequest).audio,
    true,
    'generate request should send audio only for supported engine toggles'
  );
  assert.equal(
    'audio' in buildWorkspaceShotGenerateRequest({ ...baseGenerateRequest, capability: includedCapability }),
    false,
    'generate request should omit audio for included native-audio engines'
  );
  assert.equal(
    'audio' in buildWorkspaceShotGenerateRequest({ ...baseGenerateRequest, capability: silentCapability }),
    false,
    'generate request should omit audio for silent engines'
  );
});

test('MaxVideoAI editor active model capabilities expose additive engine contracts', () => {
  const capabilities = getWorkspaceModelCapabilities();
  assert.ok(capabilities.length > 0, 'active engine registry should expose at least one workspace capability');

  for (const capability of capabilities) {
    assert.ok(capability.id, 'each capability should have a stable model id');
    assert.ok(capability.workflows.length > 0, `${capability.id} should expose at least one generation workflow`);
    assert.ok(capability.input_connectors.length > 0, `${capability.id} should expose editor input connectors`);
    assert.ok(capability.supported_aspect_ratios.length > 0, `${capability.id} should expose supported aspect ratios`);
    assert.ok(capability.supported_resolutions.length > 0, `${capability.id} should expose supported resolutions`);
    assert.ok(capability.supported_fps.length > 0, `${capability.id} should expose supported FPS values`);

    const connectorKinds = new Set(capability.input_connectors.map((connector) => connector.kind));
    const requiredKinds = new Set(capability.required_inputs);
    const optionalKinds = new Set(capability.optional_inputs);

    for (const required of requiredKinds) {
      assert.ok(connectorKinds.has(required), `${capability.id} should render required connector ${required}`);
      assert.equal(optionalKinds.has(required), false, `${capability.id} should not mark ${required} required and optional`);
    }

    for (const optional of optionalKinds) {
      assert.ok(connectorKinds.has(optional), `${capability.id} should render optional connector ${optional}`);
    }

    for (const unsupported of capability.unsupported_inputs) {
      assert.equal(connectorKinds.has(unsupported), false, `${capability.id} should not render unsupported connector ${unsupported}`);
    }

    assert.equal(
      capability.audio_generation,
      capability.render_options.some((option) => option.id === 'audio'),
      `${capability.id} should derive audio_generation from render options`
    );
    assert.equal(
      capability.lip_sync,
      capability.render_options.some((option) => option.id === 'lip_sync'),
      `${capability.id} should derive lip_sync from render options`
    );
  }
});

test('MaxVideoAI editor generation resolves connected output media references', async () => {
  const { mediaUrlsFromKinds } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation'
  );
  const template = createProductAdWorkspaceTemplate();

  assert.deepEqual(
    mediaUrlsFromKinds(template.nodes, template.edges, 'shot-02', ['previous_shot']),
    ['/hero/pika-22.mp4'],
    'generated output blocks connected as previous shots should route their video URL into generation inputs'
  );

  const processingNodes = template.nodes.map((node) => {
    if (node.id !== 'output-01' || !node.data.output) return node;
    return {
      ...node,
      data: {
        ...node.data,
        output: {
          ...node.data.output,
          status: 'processing' as const,
        },
      },
    };
  });
  assert.deepEqual(
    mediaUrlsFromKinds(processingNodes, template.edges, 'shot-02', ['previous_shot']),
    [],
    'processing output blocks should not be sent as ready generation references'
  );
});

test('MaxVideoAI editor generate block derives unified connectors from existing engine schemas', () => {
  const testEngine: EngineCaps = {
    id: 'test-unified-video',
    label: 'Test Unified Video',
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes: ['t2v', 'i2v', 'fl2v'],
    maxDurationSec: 10,
    resolutions: ['1080p'],
    aspectRatios: ['16:9'],
    fps: [24],
    audio: false,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {},
    inputSchema: {
      required: [
        {
          id: 'prompt',
          type: 'text',
          label: 'Prompt',
        },
      ],
      optional: [
        {
          id: 'negative_prompt',
          type: 'text',
          label: 'Negative prompt',
        },
        {
          id: 'image_url',
          type: 'image',
          label: 'Start image',
          modes: ['i2v'],
        },
        {
          id: 'end_image_url',
          type: 'image',
          label: 'End image',
          modes: ['fl2v'],
        },
      ],
    },
    updatedAt: '2026-06-05T00:00:00.000Z',
    ttlSec: 3600,
    availability: 'available',
  };

  const [capability] = getWorkspaceModelCapabilities([testEngine]);
  assert.ok(capability, 'test engine should produce a workspace capability');
  const inputConnectors = (capability as unknown as { input_connectors?: unknown }).input_connectors;
  assert.ok(Array.isArray(inputConnectors), 'capability should expose input_connectors');
  assert.deepEqual(
    inputConnectors.map((connector) => connector.kind),
    ['prompt', 'negative_prompt', 'start_image', 'end_image'],
    'generate block connectors should expose prompt, negative prompt, start image, and end image without a manual workflow split'
  );
  assert.deepEqual(
    inputConnectors.map((connector) => connector.label),
    ['Prompt', 'Negative prompt', 'Start image', 'End image'],
    'connector labels should reuse engine input schema labels'
  );

  const settings: WorkspaceShotSettings = {
    modelId: 'test-unified-video',
    workflowType: 'text_to_video',
    durationSec: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 24,
    seed: null,
    audioEnabled: false,
    lipSyncEnabled: false,
    referenceStrength: 0.5,
    outputName: 'Unified test',
    status: 'ready',
  };
  const validation = validateShotConnections({
    settings,
    connectedInputs: ['prompt', 'start_image'],
    capabilities: [capability],
  });

  assert.equal(validation.canGenerate, true, 'start image should be compatible when the engine supports image generation');
  assert.equal(validation.resolvedWorkflowType, 'image_to_video', 'connected start image should route generation internally to image-to-video');
});

test('MaxVideoAI editor connector compatibility and capacity are enforced', () => {
  const testEngine: EngineCaps = {
    id: 'test-reference-limits-video',
    label: 'Test Reference Limits Video',
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes: ['t2v', 'ref2v', 'v2v'],
    maxDurationSec: 10,
    resolutions: ['1080p'],
    aspectRatios: ['16:9'],
    fps: [24],
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {},
    inputSchema: {
      required: [
        {
          id: 'prompt',
          type: 'text',
          label: 'Prompt',
        },
      ],
      optional: [
        {
          id: 'image_urls',
          type: 'image',
          label: 'Reference images (up to 9)',
          maxCount: 9,
          modes: ['ref2v'],
        },
        {
          id: 'video_urls',
          type: 'video',
          label: 'Reference video clips (up to 3)',
          maxCount: 3,
          modes: ['ref2v'],
        },
      ],
    },
    updatedAt: '2026-06-05T00:00:00.000Z',
    ttlSec: 3600,
    availability: 'available',
  };

  const [capability] = getWorkspaceModelCapabilities([testEngine]);
  assert.ok(capability, 'test engine should produce a workspace capability');
  const connectors = getWorkspaceShotInputConnectors(capability);
  const referenceConnector = connectors.find((connector) => connector.kind === 'reference');
  const videoConnector = connectors.find((connector) => connector.kind === 'video_reference');
  assert.ok(referenceConnector, 'image reference connector should exist');
  assert.ok(videoConnector, 'video reference connector should exist');
  assert.equal(referenceConnector.label, 'Reference images', 'connector label should remove copied up-to count text');
  assert.equal(videoConnector.label, 'Reference video clips', 'video connector label should remove copied up-to count text');
  assert.deepEqual(
    workspaceConnectionCapacity({ connector: referenceConnector, connectedCount: 0 }),
    { maxCount: 9, remainingCount: 9, capacityLabel: '9/9', isFull: false },
    'empty multi-reference connector should show full remaining capacity'
  );
  assert.deepEqual(
    workspaceConnectionCapacity({ connector: referenceConnector, connectedCount: 2 }),
    { maxCount: 9, remainingCount: 7, capacityLabel: '7/9', isFull: false },
    'multi-reference connector should count down as references are connected'
  );
  assert.deepEqual(
    workspaceConnectionCapacity({ connector: referenceConnector, connectedCount: 9 }),
    { maxCount: 9, remainingCount: 0, capacityLabel: '0/9', isFull: true },
    'full multi-reference connector should expose zero remaining capacity'
  );

  assert.equal(
    isWorkspaceConnectionCompatible({ sourceHandle: 'prompt', targetHandle: 'start_image' }),
    false,
    'prompt outputs should not connect to image inputs'
  );
  assert.equal(
    isWorkspaceConnectionCompatible({ sourceHandle: 'audio', targetHandle: 'video_reference' }),
    false,
    'audio outputs should not connect to video inputs'
  );
  assert.equal(
    isWorkspaceConnectionCompatible({ sourceHandle: 'reference', targetHandle: 'start_image' }),
    true,
    'image outputs should connect to image inputs'
  );
  assert.equal(
    isWorkspaceConnectionCompatible({ sourceHandle: 'video_reference', targetHandle: 'motion_reference' }),
    true,
    'video outputs should connect to video inputs'
  );
  assert.equal(
    isWorkspaceConnectionCompatible({ sourceHandle: 'generated_output', targetHandle: 'generated_output' }),
    true,
    'generated shot outputs should connect to output blocks'
  );
  assert.equal(
    isWorkspaceConnectionCompatible({ sourceHandle: 'generated_output', targetHandle: 'previous_shot' }),
    true,
    'generated shot outputs should connect to downstream video continuity inputs'
  );
  assert.equal(
    isWorkspaceConnectionCompatible({ sourceHandle: 'video_reference', targetHandle: 'generated_output' }),
    false,
    'plain video assets should not masquerade as generated shot outputs'
  );
  assert.equal(
    isWorkspaceConnectionCompatible({ sourceHandle: 'generated_output', targetHandle: 'prompt' }),
    false,
    'generated outputs should not connect to text inputs'
  );
});

test('MaxVideoAI editor source blocks are output-only graph sources', () => {
  const singleOutputByKind = new Map([
    ['asset-image', 'reference'],
    ['asset-video', 'video_reference'],
    ['asset-audio', 'audio'],
    ['text-prompt', 'prompt'],
  ]);
  const templates = [createDevBlocksWorkspaceTemplate(), createProductAdWorkspaceTemplate()];

  for (const template of templates) {
    const sourceNodes = template.nodes.filter((node) => singleOutputByKind.has(String(node.data.kind)));
    assert.ok(sourceNodes.length > 0, `${template.id} should include output-only source blocks`);

    for (const node of sourceNodes) {
      const expectedOutput = singleOutputByKind.get(String(node.data.kind));
      assert.deepEqual(node.data.targetHandles ?? [], [], `${node.id} should not expose input handles`);
      assert.deepEqual(node.data.sourceHandles ?? [], [expectedOutput], `${node.id} should expose one generic output handle`);
    }
  }

  const devTemplate = createDevBlocksWorkspaceTemplate();
  const devVideoNode = devTemplate.nodes.find((node) => node.id === 'dev-asset-video');
  const devAudioNode = devTemplate.nodes.find((node) => node.id === 'dev-asset-audio');
  assert.match(String(devVideoNode?.data.asset?.url ?? ''), /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i, 'video source preview should have a playable video URL');
  assert.match(String(devAudioNode?.data.asset?.url ?? ''), /^(?:data:audio\/|blob:|.*\.(?:mp3|wav|ogg|m4a|aac)(?:[?#].*)?$)/i, 'audio source preview should have a playable audio URL');
  assert.ok(
    devTemplate.edges.some(
      (edge) =>
        edge.source === 'dev-asset-image' &&
        edge.sourceHandle === 'reference' &&
        edge.targetHandle === 'start_image' &&
        edge.data?.kind === 'start_image'
    ),
    'image source output should be role-mapped to the generated shot start image input'
  );
  assert.ok(
    devTemplate.edges.some(
      (edge) =>
        edge.source === 'dev-asset-video' &&
        edge.sourceHandle === 'video_reference' &&
        edge.targetHandle === 'video_reference' &&
        edge.data?.kind === 'video_reference'
    ),
    'video source output should be role-mapped to the generated shot video input'
  );
  assert.equal(
    devTemplate.edges.some((edge) => edge.source === 'dev-asset-audio'),
    false,
    'audio source output should stay available without forcing an unsupported generated-shot input'
  );
  assert.ok(
    devTemplate.edges.some(
      (edge) =>
        edge.source === 'dev-text-prompt' &&
        edge.sourceHandle === 'prompt' &&
        edge.targetHandle === 'prompt' &&
        edge.data?.kind === 'prompt'
    ),
    'text source output should stay a prompt when connected to a prompt input'
  );

  for (const template of templates) {
    const shotNodes = template.nodes.filter((node) => node.data.kind === 'shot');
    assert.ok(shotNodes.length > 0, `${template.id} should include generated shot blocks`);
    for (const node of shotNodes) {
      assert.ok(node.data.shot, `${node.id} should carry shot settings for output handle derivation`);
      assert.deepEqual(node.data.sourceHandles ?? [], [shotOutputSourceHandle(node.data.shot)], `${node.id} should expose one media-specific generated output handle`);
    }

    const outputNodes = template.nodes.filter((node) => node.data.kind === 'output');
    assert.ok(outputNodes.length > 0, `${template.id} should include generated output blocks`);
    for (const node of outputNodes) {
      assert.deepEqual(node.data.targetHandles ?? [], ['generated_output'], `${node.id} should expose one generated-output input`);
      assert.deepEqual(node.data.sourceHandles ?? [], ['video_reference'], `${node.id} should expose one reusable video output`);
    }
  }
});

test('MaxVideoAI editor pricing preflight mirrors generate video parameters', async () => {
  assert.ok(existsSync(pricingPath), 'workspace pricing adapter should exist before building preflight payloads');
  const { buildWorkspaceShotPreflightRequest, formatWorkspacePricingEstimate } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing'
  );
  const settings: WorkspaceShotSettings = {
    modelId: 'test-unified-video',
    workflowType: 'text_to_video',
    durationSec: 8,
    aspectRatio: '9:16',
    resolution: '1080p',
    fps: 24,
    seed: 123,
    audioEnabled: true,
    lipSyncEnabled: false,
    referenceStrength: 0.5,
    outputName: 'Pricing test',
    status: 'ready',
  };
  const capability = {
    modes: ['t2v', 'i2v', 'v2v'],
    render_options: [{ id: 'audio', label: 'Audio', control: 'toggle', defaultEnabled: false }],
  } as WorkspaceModelCapability;

  const imageRequest = buildWorkspaceShotPreflightRequest({
    settings,
    connectedInputs: ['prompt', 'start_image'],
    capability,
    memberTier: 'Pro',
  });
  assert.deepEqual(
    {
      engine: imageRequest.engine,
      mode: imageRequest.mode,
      durationSec: imageRequest.durationSec,
      resolution: imageRequest.resolution,
      aspectRatio: imageRequest.aspectRatio,
      fps: imageRequest.fps,
      audio: imageRequest.audio,
      seedLocked: imageRequest.seedLocked,
      memberTier: imageRequest.user?.memberTier,
    },
    {
      engine: 'test-unified-video',
      mode: 'i2v',
      durationSec: 8,
      resolution: '1080p',
      aspectRatio: '9:16',
      fps: 24,
      audio: true,
      seedLocked: true,
      memberTier: 'Pro',
    },
    'editor pricing preflight should carry the same shot parameters used by generate video'
  );

  const videoRequest = buildWorkspaceShotPreflightRequest({
    settings,
    connectedInputs: ['prompt', 'video_reference'],
    capability,
    memberTier: 'Member',
  });
  assert.equal(videoRequest.mode, 'v2v', 'video references should route pricing to the video-to-video engine mode');

  assert.equal(
    formatWorkspacePricingEstimate({ ok: true, total: 123, currency: 'USD' }).label,
    'Est. $1.23',
    'preflight totals should render as the visible estimate label'
  );
});

test('MaxVideoAI editor handle drops create matching graph blocks', async () => {
  assert.ok(existsSync(handleDropPath), 'workspace handle-drop helper should exist before resolving drag-created blocks');
  const { createWorkspaceHandleDropNode, resolveWorkspaceHandleDropDraft } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-handle-drop'
  );

  const promptDraft = resolveWorkspaceHandleDropDraft('prompt', 'target');
  assert.equal(promptDraft?.nodeKind, 'text-prompt');
  assert.equal(promptDraft?.sourceHandle, 'prompt');

  const imageDraft = resolveWorkspaceHandleDropDraft('start_image', 'target');
  assert.equal(imageDraft?.nodeKind, 'asset-image');
  assert.equal(imageDraft?.sourceHandle, 'reference');
  assert.equal(imageDraft?.targetHandle, 'start_image');

  const videoDraft = resolveWorkspaceHandleDropDraft('motion_reference', 'target');
  assert.equal(videoDraft?.nodeKind, 'asset-video');
  assert.equal(videoDraft?.sourceHandle, 'video_reference');
  assert.equal(videoDraft?.targetHandle, 'motion_reference');

  const audioDraft = resolveWorkspaceHandleDropDraft('voiceover', 'target');
  assert.equal(audioDraft?.nodeKind, 'asset-audio');
  assert.equal(audioDraft?.sourceHandle, 'audio');
  assert.equal(audioDraft?.targetHandle, 'voiceover');

  const outputDraft = resolveWorkspaceHandleDropDraft('generated_output', 'source');
  assert.equal(outputDraft?.nodeKind, 'output');
  assert.equal(outputDraft?.sourceHandle, 'video_reference');
  assert.equal(outputDraft?.targetHandle, 'generated_output');

  const node = createWorkspaceHandleDropNode({
    draft: promptDraft!,
    defaultModelId: 'kling-3-pro',
    index: 3,
    position: { x: 10, y: 20 },
  });
  assert.equal(node.type, 'text-prompt');
  assert.equal(node.position.x, 10);
  assert.equal(node.position.y, 20);
  assert.deepEqual(node.data.targetHandles ?? [], []);
  assert.deepEqual(node.data.sourceHandles ?? [], ['prompt']);

  const imageNode = createWorkspaceHandleDropNode({
    draft: imageDraft!,
    defaultModelId: 'kling-3-pro',
    index: 4,
    position: { x: 30, y: 40 },
  });
  assert.equal(imageNode.type, 'asset-image');
  assert.equal(imageNode.data.asset, undefined, 'drag-created image blocks should start empty so the user can pick media');
  assert.deepEqual(imageNode.data.sourceHandles ?? [], ['reference']);

  const videoNode = createWorkspaceHandleDropNode({
    draft: videoDraft!,
    defaultModelId: 'kling-3-pro',
    index: 5,
    position: { x: 50, y: 60 },
  });
  assert.equal(videoNode.type, 'asset-video');
  assert.equal(videoNode.data.asset, undefined, 'drag-created video blocks should start empty so the user can pick media');
  assert.deepEqual(videoNode.data.sourceHandles ?? [], ['video_reference']);

  const outputNode = createWorkspaceHandleDropNode({
    draft: outputDraft!,
    defaultModelId: 'kling-3-pro',
    index: 6,
    position: { x: 70, y: 80 },
  });
  assert.equal(outputNode.type, 'output');
  assert.equal(outputNode.data.output?.status, 'placeholder', 'drag-created output blocks should be placeholders until a job writes media');
  assert.equal(outputNode.data.output?.url, null, 'placeholder output blocks should not pretend to have playable media');
  assert.equal(outputNode.data.output?.thumbUrl, null, 'placeholder output blocks should not pretend to have a generated thumbnail');
  assert.deepEqual(outputNode.data.targetHandles ?? [], ['generated_output']);
  assert.deepEqual(outputNode.data.sourceHandles ?? [], ['video_reference']);
});

test('MaxVideoAI editor creates a processing output before generated media exists', async () => {
  const { createPendingWorkspaceOutput } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation'
  );
  const template = createDevBlocksWorkspaceTemplate();
  const shotNode = template.nodes.find((node) => node.id === 'dev-shot');
  assert.ok(shotNode?.data.shot, 'Dev template should include a generated shot block');

  const pending = createPendingWorkspaceOutput({
    shotNode,
    settings: shotNode.data.shot,
    capability: null,
    nodes: template.nodes,
    edges: template.edges,
    siblingCount: 0,
  });

  assert.equal(pending.output.status, 'processing', 'pending output metadata should represent an in-flight render');
  assert.equal(pending.output.url, null, 'pending output should not expose a fake video URL');
  assert.equal(pending.output.thumbUrl, null, 'pending output should not expose a fake generated thumbnail');
  assert.equal(pending.output.sourceShotId, 'dev-shot');
  assert.equal(pending.outputNode.type, 'output');
  assert.equal(pending.outputNode.data.output?.status, 'processing');
  assert.deepEqual(pending.outputNode.data.targetHandles ?? [], ['generated_output']);
  assert.deepEqual(pending.outputNode.data.sourceHandles ?? [], ['video_reference']);
  assert.equal(pending.outputEdge.source, 'dev-shot');
  assert.equal(pending.outputEdge.target, pending.outputNode.id);
  assert.equal(pending.outputEdge.sourceHandle, 'video_reference');
  assert.equal(pending.outputEdge.targetHandle, 'generated_output');
});

test('MaxVideoAI editor timeline editing supports drag ordering and cut splits', async () => {
  const {
    buildWorkspaceTimelineItemsForAsset,
    buildWorkspaceTimelineItemsForOutput,
    deleteWorkspaceTimelineItem,
    insertWorkspaceTimelineItems,
    linkWorkspaceTimelineSelection,
    moveWorkspaceTimelineItem,
    moveWorkspaceTimelineSelectionWithMode,
    normalizeWorkspaceTimelineIdentities,
    positionWorkspaceTimelineItem,
    positionWorkspaceTimelineItems,
    reorderWorkspaceTimelineItem,
    resizeWorkspaceTimelineItem,
    splitWorkspaceTimelineItem,
    toggleWorkspaceTimelineCrossfade,
    trimWorkspaceTimelineItem,
    unlinkWorkspaceTimelineSelection,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing');
  const { resolveTimelineExternalDropPreview } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-external-drop');
  const { projectMediaTimelineDragPayloadForAsset } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-drag');
  const { timelineTrackHasOverlap } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-collisions');
  const assertNoTimelineOverlap = (candidateItems: WorkspaceTimelineItem[], message: string) => {
    assert.equal(timelineTrackHasOverlap(candidateItems), false, message);
  };
  const items: WorkspaceTimelineItem[] = [
    {
      id: 'clip-a',
      outputNodeId: 'output-a',
      track: 'video',
      title: 'Clip A',
      durationSec: 8,
      startSec: 0,
      sourceStartSec: 0,
      sourceDurationSec: 8,
      linkedGroupId: 'group-a',
      mediaKind: 'video',
      hasEmbeddedAudio: true,
      mediaUrl: '/hero/veo3.mp4',
    },
    {
      id: 'clip-a-audio',
      outputNodeId: 'output-a',
      track: 'audio',
      title: 'Clip A Audio',
      durationSec: 8,
      startSec: 0,
      sourceStartSec: 0,
      sourceDurationSec: 8,
      linkedGroupId: 'group-a',
      mediaKind: 'audio',
      mediaUrl: '/hero/veo3.mp4',
    },
    {
      id: 'clip-b',
      outputNodeId: 'output-b',
      track: 'video',
      title: 'Clip B',
      durationSec: 6,
      startSec: 8,
      mediaUrl: '/hero/pika-22.mp4',
    },
    {
      id: 'music-a',
      outputNodeId: 'audio-a',
      track: 'audio-2',
      title: 'Music',
      durationSec: 12,
      startSec: 0,
    },
  ];

  const moved = moveWorkspaceTimelineItem(items, 'clip-b', -1);
  assert.deepEqual(
    moved.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec]),
    [
      ['clip-b', 0],
      ['clip-a', 6],
    ],
    'moving a clip left should reorder only its track and recalculate video starts'
  );
  assert.deepEqual(
    moved.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec]),
    [['clip-a-audio', 6, 8]],
    'linked audio should stay synchronized when its video group moves'
  );
  assert.deepEqual(
    moved.filter((item) => item.track === 'audio-2').map((item) => [item.id, item.startSec]),
    [['music-a', 0]],
    'moving video clips should not disturb music track timing'
  );

  const dragged = reorderWorkspaceTimelineItem(items, 'clip-a', 'clip-b');
  assert.deepEqual(
    dragged.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec]),
    [
      ['clip-b', 0],
      ['clip-a', 6],
    ],
    'dragging clip A onto clip B should place it after the drop target and normalize starts'
  );

  const split = splitWorkspaceTimelineItem(items, 'clip-a', 3);
  assert.deepEqual(
    split.filter((item) => item.track === 'video').map((item) => [item.id, item.durationSec, item.startSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 3, 0, 0],
      ['clip-a-split', 5, 3, 3],
      ['clip-b', 6, 8, 0],
    ],
    'cut should split a clip at the requested offset, keep subsequent clips aligned, and preserve source in-points'
  );
  assert.deepEqual(
    split.filter((item) => item.track === 'audio').map((item) => [item.id, item.durationSec, item.startSec, item.sourceStartSec, item.linkedGroupId]),
    [
      ['clip-a-audio', 3, 0, 0, 'group-a'],
      ['clip-a-audio-split', 5, 3, 3, 'group-a-split'],
    ],
    'cut should split linked audio with the same timing and a new right-side group'
  );

  const splitAgain = splitWorkspaceTimelineItem(split, 'clip-a', 1.5);
  assert.equal(
    new Set(splitAgain.map((item) => item.id)).size,
    splitAgain.length,
    'repeated cuts should keep every timeline item id unique'
  );
  assert.deepEqual(
    splitAgain.filter((item) => item.track === 'video').map((item) => [item.id, item.linkedGroupId ?? null, item.durationSec, item.startSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 'group-a', 1.5, 0, 0],
      ['clip-a-split-2', 'group-a-split-2', 1.5, 1.5, 1.5],
      ['clip-a-split', 'group-a-split', 5, 3, 3],
      ['clip-b', null, 6, 8, 0],
    ],
    'cutting an already split left segment should create a new right-side identity instead of colliding with the older split'
  );
  assert.deepEqual(
    Array.from(splitAgain.reduce((groups, item) => {
      if (!item.linkedGroupId) return groups;
      const tracks = groups.get(item.linkedGroupId) ?? [];
      tracks.push(item.track);
      groups.set(item.linkedGroupId, tracks);
      return groups;
    }, new Map<string, WorkspaceTimelineTrack[]>()).entries())
      .map(([groupId, tracks]) => [groupId, tracks.sort()])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    [
      ['group-a', ['audio', 'video']],
      ['group-a-split', ['audio', 'video']],
      ['group-a-split-2', ['audio', 'video']],
    ],
    'each split segment should keep exactly one video and one linked audio item in its own linked group'
  );

  const repairedDuplicateSplit = normalizeWorkspaceTimelineIdentities([
    { ...items[0], id: 'duplicate-video', linkedGroupId: 'duplicate-group', startSec: 0, durationSec: 2 },
    { ...items[0], id: 'duplicate-video', linkedGroupId: 'duplicate-group', startSec: 2, durationSec: 2, sourceStartSec: 2 },
    { ...items[1], id: 'duplicate-audio', linkedGroupId: 'duplicate-group', startSec: 0, durationSec: 2 },
    { ...items[1], id: 'duplicate-audio', linkedGroupId: 'duplicate-group', startSec: 2, durationSec: 2, sourceStartSec: 2 },
  ]);
  assert.deepEqual(
    repairedDuplicateSplit.map((item) => [item.id, item.linkedGroupId, item.startSec, item.durationSec]),
    [
      ['duplicate-video', 'duplicate-group', 0, 2],
      ['duplicate-video-2', 'duplicate-group-2', 2, 2],
      ['duplicate-audio', 'duplicate-group', 0, 2],
      ['duplicate-audio-2', 'duplicate-group-2', 2, 2],
    ],
    'persisted timelines with stale duplicate split ids should be repaired into distinct linked clip pairs'
  );

  const movedRepairedSplit = positionWorkspaceTimelineItem(repairedDuplicateSplit, 'duplicate-video-2', 4);
  assert.deepEqual(
    movedRepairedSplit.filter((item) => item.linkedGroupId === 'duplicate-group-2').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['duplicate-video-2', 4, 2],
      ['duplicate-audio-2', 4, 2],
    ],
    'dragging one repaired split segment should move only its video/audio pair'
  );
  assert.deepEqual(
    movedRepairedSplit.filter((item) => item.linkedGroupId === 'duplicate-group').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['duplicate-video', 0, 2],
      ['duplicate-audio', 0, 2],
    ],
    'dragging a repaired segment should not move the older segment from the same original clip'
  );

  const repairedOrphanAudioGroup = normalizeWorkspaceTimelineIdentities([
    { ...items[1], id: 'orphan-audio', linkedGroupId: 'orphan-group' },
  ]);
  assert.deepEqual(
    repairedOrphanAudioGroup.map((item) => [item.id, item.linkedGroupId ?? null, item.linkedGroupKind ?? null]),
    [['orphan-audio', null, null]],
    'persisted orphan audio links should be cleared when no corresponding video clip remains'
  );

  const trimmedEnd = trimWorkspaceTimelineItem(items, 'clip-a', 'end', 2);
  assert.deepEqual(
    trimmedEnd.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.durationSec, item.startSec, item.sourceStartSec]),
    [
      ['clip-a', 6, 0, 0],
      ['clip-a-audio', 6, 0, 0],
    ],
    'end trim should shorten linked video and audio together'
  );
  assert.equal(
    trimmedEnd.find((item) => item.id === 'clip-b')?.startSec,
    6,
    'end trim should ripple the next video clip left'
  );

  const trimmedStart = trimWorkspaceTimelineItem(items, 'clip-a', 'start', 2);
  assert.deepEqual(
    trimmedStart.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.durationSec, item.startSec, item.sourceStartSec]),
    [
      ['clip-a', 6, 0, 2],
      ['clip-a-audio', 6, 0, 2],
    ],
    'start trim should advance linked source in-points while keeping the group on the sequence line'
  );

  const positioned = positionWorkspaceTimelineItem(items, 'clip-a', 4);
  assert.deepEqual(
    positioned.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 4, 8],
      ['clip-a-audio', 4, 8],
    ],
    'pointer move should reposition linked video and audio together'
  );

  const multiPositioned = positionWorkspaceTimelineItems(items, ['clip-a', 'clip-b'], 'clip-a', 2);
  assert.deepEqual(
    multiPositioned.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 2, 8],
      ['clip-b', 10, 6],
    ],
    'multi-select drag should move selected visual clips together while preserving their relative timing'
  );
  assert.deepEqual(
    multiPositioned.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec]),
    [['clip-a-audio', 2, 8]],
    'multi-select drag should keep linked audio synchronized with selected video groups'
  );
  assert.deepEqual(
    positionWorkspaceTimelineItems(items, ['clip-a', 'clip-b'], 'clip-a', -6)
      .filter((item) => item.track === 'video')
      .map((item) => [item.id, item.startSec]),
    [
      ['clip-a', 0],
      ['clip-b', 8],
    ],
    'multi-select drag should clamp the whole selection at the start of the sequence'
  );

  const pointerReordered = positionWorkspaceTimelineItem(items, 'clip-b', 0);
  assert.deepEqual(
    pointerReordered.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec]),
    [
      ['clip-b', 0],
      ['clip-a', 6],
    ],
    'dragging a clip past a neighboring midpoint should reorder the video track instead of leaving the clip blocked'
  );
  assert.deepEqual(
    pointerReordered.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec]),
    [['clip-a-audio', 6, 8]],
    'pointer reorder should keep linked audio aligned with its moved video group'
  );

  const movedToOverlayTrack = positionWorkspaceTimelineItem(items, 'clip-a', 1, 'video-2');
  assert.deepEqual(
    movedToOverlayTrack.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['clip-a', 'video-2', 1, 8],
      ['clip-a-audio', 'audio', 1, 8],
    ],
    'vertical drag should move the video clip to a target video track while keeping linked audio synchronized'
  );

  const resizedEnd = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 5,
  });
  assert.deepEqual(
    resizedEnd.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec]),
    [
      ['clip-a', 0, 5, 0],
      ['clip-a-audio', 0, 5, 0],
    ],
    'pointer end-resize should shorten linked video and audio together'
  );

  const resizedStart = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'start',
    nextStartSec: 2,
    nextDurationSec: 6,
  });
  assert.deepEqual(
    resizedStart.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec]),
    [
      ['clip-a', 2, 6, 2],
      ['clip-a-audio', 2, 6, 2],
    ],
    'pointer start-resize should advance linked in-points and keep the group synchronized'
  );

  const blockedEndExpansion = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 20,
  });
  assert.deepEqual(
    blockedEndExpansion.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec]),
    [
      ['clip-a', 0, 8, 0],
      ['clip-a-audio', 0, 8, 0],
    ],
    'end-resize should not extend a clip beyond its original source duration'
  );

  const restoredStartExpansion = resizeWorkspaceTimelineItem({
    items: resizedStart,
    itemId: 'clip-a',
    edge: 'start',
    nextStartSec: -10,
    nextDurationSec: 20,
  });
  assert.deepEqual(
    restoredStartExpansion.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec]),
    [
      ['clip-a', 0, 8, 0],
      ['clip-a-audio', 0, 8, 0],
    ],
    'start-resize should restore earlier source frames but stop at the original media in-point'
  );

  const missingSourceDurationExpansion = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-b',
    edge: 'end',
    nextStartSec: 8,
    nextDurationSec: 20,
  });
  assert.equal(
    missingSourceDurationExpansion.find((item) => item.id === 'clip-b')?.durationSec,
    6,
    'clips without explicit source duration should treat their current duration as the source cap'
  );

  const rippleResizedEnd = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 5,
    mode: 'ripple',
  });
  assert.deepEqual(
    rippleResizedEnd.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 5],
      ['clip-b', 5, 6],
    ],
    'ripple end trim should pull later video clips left when the selected clip is shortened'
  );

  const rippleResizedAttachedChain = resizeWorkspaceTimelineItem({
    items: [
      ...items,
      {
        id: 'clip-c',
        outputNodeId: 'output-c',
        track: 'video',
        title: 'Clip C',
        durationSec: 3,
        startSec: 14,
        mediaUrl: '/hero/veo3-c.mp4',
      },
      {
        id: 'clip-d',
        outputNodeId: 'output-d',
        track: 'video',
        title: 'Clip D',
        durationSec: 3,
        startSec: 20,
        mediaUrl: '/hero/veo3-d.mp4',
      },
    ],
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 5,
    mode: 'ripple',
  });
  assert.deepEqual(
    rippleResizedAttachedChain.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 5],
      ['clip-b', 5, 6],
      ['clip-c', 11, 3],
      ['clip-d', 20, 3],
    ],
    'ripple end trim should move only the contiguous clip chain and preserve intentional gaps'
  );

  const rippleResizedStart = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-b',
    edge: 'start',
    nextStartSec: 10,
    nextDurationSec: 4,
    mode: 'ripple',
  });
  assert.deepEqual(
    rippleResizedStart.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 8, 0],
      ['clip-b', 8, 4, 2],
    ],
    'ripple start trim should advance the source in-point while keeping the clip on the sequence line'
  );

  const rollItems: WorkspaceTimelineItem[] = items.map((item) => {
    if (item.id === 'clip-a' || item.id === 'clip-a-audio') return { ...item, sourceDurationSec: 12 };
    if (item.id === 'clip-b') return { ...item, sourceStartSec: 2, sourceDurationSec: 10 };
    return item;
  });
  const rollResizedEnd = resizeWorkspaceTimelineItem({
    items: rollItems,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 10,
    mode: 'roll',
  });
  assert.deepEqual(
    rollResizedEnd.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 10],
      ['clip-b', 10, 4],
    ],
    'roll end trim should move the cut into the next clip without changing total sequence length'
  );

  const sourceBoundRollEnd = resizeWorkspaceTimelineItem({
    items: rollItems,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 20,
    mode: 'roll',
  });
  assert.deepEqual(
    sourceBoundRollEnd.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 12, 0],
      ['clip-b', 12, 2, 6],
    ],
    'roll trim should stop expanding the outgoing clip when its source media is exhausted'
  );

  const crossfaded = toggleWorkspaceTimelineCrossfade(items, 'clip-a', 1);
  assert.deepEqual(
    crossfaded.filter((item) => item.track === 'video').map((item) => [item.id, item.transitionOut?.type ?? null, item.transitionOut?.durationSec ?? null]),
    [
      ['clip-a', 'crossfade', 1],
      ['clip-b', null, null],
    ],
    'crossfade toggle should mark the outgoing selected clip when an adjacent next clip exists'
  );
  const crossfadeRemoved = toggleWorkspaceTimelineCrossfade(crossfaded, 'clip-a', 1);
  assert.equal(
    crossfadeRemoved.find((item) => item.id === 'clip-a')?.transitionOut,
    null,
    'crossfade toggle should remove an existing matching transition'
  );

  const linkedOutputItems = buildWorkspaceTimelineItemsForOutput({
    outputNodeId: 'output-c',
    title: 'Generated Clip',
    output: {
      kind: 'video',
      modelId: 'veo-3-1',
      modelLabel: 'Veo 3.1',
      workflowType: 'image_to_video',
      durationSec: 5,
      status: 'ready',
      createdAt: '2026-06-05T10:00:00.000Z',
      sourceShotId: 'shot-c',
      url: '/hero/veo3.mp4',
      thumbUrl: '/hero/showcase-veo-3-1.webp',
      hasAudio: true,
    },
    startSec: 14,
    idSeed: 'test',
  });
  assert.deepEqual(
    linkedOutputItems.map((item) => [item.track, item.durationSec, item.startSec, item.linkedGroupId, item.mediaKind, item.mediaUrl]),
    [
      ['video', 5, 14, 'timeline-output-c-test', 'video', '/hero/veo3.mp4'],
      ['audio', 5, 14, 'timeline-output-c-test', 'audio', '/hero/veo3.mp4'],
    ],
    'video outputs with sound should create synchronized video and audio timeline clips'
  );

  const importedVideoAsset = {
    id: 'imported-video',
    kind: 'video' as const,
    filename: 'phone-shot.mp4',
    subtitle: 'Video · upload',
    url: '/uploads/phone-shot.mp4',
    thumbUrl: '/uploads/phone-shot.jpg',
    durationSec: 9,
  };
  const importedVideoItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'asset-video-a',
    title: 'Imported Clip',
    asset: importedVideoAsset,
    startSec: 4,
    idSeed: 'asset-test',
  });
  assert.deepEqual(
    importedVideoItems.map((item) => [item.track, item.durationSec, item.startSec, item.linkedGroupId, item.mediaKind, item.mediaUrl]),
    [
      ['video', 9, 4, 'timeline-asset-video-a-asset-test', 'video', '/uploads/phone-shot.mp4'],
      ['audio', 9, 4, 'timeline-asset-video-a-asset-test', 'audio', '/uploads/phone-shot.mp4'],
    ],
    'imported video assets should enter the timeline as synchronized video and linked audio clips'
  );
  const importedVideoDropPayload = projectMediaTimelineDragPayloadForAsset(importedVideoAsset);
  assert.equal(importedVideoDropPayload?.hasTimelineAudio, true, 'project-media video drags should advertise the linked audio peer before drop');
  const importedVideoDropPreview = importedVideoDropPayload
    ? resolveTimelineExternalDropPreview({
        isInsertIntoClipEnabled: true,
        items: [],
        lockedTracks: new Set<WorkspaceTimelineTrack>(),
        payload: importedVideoDropPayload,
        rawStartSec: 4,
        track: 'video',
      })
    : null;
  assert.deepEqual(
    importedVideoDropPreview?.ghostItems.map((item) => [item.trackId, item.mediaKind, item.startSec, item.durationSec, item.title]),
    [
      ['video', 'video', 4, 9, 'phone-shot.mp4'],
      ['audio', 'audio', 4, 9, 'phone-shot.mp4 Audio'],
    ],
    'timeline external drop preview should show both video and linked audio ghosts for imported videos'
  );

  const unlinkedImportedVideoItems = unlinkWorkspaceTimelineSelection(importedVideoItems, ['timeline-asset-video-a-asset-test']);
  assert.deepEqual(
    unlinkedImportedVideoItems.map((item) => [item.id, item.linkedGroupId ?? null, item.linkedGroupKind ?? null]),
    [
      ['timeline-asset-video-a-asset-test', null, null],
      ['timeline-asset-video-a-asset-test-audio', null, null],
    ],
    'unlinking a selected video clip should detach its generated audio peer from the same linked group'
  );
  const unlinkedAudioMove = moveWorkspaceTimelineSelectionWithMode({
    items: unlinkedImportedVideoItems,
    itemIds: ['timeline-asset-video-a-asset-test-audio'],
    anchorItemId: 'timeline-asset-video-a-asset-test-audio',
    nextStartSec: 12,
    mode: 'insert',
    idSeed: 'unlinked-audio-drag',
  });
  assert.deepEqual(
    unlinkedAudioMove.map((item) => [item.id, item.track, item.startSec]),
    [
      ['timeline-asset-video-a-asset-test', 'video', 4],
      ['timeline-asset-video-a-asset-test-audio', 'audio', 12],
    ],
    'after unlink, dragging the audio peer should no longer move the video clip'
  );
  const unlinkedAudioTrackMove = moveWorkspaceTimelineSelectionWithMode({
    items: unlinkedImportedVideoItems,
    itemIds: ['timeline-asset-video-a-asset-test-audio'],
    anchorItemId: 'timeline-asset-video-a-asset-test-audio',
    nextStartSec: 12,
    nextTrack: 'audio-2',
    mode: 'insert',
    idSeed: 'unlinked-audio-track-drag',
  });
  assert.deepEqual(
    unlinkedAudioTrackMove.map((item) => [item.id, item.track, item.startSec]),
    [
      ['timeline-asset-video-a-asset-test', 'video', 4],
      ['timeline-asset-video-a-asset-test-audio', 'audio-2', 12],
    ],
    'after unlink, dragging the audio peer vertically should move it from Audio 1 to Audio 2'
  );

  const relinkedImportedVideoItems = linkWorkspaceTimelineSelection(unlinkedImportedVideoItems, [
    'timeline-asset-video-a-asset-test',
    'timeline-asset-video-a-asset-test-audio',
  ], 'manual-link');
  assert.deepEqual(
    relinkedImportedVideoItems.map((item) => [item.id, item.linkedGroupId ?? null, item.linkedGroupKind ?? null]),
    [
      ['timeline-asset-video-a-asset-test', 'manual-link', 'manual'],
      ['timeline-asset-video-a-asset-test-audio', 'manual-link', 'manual'],
    ],
    'linking selected clips should create one manual linked group for the selection'
  );

  const importedAudioItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'asset-audio-a',
    title: 'Imported Music',
    asset: {
      id: 'imported-audio',
      kind: 'audio',
      filename: 'track.wav',
      subtitle: 'Audio · upload',
      url: '/uploads/track.wav',
      durationSec: 22,
    },
    startSec: 6,
    idSeed: 'audio-test',
  });
  assert.deepEqual(
    importedAudioItems.map((item) => [item.track, item.durationSec, item.startSec, item.linkedGroupId ?? null, item.mediaKind, item.mediaUrl]),
    [
      ['audio', 22, 6, null, 'audio', '/uploads/track.wav'],
    ],
    'imported audio assets should enter the timeline on an audio editing track'
  );

  const importedImageItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'asset-image-a',
    title: 'Imported Still',
    asset: {
      id: 'imported-image',
      kind: 'image',
      filename: 'reference.png',
      subtitle: 'Image · upload',
      url: '/uploads/reference.png',
    },
    startSec: 10,
    idSeed: 'image-test',
  });
  assert.deepEqual(
    importedImageItems.map((item) => [item.track, item.durationSec, item.startSec, item.mediaKind, item.mediaUrl]),
    [
      ['video', 5, 10, 'image', '/uploads/reference.png'],
    ],
    'imported images should enter the timeline as still visual clips'
  );

  const insertEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'insert',
    playheadSec: 6,
    selectedItemId: null,
    idSeed: 'insert',
  });
  assertNoTimelineOverlap(insertEdit, 'insert edit should not leave overlapping clips on any same-type timeline track');
  assert.deepEqual(
    insertEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 8, 0],
      ['timeline-output-c-test', 8, 5, 0],
      ['clip-b', 13, 6, 0],
    ],
    'insert edit should resolve drops in the right half of a clip to the next edit point without shortening the target'
  );
  assert.deepEqual(
    insertEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 8, 0, 'group-a'],
      ['timeline-output-c-test-audio', 8, 5, 0, 'timeline-output-c-test'],
    ],
    'insert edit should preserve the linked audio duration while inserting at the resolved edit point'
  );

  const leftHalfInsertEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'insert',
    playheadSec: 2,
    selectedItemId: null,
    idSeed: 'left-half-insert',
  });
  assert.deepEqual(
    leftHalfInsertEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['timeline-output-c-test', 0, 5, 0],
      ['clip-a', 5, 8, 0],
      ['clip-b', 13, 6, 0],
    ],
    'insert edit should resolve drops in the left half of a clip to the previous edit point and push every later clip'
  );
  assert.deepEqual(
    leftHalfInsertEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['timeline-output-c-test-audio', 0, 5, 0, 'timeline-output-c-test'],
      ['clip-a-audio', 5, 8, 0, 'group-a'],
    ],
    'left-half insert should keep linked audio synchronized after the whole target clip shifts'
  );

  const boundaryInsertEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'insert',
    playheadSec: 8,
    selectedItemId: null,
    idSeed: 'boundary-insert',
  });
  assert.deepEqual(
    boundaryInsertEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 8, 0],
      ['timeline-output-c-test', 8, 5, 0],
      ['clip-b', 13, 6, 0],
    ],
    'insert edit should still insert at an edit point and push later clips'
  );

  const spliceInsertEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'insert',
    playheadSec: 6,
    selectedItemId: null,
    idSeed: 'insert',
    allowInsertIntoClip: true,
  });
  assertNoTimelineOverlap(spliceInsertEdit, 'explicit splice insertion should not leave same-track overlaps after splitting');
  assert.deepEqual(
    spliceInsertEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 6, 0],
      ['timeline-output-c-test', 6, 5, 0],
      ['clip-a-tail-insert', 11, 2, 6],
      ['clip-b', 13, 6, 0],
    ],
    'explicit splice insertion should split the clip under the playhead and push later clips'
  );
  assert.deepEqual(
    spliceInsertEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 6, 0, 'group-a'],
      ['timeline-output-c-test-audio', 6, 5, 0, 'timeline-output-c-test'],
      ['clip-a-audio-tail-insert', 11, 2, 6, 'group-a-tail-insert'],
    ],
    'explicit splice insertion should split linked audio with the source video clip'
  );

  const overwriteEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'overwrite',
    playheadSec: 2,
    selectedItemId: null,
    idSeed: 'overwrite',
  });
  assertNoTimelineOverlap(overwriteEdit, 'overwrite edit should rewrite the target range without same-track overlaps');
  assert.deepEqual(
    overwriteEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 2, 0],
      ['timeline-output-c-test', 2, 5, 0],
      ['clip-a-tail-overwrite', 7, 1, 7],
      ['clip-b', 8, 6, 0],
    ],
    'overwrite edit should trim and split clips under the inserted range instead of allowing track overlap'
  );
  assert.deepEqual(
    overwriteEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 2, 0, 'group-a'],
      ['timeline-output-c-test-audio', 2, 5, 0, 'timeline-output-c-test'],
      ['clip-a-audio-tail-overwrite', 7, 1, 7, 'group-a-tail-overwrite'],
    ],
    'overwrite edit should rewrite linked audio under the same range as its source video clip'
  );

  const replaceEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'replace',
    playheadSec: 0,
    selectedItemId: 'clip-b',
    idSeed: 'replace',
  });
  assert.deepEqual(
    replaceEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 8],
      ['timeline-output-c-test', 8, 5],
    ],
    'replace edit should swap the selected clip slot without moving earlier clips'
  );
  assert.deepEqual(
    replaceEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 8, 'group-a'],
      ['timeline-output-c-test-audio', 8, 5, 'timeline-output-c-test'],
    ],
    'replace edit should add linked audio for the replacement without disturbing earlier linked clips'
  );

  const visualOnlyInsertEdit = insertWorkspaceTimelineItems({
    items,
    newItems: importedImageItems,
    mode: 'insert',
    playheadSec: 6,
    selectedItemId: null,
    idSeed: 'image-insert',
  });
  assert.deepEqual(
    visualOnlyInsertEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId ?? null]),
    [
      ['clip-a', 0, 8, 0, 'group-a'],
      ['timeline-asset-image-a-image-test', 8, 5, 0, null],
      ['clip-b', 13, 6, 0, null],
    ],
    'visual-only insert should snap an occupied drop to the nearest edit point without splitting the source video'
  );
  assert.deepEqual(
    visualOnlyInsertEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 8, 0, 'group-a'],
    ],
    'visual-only insert should preserve the original linked audio segment by default'
  );

  const visualOnlyOverwriteEdit = insertWorkspaceTimelineItems({
    items,
    newItems: importedImageItems,
    mode: 'overwrite',
    playheadSec: 2,
    selectedItemId: null,
    idSeed: 'image-overwrite',
  });
  assert.deepEqual(
    visualOnlyOverwriteEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 2, 0, 'group-a'],
      ['clip-a-audio-tail-image-overwrite', 7, 1, 7, 'group-a-tail-image-overwrite'],
    ],
    'visual-only overwrite should remove the covered linked audio section instead of leaving stale full-length audio'
  );

  const insertedDragMove = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-b'],
    anchorItemId: 'clip-b',
    nextStartSec: 2,
    mode: 'insert',
    idSeed: 'drag-insert',
  });
  assert.deepEqual(
    insertedDragMove.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-b', 0, 6, 0],
      ['clip-a', 6, 8, 0],
    ],
    'insert-mode drag should resolve an occupied left-half drop to before the whole target clip'
  );
  assert.deepEqual(
    insertedDragMove.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 6, 8, 0, 'group-a'],
    ],
    'insert-mode drag should move the target linked audio without splitting it by default'
  );

  const freeRightDragMove = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-a'],
    anchorItemId: 'clip-a',
    nextStartSec: 16,
    mode: 'insert',
    idSeed: 'drag-free-gap',
  });
  assertNoTimelineOverlap(freeRightDragMove, 'dragging into empty time should keep same-track clips non-overlapping');
  assert.deepEqual(
    freeRightDragMove
      .filter((item) => item.track === 'video')
      .map((item) => [item.id, item.startSec, item.durationSec])
      .sort((left, right) => Number(left[1]) - Number(right[1])),
    [
      ['clip-b', 8, 6],
      ['clip-a', 16, 8],
    ],
    'dragging a selected clip right into empty time should leave the original gap instead of rippling earlier clips closed'
  );
  assert.deepEqual(
    freeRightDragMove.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec]),
    [['clip-a-audio', 16, 8]],
    'dragging a linked video right into empty time should move its linked audio with the same gap'
  );

  const ambiguousSelfOverlapDrag = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-a'],
    anchorItemId: 'clip-a',
    nextStartSec: 1,
    mode: 'insert',
    idSeed: 'ambiguous-self-drag',
  });
  assertNoTimelineOverlap(ambiguousSelfOverlapDrag, 'ambiguous self-overlap drag should revert to a no-overlap timeline');
  assert.deepEqual(
    ambiguousSelfOverlapDrag.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 8],
      ['clip-b', 8, 6],
    ],
    'insert-mode drag should revert when the drop remains inside the dragged clip instead of committing an overlap'
  );
  assert.deepEqual(
    ambiguousSelfOverlapDrag.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec]),
    [['clip-a-audio', 0, 8]],
    'ambiguous self-overlap drag should also keep linked audio at the original position'
  );

  const spliceInsertedDragMove = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-b'],
    anchorItemId: 'clip-b',
    nextStartSec: 4,
    mode: 'insert',
    idSeed: 'drag-insert',
    allowInsertIntoClip: true,
  });
  assert.deepEqual(
    spliceInsertedDragMove.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 4, 0],
      ['clip-b', 4, 6, 0],
      ['clip-a-tail-drag-insert', 10, 4, 4],
    ],
    'splice insert drag should split a long target clip when the explicit tool is enabled'
  );
  assert.deepEqual(
    spliceInsertedDragMove.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 4, 0, 'group-a'],
      ['clip-a-audio-tail-drag-insert', 10, 4, 4, 'group-a-tail-drag-insert'],
    ],
    'splice insert drag should split linked audio with the target video clip'
  );

  const multiDragItems: WorkspaceTimelineItem[] = [
    { id: 'long-a', outputNodeId: 'long-a', track: 'video', title: 'Long A', durationSec: 10, startSec: 0, mediaKind: 'video' },
    { id: 'move-b', outputNodeId: 'move-b', track: 'video', title: 'Move B', durationSec: 4, startSec: 10, mediaKind: 'video' },
    { id: 'move-c', outputNodeId: 'move-c', track: 'video', title: 'Move C', durationSec: 4, startSec: 14, mediaKind: 'video' },
    { id: 'tail-d', outputNodeId: 'tail-d', track: 'video', title: 'Tail D', durationSec: 4, startSec: 18, mediaKind: 'video' },
  ];
  const multiInsertedDragMove = moveWorkspaceTimelineSelectionWithMode({
    items: multiDragItems,
    itemIds: ['move-b', 'move-c'],
    anchorItemId: 'move-b',
    nextStartSec: 4,
    mode: 'insert',
    idSeed: 'multi-drag',
  });
  assertNoTimelineOverlap(multiInsertedDragMove, 'insert-mode multi-select drag should push enough space for the moved package');
  assert.deepEqual(
    multiInsertedDragMove.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['move-b', 0, 4],
      ['move-c', 4, 4],
      ['long-a', 8, 10],
      ['tail-d', 18, 4],
    ],
    'insert-mode multi-select drag should insert before the whole target clip when dropped in its left half'
  );

  const overwriteDragMove = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-b'],
    anchorItemId: 'clip-b',
    nextStartSec: 2,
    mode: 'overwrite',
    idSeed: 'drag-overwrite',
  });
  assert.deepEqual(
    overwriteDragMove.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 2, 0],
      ['clip-b', 2, 6, 0],
    ],
    'overwrite-mode drag should rewrite the target range without pushing later clips'
  );

  const movedToV2WithMode = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-a'],
    anchorItemId: 'clip-a',
    nextStartSec: 1,
    nextTrack: 'video-2',
    mode: 'insert',
    idSeed: 'v2-drop',
  });
  assert.deepEqual(
    movedToV2WithMode.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['clip-a', 'video-2', 1, 8],
      ['clip-a-audio', 'audio', 1, 8],
    ],
    'insert-mode vertical drop should place the visual clip on V2 and keep linked audio synchronized'
  );

  const rippleDeleted = deleteWorkspaceTimelineItem(items, 'clip-a', { ripple: true });
  assert.deepEqual(
    rippleDeleted.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec]),
    [['clip-b', 0]],
    'ripple delete should remove linked clips and pull later clips left on the affected track'
  );
});

test('MaxVideoAI editor timeline render manifest captures clips, assets, transitions, and blockers', async () => {
  const {
    buildWorkspaceTimelineRenderManifest,
    serializeWorkspaceTimelineRenderManifest,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render');
  const {
    WORKSPACE_TIMELINE_EXPORT_QUALITY_PRESETS,
    buildWorkspaceTimelineVideoExportRequest,
    buildWorkspaceTimelineEdl,
    serializeWorkspaceTimelineVideoExportRequest,
    workspaceTimelineExportReadinessChecks,
    workspaceTimelineRenderReadinessLabel,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export');
  const template = createProductAdWorkspaceTemplate();
  const items = template.timelineItems.map((item) =>
    item.id === 'timeline-output-01'
      ? { ...item, transitionOut: { type: 'crossfade' as const, durationSec: 1 } }
      : item
  );

  const manifest = buildWorkspaceTimelineRenderManifest({
    items,
    nodes: template.nodes,
    projectName: 'Product Ad',
    sequenceId: 'sequence-main',
    sequenceName: 'Main sequence',
    createdAt: '2026-06-06T10:00:00.000Z',
  });
  const videoTrack = manifest.tracks.find((track) => track.id === 'video');
  const linkedAudioTrack = manifest.tracks.find((track) => track.id === 'audio');
  const musicTrack = manifest.tracks.find((track) => track.id === 'audio-2');

  assert.equal(manifest.status, 'ready', 'ready timelines should produce a renderable manifest');
  assert.equal(manifest.sequenceId, 'sequence-main', 'render manifests should carry the active Studio sequence id');
  assert.equal(manifest.sequenceName, 'Main sequence', 'render manifests should carry the active Studio sequence name');
  assert.equal(manifest.durationSec, 28, 'manifest duration should include audio beds, not only the video track');
  assert.deepEqual(
    videoTrack?.clips.map((clip) => [clip.id, clip.startSec, clip.endSec, clip.sourceStartSec, clip.sourceEndSec]),
    [
      ['timeline-output-01', 0, 5, 0, 5],
      ['timeline-output-02', 5, 13, 0, 8],
    ],
    'video clips should export ordered sequence timing and source in/out timing'
  );
  assert.deepEqual(
    videoTrack?.clips[0]?.transitionOut,
    { type: 'crossfade', durationSec: 1, nextClipId: 'timeline-output-02' },
    'crossfades should export as metadata on the outgoing clip'
  );
  const clampedManifest = buildWorkspaceTimelineRenderManifest({
    items: items.map((item) =>
      item.id === 'timeline-output-01'
        ? { ...item, transitionOut: { type: 'crossfade' as const, durationSec: 10 } }
        : item
    ),
    nodes: template.nodes,
    projectName: 'Product Ad',
    createdAt: '2026-06-06T10:00:00.000Z',
  });
  assert.deepEqual(
    clampedManifest.tracks.find((track) => track.id === 'video')?.clips[0]?.transitionOut,
    { type: 'crossfade', durationSec: 2.5, nextClipId: 'timeline-output-02' },
    'render manifest should clamp stale crossfades to the same safe bounds as the viewer preview'
  );
  assert.equal(
    linkedAudioTrack?.clips[0]?.linkedGroupId,
    'timeline-output-02',
    'embedded generated audio should stay linked to its video clip in the manifest'
  );
  assert.ok(
    musicTrack?.clips[0]?.mediaUrl,
    'asset-library audio timeline items should resolve media from their source asset node'
  );
  assert.match(
    serializeWorkspaceTimelineRenderManifest(manifest),
    /"source": "maxvideoai-editor"/,
    'serialized manifest should remain a plain JSON backend handoff'
  );
  assert.equal(
    workspaceTimelineRenderReadinessLabel(manifest),
    'Render manifest ready: 4 clips, 28s.',
    'export notice should summarize render readiness'
  );
  assert.deepEqual(
    WORKSPACE_TIMELINE_EXPORT_QUALITY_PRESETS.map((preset) => preset.id),
    ['draft', 'standard', 'high'],
    'video export should expose draft, standard, and high quality presets'
  );
  assert.deepEqual(
    workspaceTimelineExportReadinessChecks(manifest).map((check) => [check.id, check.status]),
    [
      ['media', 'pass'],
      ['timeline', 'pass'],
      ['range', 'pass'],
      ['audio', 'pass'],
    ],
    'video export should expose reader-facing preflight checks before rendering'
  );
  const videoExportRequest = buildWorkspaceTimelineVideoExportRequest(manifest, {
    qualityPreset: 'high',
    createdAt: '2026-06-06T10:15:00.000Z',
  });
  assert.deepEqual(
    {
      source: videoExportRequest.source,
      status: videoExportRequest.status,
      format: videoExportRequest.exportSettings.format,
      qualityPreset: videoExportRequest.exportSettings.qualityPreset,
      includeAudio: videoExportRequest.exportSettings.includeAudio,
      serverRenderMode: videoExportRequest.exportSettings.serverRenderMode,
      hasIdempotencyKey: typeof videoExportRequest.idempotencyKey === 'string' && videoExportRequest.idempotencyKey.length > 0,
      rangeMode: videoExportRequest.manifest.exportRange.mode,
      sequenceId: videoExportRequest.manifest.sequenceId,
    },
    {
      source: 'maxvideoai-editor',
      status: 'ready',
      format: 'mp4-h264',
      qualityPreset: 'high',
      includeAudio: true,
      serverRenderMode: 'server',
      hasIdempotencyKey: true,
      rangeMode: 'sequence',
      sequenceId: 'sequence-main',
    },
    'video export request should wrap the manifest with MP4/H.264 settings and selected quality'
  );
  assert.match(
    serializeWorkspaceTimelineVideoExportRequest(videoExportRequest),
    /"qualityPreset": "high"/,
    'serialized video export request should carry quality preset for the backend renderer'
  );

  const rangeManifest = buildWorkspaceTimelineRenderManifest({
    items,
    nodes: template.nodes,
    projectName: 'Product Ad',
    createdAt: '2026-06-06T10:00:00.000Z',
    exportRange: {
      mode: 'in-out',
      startSec: 4,
      endSec: 10,
    },
  });
  assert.deepEqual(
    rangeManifest.exportRange,
    {
      mode: 'in-out',
      startSec: 4,
      endSec: 10,
      durationSec: 6,
    },
    'render manifest should describe whether the export is the full sequence or an in/out range'
  );
  assert.equal(rangeManifest.durationSec, 6, 'in/out render duration should match the selected range');
  assert.deepEqual(
    rangeManifest.tracks.find((track) => track.id === 'video')?.clips.map((clip) => [
      clip.id,
      clip.startSec,
      clip.endSec,
      clip.sourceStartSec,
      clip.sourceEndSec,
    ]),
    [
      ['timeline-output-01', 0, 1, 4, 5],
      ['timeline-output-02', 1, 6, 0, 5],
    ],
    'in/out export should trim overlapping clips and retime them from the range start'
  );
  assert.match(
    buildWorkspaceTimelineEdl(rangeManifest),
    /TITLE: Product Ad[\s\S]*FCM: NON-DROP FRAME[\s\S]*001\s+TIMELINE\s+V\s+C\s+00:00:04:00\s+00:00:05:00\s+00:00:00:00\s+00:00:01:00/,
    'EDL export should serialize the same in/out edit decisions for NLE handoff'
  );

  const overlayManifest = buildWorkspaceTimelineRenderManifest({
    items: [
      ...items,
      {
        ...items.find((item) => item.id === 'timeline-output-01')!,
        id: 'timeline-overlay-v2',
        track: 'video-2',
        title: 'Overlay V2',
        startSec: 2,
        durationSec: 3,
      },
    ],
    nodes: template.nodes,
    projectName: 'Product Ad Overlay',
    createdAt: '2026-06-06T10:00:00.000Z',
  });
  assert.ok(
    overlayManifest.tracks.some((track) => track.id === 'video-2' && track.clips.some((clip) => clip.id === 'timeline-overlay-v2')),
    'render manifest should include added video tracks instead of dropping overlay clips'
  );

  const blockedManifest = buildWorkspaceTimelineRenderManifest({
    items: [
      {
        id: 'blocked-clip',
        outputNodeId: 'missing-output',
        track: 'video',
        title: 'Missing Clip',
        durationSec: 4,
        startSec: 0,
      },
    ],
    nodes: template.nodes,
    projectName: 'Blocked',
    createdAt: '2026-06-06T10:00:00.000Z',
  });
  assert.equal(blockedManifest.status, 'blocked', 'missing media should block final render');
  assert.deepEqual(
    blockedManifest.issues.map((issue) => [issue.code, issue.severity, issue.itemId]),
    [['missing_media', 'blocking', 'blocked-clip']],
    'blocked manifests should explain which clip cannot render'
  );
});

test('MaxVideoAI editor library assets map to media node records', async () => {
  assert.ok(existsSync(libraryAssetsPath), 'workspace library asset helper should exist before mapping node media');
  const {
    WORKSPACE_LIBRARY_ASSETS,
    WORKSPACE_LIBRARY_SOURCE_OPTIONS,
    buildWorkspaceUserLibraryUrl,
    normalizeWorkspaceUserLibraryPage,
    normalizeWorkspaceUserLibraryPayload,
    workspaceLibrarySourceOptionsForKind,
    workspaceAssetRecordFromLibraryAsset,
    workspaceLibraryAssetFromUploadedAsset,
    workspaceLibraryAssetsForNodeKind,
    workspaceLibraryKindForNodeKind,
    workspaceUploadAcceptForNodeKind,
    workspaceUploadEndpointForNodeKind,
  } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-library-assets'
  );

  assert.ok(WORKSPACE_LIBRARY_ASSETS.some((asset) => asset.kind === 'image'), 'library should expose reusable image assets');
  assert.ok(WORKSPACE_LIBRARY_ASSETS.some((asset) => asset.kind === 'video'), 'library should expose reusable video assets');
  assert.ok(WORKSPACE_LIBRARY_ASSETS.some((asset) => asset.kind === 'audio'), 'library should expose reusable audio assets');
  const videoAsset = WORKSPACE_LIBRARY_ASSETS.find((asset) => asset.kind === 'video');
  const audioAsset = WORKSPACE_LIBRARY_ASSETS.find((asset) => asset.kind === 'audio');
  assert.match(String(videoAsset?.url ?? ''), /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i, 'studio library video assets should map to playable video URLs');
  assert.match(String(audioAsset?.url ?? ''), /^(?:data:audio\/|blob:|.*\.(?:mp3|wav|ogg|m4a|aac)(?:[?#].*)?$)/i, 'studio library audio assets should map to playable audio URLs');
  assert.deepEqual(
    WORKSPACE_LIBRARY_SOURCE_OPTIONS.slice(0, 3),
    ['all', 'recent', 'upload'],
    'studio library should start from the same source filter structure as the app library'
  );
  assert.deepEqual(
    workspaceLibrarySourceOptionsForKind('video').slice(0, 3),
    ['all', 'recent', 'upload'],
    'video blocks should offer recent app outputs before narrower saved-asset filters'
  );

  const imageAssets = workspaceLibraryAssetsForNodeKind('asset-image');
  assert.ok(imageAssets.length > 0, 'image blocks should receive image library candidates');
  assert.equal(imageAssets.every((asset) => asset.kind === 'image'), true, 'image block library should only include images');

  const mapped = workspaceAssetRecordFromLibraryAsset(imageAssets[0]);
  assert.equal(mapped.kind, 'image');
  assert.equal(mapped.filename, imageAssets[0].name);
  assert.equal(mapped.subtitle, imageAssets[0].meta);
  assert.equal(mapped.thumbUrl, imageAssets[0].thumbUrl);

  assert.equal(workspaceLibraryKindForNodeKind('asset-image'), 'image');
  assert.equal(workspaceLibraryKindForNodeKind('asset-video'), 'video');
  assert.equal(workspaceLibraryKindForNodeKind('asset-audio'), 'audio');
  assert.equal(workspaceUploadEndpointForNodeKind('asset-image'), '/api/uploads/image');
  assert.equal(workspaceUploadEndpointForNodeKind('asset-video'), '/api/uploads/video');
  assert.equal(workspaceUploadEndpointForNodeKind('asset-audio'), '/api/uploads/audio');
  assert.equal(workspaceUploadEndpointForNodeKind('text-prompt'), null);
  assert.equal(workspaceUploadAcceptForNodeKind('asset-image'), 'image/*');
  assert.equal(workspaceUploadAcceptForNodeKind('asset-video'), 'video/*');
  assert.equal(workspaceUploadAcceptForNodeKind('asset-audio'), 'audio/*');
  assert.equal(workspaceUploadAcceptForNodeKind('text-prompt'), undefined);
  assert.equal(buildWorkspaceUserLibraryUrl('video'), '/api/media-library/assets?limit=60&kind=video');
  assert.equal(
    buildWorkspaceUserLibraryUrl('video', 'recent'),
    '/api/media-library/recent-outputs?limit=60&kind=video'
  );
  assert.equal(
    buildWorkspaceUserLibraryUrl('image', 'generated'),
    '/api/media-library/assets?limit=60&kind=image&source=generated'
  );
  assert.equal(
    buildWorkspaceUserLibraryUrl('image', 'generated', { cursor: 'cursor_2' }),
    '/api/media-library/assets?limit=60&kind=image&cursor=cursor_2&source=generated'
  );
  assert.equal(
    buildWorkspaceUserLibraryUrl('video', 'all', { includeOutputs: true }),
    '/api/media-library/assets?limit=60&kind=video&includeOutputs=true'
  );
  assert.equal(
    buildWorkspaceUserLibraryUrl('video', 'generated', { includeOutputs: true }),
    '/api/media-library/assets?limit=60&kind=video&source=generated&includeOutputs=true'
  );
  assert.equal(buildWorkspaceUserLibraryUrl(null, 'all', { limit: 48 }), '/api/media-library/assets?limit=48');
  assert.equal(buildWorkspaceUserLibraryUrl(null), '/api/media-library/assets?limit=60');

  const workspaceLibraryAssetsSource = source(libraryAssetsPath);
  assert.match(workspaceLibraryAssetsSource, /export function normalizeWorkspaceUserLibraryPage/);
  assert.match(workspaceLibraryAssetsSource, /nextCursor:\s*typeof record\.nextCursor === 'string'/);
  assert.match(workspaceLibraryAssetsSource, /hasMore:\s*record\.hasMore === true/);

  const normalizedPage = normalizeWorkspaceUserLibraryPage(
    {
      ok: true,
      nextCursor: 'cursor_2',
      hasMore: true,
      assets: [
        {
          id: 'page-image-1',
          url: 'https://cdn.example.com/page-image.png',
          kind: 'image',
          mime: 'image/png',
        },
      ],
    },
    null
  );
  assert.deepEqual(
    {
      ids: normalizedPage.assets.map((asset) => asset.id),
      nextCursor: normalizedPage.nextCursor,
      hasMore: normalizedPage.hasMore,
    },
    { ids: ['page-image-1'], nextCursor: 'cursor_2', hasMore: true },
    'studio library should preserve app media-library pagination metadata'
  );

  const normalized = normalizeWorkspaceUserLibraryPayload(
    {
      ok: true,
      assets: [
        {
          id: 'user-image-1',
          url: 'https://cdn.example.com/image-one.png',
          thumbUrl: 'https://cdn.example.com/image-one-thumb.png',
          kind: 'image',
          mime: 'image/png',
          width: 1200,
          height: 800,
          source: 'upload',
        },
        {
          id: 'user-video-1',
          url: 'https://cdn.example.com/video-one.mp4',
          thumbUrl: 'https://cdn.example.com/video-one.jpg',
          kind: 'image',
          source: 'generated',
        },
      ],
    },
    'image'
  );
  assert.deepEqual(
    normalized.map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, meta: asset.meta })),
    [{ id: 'user-image-1', name: 'image-one.png', kind: 'image', meta: 'Image · 1200x800' }],
    'studio library should normalize and filter signed-in user assets from the app media-library API'
  );

  const projectMediaAssets = normalizeWorkspaceUserLibraryPayload(
    {
      ok: true,
      assets: [
        {
          id: 'legacy-video-without-mime',
          url: 'https://cdn.example.com/legacy-video.mp4?token=abc',
          thumbUrl: 'https://cdn.example.com/legacy-video.jpg',
          kind: 'image',
          duration: 12,
          source: 'upload',
        },
        {
          id: 'typed-video-with-alt-shape',
          url: 'https://cdn.example.com/typed-video',
          previewUrl: 'https://cdn.example.com/typed-video-preview.jpg',
          mediaType: 'asset-video',
          mimeType: 'video/mp4',
          durationSec: 8,
          source: 'upload',
        },
      ],
    },
    null
  );
  assert.deepEqual(
    projectMediaAssets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      durationSec: asset.durationSec,
      meta: asset.meta,
    })),
    [
      {
        id: 'legacy-video-without-mime',
        name: 'legacy-video.mp4',
        kind: 'video',
        durationSec: 12,
        meta: 'Video · upload',
      },
      {
        id: 'typed-video-with-alt-shape',
        name: 'typed-video',
        kind: 'video',
        durationSec: 8,
        meta: 'Video · upload',
      },
    ],
    'project media import should keep videos visible when API rows use legacy URLs or alternate MIME fields'
  );

  const recentVideoAssets = normalizeWorkspaceUserLibraryPayload(
    {
      ok: true,
      outputs: [
        {
          id: 'recent-output-video-1',
          url: 'https://cdn.example.com/recent-output.mp4',
          thumbUrl: 'https://cdn.example.com/recent-output.jpg',
          kind: 'video',
          mime: 'video/mp4',
          durationSec: 5,
        },
      ],
    },
    'video'
  );
  assert.deepEqual(
    recentVideoAssets.map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, durationSec: asset.durationSec })),
    [{ id: 'recent-output-video-1', name: 'recent-output.mp4', kind: 'video', durationSec: 5 }],
    'studio library should normalize recent app outputs for media node selection'
  );

  const uploaded = workspaceLibraryAssetFromUploadedAsset(
    {
      id: 'uploaded-audio-1',
      url: 'https://cdn.example.com/voice-over.wav',
      kind: 'audio',
      mime: 'audio/wav',
      source: 'upload',
    },
    'audio'
  );
  assert.deepEqual(
    uploaded && { id: uploaded.id, name: uploaded.name, kind: uploaded.kind, meta: uploaded.meta, url: uploaded.url },
    {
      id: 'uploaded-audio-1',
      name: 'voice-over.wav',
      kind: 'audio',
      meta: 'Audio · upload',
      url: 'https://cdn.example.com/voice-over.wav',
    },
    'studio library should normalize uploaded app assets before assigning them to media blocks'
  );
});

test('MaxVideoAI editor asset library modal keeps the asset grid scrollable', () => {
  const assetLibraryStyleSource = source(assetLibraryStylesPath);
  assert.match(
    assetLibraryStyleSource,
    /\.assetLibraryModal\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\)/,
    'asset library modal should constrain its browser child to the available modal height'
  );
  assert.match(
    assetLibraryStyleSource,
    /\.assetBrowserModal\s*\{[\s\S]*height:\s*100%/,
    'asset library browser should fill the constrained modal row'
  );
  assert.match(
    assetLibraryStyleSource,
    /\.assetBrowserModal\s+\.assetBrowserGrid\s*\{[\s\S]*overflow-y:\s*auto/,
    'asset library modal grid should be the vertical scroll container'
  );
});

test('studio editor asset library hook owns pagination and project media kind filters', () => {
  const editorAssetLibraryHookSource = source(editorAssetLibraryHookPath);

  assert.match(editorAssetLibraryHookSource, /type WorkspaceLibraryKindFilter = 'all' \| WorkspaceLibraryKind/);
  assert.match(editorAssetLibraryHookSource, /loadMore/);
  assert.match(editorAssetLibraryHookSource, /isLoadingMore/);
  assert.match(editorAssetLibraryHookSource, /hasMore/);
  assert.match(editorAssetLibraryHookSource, /nextCursor/);
  assert.match(editorAssetLibraryHookSource, /setKindFilter/);
  assert.match(editorAssetLibraryHookSource, /WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE_VERSION/);
  assert.match(editorAssetLibraryHookSource, /return `\$\{WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE_VERSION\}:\$\{kind \?\? 'all'\}:\$\{source\}`/);
  assert.match(editorAssetLibraryHookSource, /buildWorkspaceUserLibraryUrl\(effectiveLibraryKind, activeSource,\s*\{/);
  assert.match(editorAssetLibraryHookSource, /includeOutputs:\s*true/);
  assert.match(editorAssetLibraryHookSource, /workspaceLibrarySourceOptionsForKind\(effectiveLibraryKind\)/);
  assert.match(editorAssetLibraryHookSource, /normalizeWorkspaceUserLibraryPage/);
});

test('studio asset library browser renders optional media kind filters and load more control', () => {
  const assetLibraryBrowserSource = source(assetLibraryBrowserPath);
  const projectMediaModalSource = source(join(workspaceDir, '_components/WorkspaceProjectMediaLibraryModal.tsx'));

  assert.match(assetLibraryBrowserSource, /mediaKindFilter\?:/);
  assert.match(assetLibraryBrowserSource, /copy\.mediaKindFilters/);
  assert.match(assetLibraryBrowserSource, /copy\.loadMore/);
  assert.match(assetLibraryBrowserSource, /copy\.loadingMore/);
  assert.match(projectMediaModalSource, /onMediaKindFilterChange=\{onMediaKindFilterChange\}/);
});
