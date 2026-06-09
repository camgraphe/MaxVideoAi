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
import type {
  WorkspaceModelCapability,
  WorkspaceShotSettings,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import type { EngineCaps } from '../frontend/types/engines';

const root = process.cwd();
const studioArchitectureGuidePath = join(root, 'docs/engineering/studio-editor-architecture.md');
const studioDir = join(root, 'frontend/app/(core)/(workspace)/app/studio');
const studioAgentsPath = join(studioDir, 'AGENTS.md');
const studioApiDir = join(root, 'frontend/app/api/studio');
const studioServerDir = join(root, 'frontend/src/server/studio');
const workspaceDir = join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace');
const pagePath = join(workspaceDir, 'page.tsx');
const projectsPagePath = join(studioDir, 'projects/page.tsx');
const projectsClientPath = join(studioDir, 'projects/StudioProjectsPage.client.tsx');
const dynamicWorkspacePagePath = join(workspaceDir, '[projectId]/page.tsx');
const workspacePagePath = join(workspaceDir, 'WorkspacePage.client.tsx');
const studioProjectsApiPath = join(studioApiDir, 'projects/route.ts');
const studioProjectApiPath = join(studioApiDir, 'projects/[projectId]/route.ts');
const studioCanvasTemplatesApiPath = join(studioApiDir, 'canvas-templates/route.ts');
const studioCanvasTemplateApiPath = join(studioApiDir, 'canvas-templates/[templateId]/route.ts');
const studioRouteUtilsPath = join(studioApiDir, '_lib/studio-route-utils.ts');
const studioServerContractsPath = join(studioServerDir, 'contracts.ts');
const studioServerSchemaPath = join(studioServerDir, 'schema.ts');
const studioServerRepositoryPath = join(studioServerDir, 'repository.ts');
const studioMigrationPath = join(root, 'neon/migrations/26_studio_projects.sql');
const canvasPath = join(workspaceDir, '_components/WorkspaceCanvas.client.tsx');
const canvasMapPath = join(workspaceDir, '_components/canvas/CanvasMap.tsx');
const canvasHandleDropPreviewPath = join(workspaceDir, '_components/canvas/CanvasHandleDropPreview.tsx');
const canvasPaletteDragPreviewPath = join(workspaceDir, '_components/canvas/CanvasPaletteDragPreview.tsx');
const canvasControllerPath = join(workspaceDir, '_controllers/useCanvasController.ts');
const projectMediaControllerPath = join(workspaceDir, '_controllers/useProjectMediaController.ts');
const assetLibraryModalPath = join(workspaceDir, '_components/WorkspaceAssetLibraryModal.tsx');
const projectMediaLibraryModalPath = join(workspaceDir, '_components/WorkspaceProjectMediaLibraryModal.tsx');
const assetLibraryBrowserPath = join(workspaceDir, '_components/WorkspaceAssetLibraryBrowser.tsx');
const libraryPath = join(workspaceDir, '_components/NodeLibrarySidebar.tsx');
const timelineProjectSidebarPath = join(workspaceDir, '_components/TimelineProjectSidebar.tsx');
const studioHeaderSessionPath = join(workspaceDir, '_components/StudioHeaderSession.tsx');
const settingsPath = join(workspaceDir, '_components/NodeSettingsPanel.tsx');
const timelineClipInspectorPath = join(workspaceDir, '_components/TimelineClipInspector.tsx');
const timelinePath = join(workspaceDir, '_components/WorkspaceTimeline.tsx');
const timelineClipPath = join(workspaceDir, '_components/timeline/TimelineClip.tsx');
const timelineContextMenusPath = join(workspaceDir, '_components/timeline/TimelineContextMenus.tsx');
const timelineRulerPath = join(workspaceDir, '_components/timeline/TimelineRuler.tsx');
const timelineTrackListPath = join(workspaceDir, '_components/timeline/TimelineTrackList.tsx');
const timelineTrackRowPath = join(workspaceDir, '_components/timeline/TimelineTrackRow.tsx');
const timelineToolbarPath = join(workspaceDir, '_components/timeline/TimelineToolbar.tsx');
const videoViewerPath = join(workspaceDir, '_components/WorkspaceVideoViewer.tsx');
const programMonitorPath = join(workspaceDir, '_components/viewer/ProgramMonitor.tsx');
const programPlaybackLayersPath = join(workspaceDir, '_components/viewer/ProgramPlaybackLayers.tsx');
const programControlsPath = join(workspaceDir, '_components/viewer/ProgramControls.tsx');
const programPlaybackSyncPath = join(workspaceDir, '_components/viewer/useProgramPlaybackSync.ts');
const nodeTypesPath = join(workspaceDir, '_components/nodes/workspace-node-types.tsx');
const edgeTypesPath = join(workspaceDir, '_components/edges/workspace-smart-edge.tsx');
const typesPath = join(workspaceDir, '_lib/workspace-types.ts');
const capabilitiesPath = join(workspaceDir, '_lib/workspace-capabilities.ts');
const modelCapabilityRegistryPath = join(workspaceDir, '_lib/models/model-capability-registry.ts');
const modelEngineFieldsPath = join(workspaceDir, '_lib/models/model-engine-fields.ts');
const modelInputConnectorsPath = join(workspaceDir, '_lib/models/model-input-connectors.ts');
const modelPricingAdapterPath = join(workspaceDir, '_lib/models/model-pricing-adapter.ts');
const generationPath = join(workspaceDir, '_lib/workspace-generation.ts');
const pricingPath = join(workspaceDir, '_lib/workspace-pricing.ts');
const handleDropPath = join(workspaceDir, '_lib/workspace-handle-drop.ts');
const projectSettingsPath = join(workspaceDir, '_lib/workspace-project-settings.ts');
const timecodePath = join(workspaceDir, '_lib/workspace-timecode.ts');
const timelineEditingPath = join(workspaceDir, '_lib/workspace-timeline-editing.ts');
const timelineRenderPath = join(workspaceDir, '_lib/workspace-timeline-render.ts');
const timelineTracksPath = join(workspaceDir, '_lib/workspace-timeline-tracks.ts');
const timelineFramesPath = join(workspaceDir, '_lib/timeline/timeline-frames.ts');
const timelineCollisionsPath = join(workspaceDir, '_lib/timeline/timeline-collisions.ts');
const timelineInsertPath = join(workspaceDir, '_lib/timeline/timeline-insert.ts');
const timelineTrimPath = join(workspaceDir, '_lib/timeline/timeline-trim.ts');
const timelineLinkedAudioPath = join(workspaceDir, '_lib/timeline/timeline-linked-audio.ts');
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
const workspacePersistencePath = join(workspaceDir, '_state/workspace-persistence.ts');
const workspaceNormalizersPath = join(workspaceDir, '_state/workspace-normalizers.ts');
const editorAssetLibraryHookPath = join(workspaceDir, '_hooks/useWorkspaceEditorAssetLibrary.ts');
const pricingHookPath = join(workspaceDir, '_hooks/useWorkspaceShotPricing.ts');
const stylesPath = join(workspaceDir, 'maxvideoai-editor.module.css');
const mediaStylesPath = join(workspaceDir, '_styles/media.module.css');
const visitorAccessPath = join(root, 'frontend/lib/visitor-access.ts');

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

test('MaxVideoAI editor workspace is an isolated authenticated app route', () => {
  assert.ok(existsSync(pagePath), 'editor workspace route should live under the authenticated /app studio workspace');
  assert.ok(existsSync(studioArchitectureGuidePath), 'studio editor should have an engineering architecture guide for additive changes');
  assert.ok(existsSync(studioAgentsPath), 'studio editor should provide a route-local AGENTS guide for additive feature work');
  assert.ok(existsSync(projectsPagePath), 'studio should expose an upstream projects page before the workspace editor');
  assert.ok(existsSync(projectsClientPath), 'studio projects should keep project creation in a route-local client component');
  assert.ok(existsSync(dynamicWorkspacePagePath), 'studio should expose /app/studio/workspace/:projectId for project-scoped workspaces');
  assert.ok(existsSync(workspacePagePath), 'editor workspace client orchestrator should be route-local');
  assert.ok(existsSync(studioProjectsApiPath), 'studio projects should expose an authenticated projects API');
  assert.ok(existsSync(studioProjectApiPath), 'studio project workspaces should expose an authenticated project detail API');
  assert.ok(existsSync(studioCanvasTemplatesApiPath), 'studio should expose authenticated canvas template APIs');
  assert.ok(existsSync(studioCanvasTemplateApiPath), 'studio should expose authenticated canvas template mutation APIs');
  assert.ok(existsSync(studioRouteUtilsPath), 'studio route handlers should share auth/database response utilities');
  assert.ok(existsSync(studioServerContractsPath), 'studio server persistence contracts should live under frontend/src/server/studio');
  assert.ok(existsSync(studioServerSchemaPath), 'studio server schema helper should live under frontend/src/server/studio');
  assert.ok(existsSync(studioServerRepositoryPath), 'studio server repository should live under frontend/src/server/studio');
  assert.ok(existsSync(studioMigrationPath), 'studio persistence should have a Neon migration');
  assert.ok(existsSync(canvasPath), 'canvas surface should live in a route-local component');
  assert.ok(existsSync(canvasMapPath), 'canvas map should live in a focused route-local canvas component');
  assert.ok(existsSync(canvasHandleDropPreviewPath), 'canvas handle drag preview should live in a focused route-local canvas component');
  assert.ok(existsSync(canvasPaletteDragPreviewPath), 'canvas palette drag preview should live in a focused route-local canvas component');
  assert.ok(existsSync(canvasControllerPath), 'canvas drop and paste controller should live in a focused route-local controller');
  assert.ok(existsSync(projectMediaControllerPath), 'project media selection, context menu, and drag payload logic should live in a focused route-local controller');
  assert.ok(existsSync(assetLibraryModalPath), 'asset picker modal should live in a route-local editor component');
  assert.ok(existsSync(assetLibraryBrowserPath), 'asset picker browser should mirror the app library structure in route-local editor CSS');
  assert.ok(existsSync(libraryPath), 'block template sidebar should live in a route-local component');
  assert.ok(existsSync(timelineProjectSidebarPath), 'viewer project media sidebar should live in a route-local component');
  assert.ok(existsSync(studioHeaderSessionPath), 'studio account and wallet status should live in a route-local component');
  assert.ok(existsSync(settingsPath), 'node settings panel should live in a route-local component');
  assert.ok(existsSync(timelineClipInspectorPath), 'timeline clip inspector should live in a route-local component');
  assert.ok(existsSync(timelinePath), 'timeline should live in a route-local component');
  assert.ok(existsSync(timelineClipPath), 'timeline clips should live in a focused route-local timeline component');
  assert.ok(existsSync(timelineContextMenusPath), 'timeline context menus should live in a focused route-local timeline component');
  assert.ok(existsSync(timelineRulerPath), 'timeline ruler should live in a focused route-local timeline component');
  assert.ok(existsSync(timelineTrackListPath), 'timeline track list should live in a focused route-local timeline component');
  assert.ok(existsSync(timelineTrackRowPath), 'timeline track rows should live in a focused route-local timeline component');
  assert.ok(existsSync(timelineToolbarPath), 'timeline toolbar should live in a focused route-local timeline component');
  assert.ok(existsSync(videoViewerPath), 'video montage viewer should live in a route-local component');
  assert.ok(existsSync(programMonitorPath), 'program monitor frame and zoom should live in a route-local viewer component');
  assert.ok(existsSync(programPlaybackLayersPath), 'program media layers should live in a route-local viewer component');
  assert.ok(existsSync(programControlsPath), 'program playback controls should live in a route-local viewer component');
  assert.ok(existsSync(programPlaybackSyncPath), 'program playback synchronization should live in a route-local viewer hook');
  assert.ok(existsSync(nodeTypesPath), 'custom node renderers should live in a route-local node module');
  assert.ok(existsSync(edgeTypesPath), 'custom edge renderers should live in a route-local edge module');
  assert.ok(existsSync(stylesPath), 'editor styling should be isolated in a route-local CSS module');
  assert.ok(existsSync(mediaStylesPath), 'project media styles should live in a focused route-local CSS module');

  const pageSource = source(pagePath);
  const studioArchitectureGuideSource = source(studioArchitectureGuidePath);
  const studioAgentsSource = source(studioAgentsPath);
  const projectsPageSource = source(projectsPagePath);
  const projectsClientSource = source(projectsClientPath);
  const dynamicWorkspacePageSource = source(dynamicWorkspacePagePath);
  const workspaceSource = source(workspacePagePath);
  const workspaceStateSource = source(workspaceStatePath);
  const projectMediaControllerSource = source(projectMediaControllerPath);
  const studioHeaderSessionSource = source(studioHeaderSessionPath);
  const styleSource = source(stylesPath);
  assert.match(studioAgentsSource, /docs\/engineering\/studio-editor-architecture\.md/, 'studio AGENTS guide should point agents to the Studio architecture guide');
  assert.match(studioArchitectureGuideSource, /Product Entities/, 'studio architecture guide should define product entities');
  assert.match(studioArchitectureGuideSource, /Add A Canvas Block/, 'studio architecture guide should explain additive block work');
  assert.match(studioArchitectureGuideSource, /Add A Generation Model/, 'studio architecture guide should explain additive model capability work');
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
  assert.match(projectsClientSource, /STUDIO_PROJECTS_STORAGE_KEY/, 'projects client should keep a local draft fallback');
  assert.match(projectsClientSource, /\/api\/studio\/projects/, 'projects client should sync projects with the Studio API when available');
  assert.match(projectsClientSource, /authFetch/, 'projects client should use authenticated fetches for project sync');
  assert.match(projectsClientSource, /router\.push\(`\/app\/studio\/workspace\/\$\{savedProject\?\.id \?\? project\.id\}`\)/, 'new projects should open a project-scoped workspace URL after API sync or local fallback');
  assert.match(projectsClientSource, /WORKSPACE_TEMPLATE_SUMMARIES/, 'project creation should offer canvas templates as startup graph choices');
  assert.match(dynamicWorkspacePageSource, /WorkspacePage projectId=\{projectId\}/, 'dynamic workspace route should pass the project id into the editor client');
  assert.doesNotMatch(pageSource, /AppClient/, 'editor route must not reuse the existing video workspace AppClient');
  assert.match(workspaceSource, /WorkspaceCanvas/, 'orchestrator should compose the canvas surface');
  assert.match(workspaceSource, /WorkspaceVideoViewer/, 'orchestrator should compose a central montage video viewer');
  assert.match(workspaceSource, /NodeLibrarySidebar/, 'orchestrator should compose the block template library');
  assert.match(workspaceSource, /TimelineProjectSidebar/, 'orchestrator should compose a project media sidebar for Viewer mode');
  assert.match(workspaceSource, /StudioHeaderSession/, 'orchestrator should compose Studio session and wallet status in the header');
  assert.match(studioHeaderSessionSource, /useHeaderAccountState/, 'Studio header session should reuse the shared account and wallet state hook');
  assert.match(studioHeaderSessionSource, /walletPromptOpen/, 'Studio wallet status should open a top-up prompt inside the editor header');
  assert.match(studioHeaderSessionSource, /workspace\.header\.walletTopUp\.cta/, 'Studio wallet prompt should reuse the main app top-up copy contract');
  assert.match(studioHeaderSessionSource, /href="\/billing"/, 'Studio wallet prompt CTA should link to billing top-up');
  assert.match(studioHeaderSessionSource, /NAV_ITEMS\.map/, 'Studio session pill should expose the same account navigation menu as the main app');
  assert.match(studioHeaderSessionSource, /handleSignOut/, 'Studio session menu should keep the shared sign-out action inside the account menu');
  assert.match(studioHeaderSessionSource, /aria-label="Exit to projects"/, 'Studio header exit control should return to project selection instead of signing out');
  assert.doesNotMatch(studioHeaderSessionSource, /aria-label="Sign out of Studio"/, 'Studio header should not expose a direct sign-out button beside the session pill');
  assert.doesNotMatch(workspaceSource, /aria-label="Share project"/, 'Studio header should not expose inactive share controls');
  assert.doesNotMatch(workspaceSource, /aria-label="Generate selected shot"/, 'Studio header should not expose an inactive global generation control');
  assert.match(workspaceSource, /handleExitToProjects/, 'workspace should own the save-and-return-to-projects action');
  assert.match(workspaceSource, /window\.location\.assign\('\/app\/studio\/projects'\)/, 'workspace exit should navigate to the Studio projects page');
  assert.match(workspaceSource, /focusMode === 'canvas'[\s\S]*NodeLibrarySidebar[\s\S]*TimelineProjectSidebar/, 'left sidebar should switch from canvas templates to project media in Viewer mode');
  assert.match(workspaceSource, /workspaceStorageKeyForProject/, 'workspace persistence should be scoped by project id when present');
  assert.match(workspaceSource, /readStudioProject\(projectId\)/, 'workspace should hydrate new project settings from the local project fallback');
  assert.match(workspaceSource, /readStudioProjectFromApi\(projectId/, 'workspace should hydrate project state from the Studio API when available');
  assert.match(workspaceSource, /saveStudioProjectToApi/, 'workspace should autosave project state to the Studio API when available');
  assert.match(workspaceSource, /readUserCanvasTemplatesFromApi/, 'workspace should hydrate user canvas templates from the Studio API when available');
  assert.match(workspaceSource, /saveUserCanvasTemplateToApi/, 'workspace should save user canvas templates to the Studio API when available');
  assert.match(workspaceSource, /from '\.\/_state\/workspace-state'/, 'workspace should import persisted state contracts from the route-local state module');
  assert.match(workspaceSource, /from '\.\/_state\/workspace-selectors'/, 'workspace should import derived sequence selectors from the route-local state module');
  assert.match(workspaceStateSource, /function createWorkspaceSequenceRecord/, 'workspace state module should own sequence record creation');
  assert.match(workspaceStateSource, /function normalizeWorkspaceSequenceRecord/, 'workspace state module should own sequence persistence normalization');
  assert.match(workspaceStateSource, /function upsertWorkspaceSequence/, 'workspace state module should own sequence list updates');
  assert.match(workspaceStateSource, /function deleteWorkspaceTimelineTrackItems/, 'workspace state module should own timeline track deletion retargeting');
  assert.match(workspaceSource, /activeSequenceId/, 'workspace should track the active montage sequence');
  assert.match(workspaceSource, /sequences: upsertWorkspaceSequence/, 'workspace autosave should include every project sequence');
  assert.match(workspaceSource, /handleCreateSequence/, 'viewer project sidebar should create real empty sequences');
  assert.match(workspaceSource, /handleSelectSequence/, 'viewer project sidebar should switch between stored sequences');
  assert.match(workspaceSource, /emptyTimelineItems: WorkspaceTimelineItem\[\] = \[\]/, 'new project canvas templates should start with a clean sequence instead of template demo timeline clips');
  const applyCanvasTemplateHandler = workspaceSource.match(/const handleApplyCanvasTemplate = useCallback\([\s\S]*?\n  \}, \[\]\);\n/);
  assert.ok(applyCanvasTemplateHandler, 'workspace should define a canvas-only template application handler');
  assert.match(applyCanvasTemplateHandler[0], /setNodes\(template\.nodes\)[\s\S]*setEdges\(template\.edges\)/, 'applying a canvas template should update the graph');
  assert.doesNotMatch(applyCanvasTemplateHandler[0], /setTimelineItems/, 'applying a canvas template should not reset or replace the montage timeline');
  assert.doesNotMatch(applyCanvasTemplateHandler[0], /setSequences/, 'applying a canvas template should not replace project sequences');
  assert.doesNotMatch(applyCanvasTemplateHandler[0], /timelineItems/, 'applying a canvas template should not copy template demo timeline items into the active sequence');
  assert.doesNotMatch(workspaceSource, /Reset template/, 'workspace should not expose a global reset template button that can erase project context');
  assert.match(workspaceSource, /NodeSettingsPanel/, 'orchestrator should compose the settings inspector');
  assert.match(workspaceSource, /TimelineClipInspector/, 'orchestrator should compose a timeline clip inspector for Viewer mode');
  assert.match(workspaceSource, /focusMode === 'canvas'[\s\S]*NodeSettingsPanel[\s\S]*TimelineClipInspector/, 'right inspector should switch from node settings in Canvas mode to clip settings in Viewer mode');
  assert.match(workspaceSource, /WorkspaceTimeline/, 'orchestrator should compose the bottom timeline');
  assert.match(workspaceSource, /\/assets\/branding\/logo-mark\.svg/, 'editor header should use the real MaxVideoAI logo mark');
  assert.doesNotMatch(workspaceSource, /brandMark[\s\S]*>\s*M\s*</, 'editor header should not render a placeholder M logo');
  assert.match(styleSource, /\.brandLogo/, 'editor logo should be styled by isolated editor CSS');
  assert.match(workspaceSource, /focusMode,\s*setFocusMode\][\s\S]*'viewer'/, 'top switch should expose a Viewer mode instead of a second Timeline mode');
  assert.match(workspaceSource, />\s*Viewer\s*</, 'top switch should label the montage surface Viewer');
  assert.doesNotMatch(workspaceSource, />\s*Timeline\s*</, 'top switch should not duplicate the bottom timeline as a top-level mode');
  assert.doesNotMatch(workspaceSource, /HeaderBar|AppSidebar|WorkspaceChrome/, 'editor chrome should not inherit app shell chrome');
  assert.doesNotMatch(workspaceSource, /selected:\s*node\.id === selectedNodeId/, 'orchestrator should not manually control React Flow selected flags');
  assert.match(workspaceSource, /normalizeOutputOnlySourceNodes/, 'orchestrator should normalize stale source-block handles from persisted editor state');
  assert.match(workspaceSource, /normalizeOutputOnlySourceEdges/, 'orchestrator should normalize stale source edge handles from persisted editor state');
  assert.match(workspaceSource, /normalizeGeneratedOutputNodes/, 'orchestrator should normalize stale output-block handles from persisted editor state');
  assert.match(workspaceSource, /normalizePlaceholderOutputNodes/, 'orchestrator should normalize stale fake output media into placeholders');
  assert.match(workspaceSource, /normalizeTimelineMediaUrls/, 'orchestrator should hydrate stale timeline clips with playable output media URLs');
  assert.match(workspaceSource, /isPlayableVideoUrl/, 'orchestrator should distinguish playable video URLs from image thumbnails');
  assert.match(workspaceSource, /isPlayableAudioUrl/, 'orchestrator should hydrate playable audio URLs for generic audio timeline clips');
  assert.match(workspaceSource, /normalizeGeneratedOutputEdges/, 'orchestrator should normalize stale output edge handles from persisted editor state');
  assert.match(workspaceSource, /normalizeShotOutputNodes/, 'orchestrator should normalize stale generated-shot output handles from persisted editor state');
  assert.match(workspaceSource, /normalizeShotOutputEdges/, 'orchestrator should normalize stale generated-shot source edge handles');
  assert.match(workspaceSource, /normalizeWorkspaceEdgeTypes/, 'orchestrator should normalize stale saved edge types');
  assert.match(styleSource, /react-flow__handle-left/, 'local editor CSS should position left handles without inheriting React Flow global CSS');
  assert.match(styleSource, /react-flow__handle-right/, 'local editor CSS should position right handles without inheriting React Flow global CSS');

  const visitorAccessSource = source(visitorAccessPath);
  assert.match(visitorAccessSource, /normalized === '\/app\/studio\/workspace'/, 'editor route should follow existing visitor workspace browse access');
  assert.match(visitorAccessSource, /normalized === '\/app\/studio\/projects'/, 'studio projects route should be available through visitor workspace browse access');
  assert.match(visitorAccessSource, /normalized\.startsWith\('\/app\/studio\/workspace\/'\)/, 'project-scoped studio workspaces should be available through visitor workspace browse access');
});

test('MaxVideoAI editor owns authenticated Studio persistence contracts', () => {
  const projectsApiSource = source(studioProjectsApiPath);
  const projectApiSource = source(studioProjectApiPath);
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
  assert.ok(existsSync(generationPath), 'workspace generation adapter should live in _lib/workspace-generation.ts');
  assert.ok(existsSync(pricingPath), 'workspace pricing adapter should live in _lib/workspace-pricing.ts');
  assert.ok(existsSync(handleDropPath), 'handle-drop node creation should live in a pure route-local helper');
  assert.ok(existsSync(projectSettingsPath), 'project settings helpers should live in a pure route-local helper');
  assert.ok(existsSync(timecodePath), 'timeline timecode helpers should live in a pure route-local helper');
  assert.ok(existsSync(timelineEditingPath), 'timeline editing helpers should live in a pure route-local helper');
  assert.ok(existsSync(timelineRenderPath), 'timeline final-render manifest helpers should live in a pure route-local helper');
  assert.ok(existsSync(timelineTracksPath), 'timeline track helpers should live in a pure route-local helper');
  assert.ok(existsSync(timelineFramesPath), 'timeline frame math should live under _lib/timeline');
  assert.ok(existsSync(timelineCollisionsPath), 'timeline overlap detection should live under _lib/timeline');
  assert.ok(existsSync(timelineInsertPath), 'timeline insert and move package helpers should live under _lib/timeline');
  assert.ok(existsSync(timelineTrimPath), 'timeline trim and split math should live under _lib/timeline');
  assert.ok(existsSync(timelineLinkedAudioPath), 'timeline linked audio sync helpers should live under _lib/timeline');
  assert.ok(existsSync(libraryAssetsPath), 'studio library assets should live in a pure route-local helper');
  assert.ok(existsSync(editorAssetLibraryHookPath), 'studio should load the signed-in user media library through a route-local hook');
  assert.ok(existsSync(projectMediaLibraryModalPath), 'viewer project media import modal should live in a route-local component');
  assert.ok(existsSync(pricingHookPath), 'workspace pricing hook should live in _hooks/useWorkspaceShotPricing.ts');
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
  assert.ok(existsSync(workspacePersistencePath), 'workspace local persistence helpers should live in _state/workspace-persistence.ts');
  assert.ok(existsSync(workspaceNormalizersPath), 'workspace graph and media normalization should live in _state/workspace-normalizers.ts');

  const canvasSource = source(canvasPath);
  const canvasMapSource = source(canvasMapPath);
  const canvasHandleDropPreviewSource = source(canvasHandleDropPreviewPath);
  const canvasPaletteDragPreviewSource = source(canvasPaletteDragPreviewPath);
  const canvasControllerSource = source(canvasControllerPath);
  const assetLibraryBrowserSource = source(assetLibraryBrowserPath);
  const edgeSource = source(edgeTypesPath);
  const librarySource = source(libraryPath);
  const timelineProjectSidebarSource = source(timelineProjectSidebarPath);
  const assetLibraryModalSource = source(assetLibraryModalPath);
  const projectMediaLibraryModalSource = source(projectMediaLibraryModalPath);
  const projectMediaControllerSource = source(projectMediaControllerPath);
  const nodeSource = source(nodeTypesPath);
  const settingsSource = source(settingsPath);
  const timelineClipInspectorSource = source(timelineClipInspectorPath);
  const workspaceSource = source(workspacePagePath);
  const capabilitySource = source(capabilitiesPath);
  const modelCapabilityRegistrySource = source(modelCapabilityRegistryPath);
  const modelEngineFieldsSource = source(modelEngineFieldsPath);
  const modelInputConnectorsSource = source(modelInputConnectorsPath);
  const modelPricingAdapterSource = source(modelPricingAdapterPath);
  const generationSource = source(generationPath);
  const pricingSource = source(pricingPath);
  const handleDropSource = source(handleDropPath);
  const projectSettingsSource = source(projectSettingsPath);
  const timecodeSource = source(timecodePath);
  const timelineEditingSource = source(timelineEditingPath);
  const timelineRenderSource = source(timelineRenderPath);
  const timelineTracksSource = source(timelineTracksPath);
  const timelineFramesSource = source(timelineFramesPath);
  const timelineCollisionsSource = source(timelineCollisionsPath);
  const timelineInsertSource = source(timelineInsertPath);
  const timelineTrimSource = source(timelineTrimPath);
  const timelineLinkedAudioSource = source(timelineLinkedAudioPath);
  const libraryAssetsSource = source(libraryAssetsPath);
  const editorAssetLibraryHookSource = source(editorAssetLibraryHookPath);
  const pricingHookSource = source(pricingHookPath);
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
  const workspacePersistenceSource = source(workspacePersistencePath);
  const workspaceNormalizersSource = source(workspaceNormalizersPath);
  const typesSource = source(typesPath);
  const styleSource = source(stylesPath);
  const timelineClipSource = source(timelineClipPath);
  const timelineContextMenusSource = source(timelineContextMenusPath);
  const timelineSource = source(timelinePath);
  const timelineRulerSource = source(timelineRulerPath);
  const timelineTrackListSource = source(timelineTrackListPath);
  const timelineTrackRowSource = source(timelineTrackRowPath);
  const timelineToolbarSource = source(timelineToolbarPath);
  const videoViewerSource = source(videoViewerPath);
  const mediaStyleSource = source(mediaStylesPath);
  const programMonitorSource = source(programMonitorPath);
  const programPlaybackLayersSource = source(programPlaybackLayersPath);
  const programControlsSource = source(programControlsPath);
  const programPlaybackSyncSource = source(programPlaybackSyncPath);
  const shotInputDockStyle = cssBlock(styleSource, '.shotInputDock');

  assert.match(canvasSource, /@xyflow\/react/, 'canvas should use React Flow for pan, zoom, nodes, handles, and edges');
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
  assert.match(canvasSource, /onConnectStart/, 'canvas should track drags that start from a connector handle');
  assert.match(canvasSource, /onConnectEnd/, 'canvas should create a matching node when a connector drag ends on the pane');
  assert.match(canvasSource, /onDragOver/, 'canvas should accept block template drags from the sidebar');
  assert.match(canvasSource, /onDrop/, 'canvas should create dropped block templates on the pane');
  assert.match(canvasPaletteDragPreviewSource, /maxvideoai:palette-drag-start/, 'canvas palette preview should define the pointer-based block template drag event');
  assert.match(canvasControllerSource, /PALETTE_DRAG_START_EVENT/, 'canvas controller should listen for pointer-based block template drags from the sidebar');
  assert.match(canvasSource, /paletteDragPreview/, 'canvas should show a ghost block while dragging a sidebar template');
  assert.match(canvasControllerSource, /screenToFlowPosition/, 'canvas controller should convert dropped sidebar templates into flow coordinates');
  assert.match(canvasPaletteDragPreviewSource, /application\/x-maxvideoai-node-kind/, 'canvas palette preview should define the block template drag payload type');
  assert.match(canvasControllerSource, /WORKSPACE_NODE_KIND_DRAG_TYPE/, 'canvas controller should read the block template drag payload');
  assert.match(canvasSource, /WorkspaceCanvasFileDropRequest/, 'canvas should expose local file drops as a typed request to the orchestrator');
  assert.match(canvasControllerSource, /dataTransfer\.files/, 'canvas controller should accept files dragged from the operating system');
  assert.match(canvasControllerSource, /clipboardData/, 'canvas controller should accept pasted files and text from the clipboard');
  assert.match(workspaceSource, /handleCanvasFileDrop/, 'orchestrator should convert dropped local files into matching workspace nodes');
  assert.match(workspaceSource, /handleCanvasTextPaste/, 'orchestrator should convert pasted plain text into prompt nodes');
  assert.match(workspaceSource, /URL\.createObjectURL/, 'local file drops should use browser object URLs for immediate preview');
  assert.match(canvasHandleDropPreviewSource, /ViewportPortal/, 'canvas should render handle-drag previews in flow coordinates');
  assert.match(canvasHandleDropPreviewSource, /workspaceGhostNode/, 'canvas should show a ghost block while dragging from a connector');
  assert.match(canvasHandleDropPreviewSource, /workspaceGhostLink/, 'canvas should show a ghost link while dragging from a connector');
  assert.match(canvasPaletteDragPreviewSource, /workspaceGhostNode/, 'canvas should show a ghost block while dragging a sidebar template');
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
  assert.match(styleSource, /react-flow__edge\.selected/, 'editor CSS should target selected edge containers');
  assert.match(styleSource, /react-flow__edge:focus/, 'editor CSS should remove the selected edge container focus box');
  assert.match(styleSource, /react-flow__edge\.selected[\s\S]*react-flow__edge-path/, 'editor CSS should render selected edge glow from the line path');

  for (const nodeName of ['AssetImageNode', 'AssetVideoNode', 'AssetAudioNode', 'TextPromptNode', 'ShotNode', 'OutputNode']) {
    assert.match(nodeSource, new RegExp(`export function ${nodeName}`), `${nodeName} should be exported`);
  }
  assert.match(nodeSource, /NodeResizeControl/, 'content source nodes should use React Flow resize controls');
  assert.match(nodeSource, /SOURCE_RESIZABLE_NODE_KINDS/, 'node renderer should centralize which block kinds can be resized');
  assert.match(nodeSource, /'asset-image'[\s\S]*'asset-video'[\s\S]*'asset-audio'[\s\S]*'text-prompt'[\s\S]*'output'/, 'image, video, audio, prompt, and output blocks should be resizable');
  assert.doesNotMatch(nodeSource, /SOURCE_RESIZABLE_NODE_KINDS = new Set<WorkspaceNodeKind>\(\[[^\]]*'shot'/, 'generate blocks should keep standard non-resizable layout');
  assert.match(nodeSource, /position="bottom-left"/, 'resizable blocks should expose a discreet bottom-left resize selector');
  assert.match(nodeSource, /styles\.nodeResizeControl/, 'resize selector should use isolated editor CSS');
  assert.match(nodeSource, /styles\.sourceResizableNode/, 'resizable source nodes should opt into fluid card sizing');
  assert.match(nodeSource, /minWidth=\{SOURCE_NODE_MIN_WIDTH\}/, 'resize control should keep a standard minimum width');
  assert.match(nodeSource, /minHeight=\{SOURCE_NODE_MIN_HEIGHT\}/, 'resize control should keep a standard minimum height');
  assert.match(styleSource, /\.sourceResizableNode/, 'resizable source node sizing should be styled in isolated editor CSS');
  assert.match(styleSource, /\.nodeResizeControl/, 'bottom-left resize selector should be styled in isolated editor CSS');
  assert.match(styleSource, /\.nodeResizeGrip/, 'resize selector should have a discreet visual grip');
  assert.match(styleSource, /\.nodeResizeControl[\s\S]*position:\s*absolute/, 'resize selector should be absolutely positioned by editor CSS');
  assert.match(styleSource, /\.nodeResizeControl[\s\S]*bottom:\s*-8px/, 'resize selector should sit on the bottom edge');
  assert.match(styleSource, /\.nodeResizeControl[\s\S]*left:\s*-8px/, 'resize selector should sit on the left edge');
  assert.match(styleSource, /cursor:\s*nwse-resize/, 'resize selector should communicate diagonal resize affordance');
  assert.match(styleSource, /react-flow__node-asset-image[\s\S]*react-flow__node-asset-video[\s\S]*react-flow__node-text-prompt[\s\S]*react-flow__node-output/, 'media, prompt, and output blocks should have explicit default node dimensions');
  assert.match(styleSource, /react-flow__node-asset-audio/, 'audio blocks should have explicit default node dimensions');
  assert.match(styleSource, /width:\s*210px/, 'source node defaults should keep a compact standard width until manually resized');
  assert.match(styleSource, /height:\s*166px/, 'visual and prompt source nodes should keep a compact standard height until manually resized');
  assert.match(styleSource, /height:\s*138px/, 'audio source nodes should keep a compact standard height until manually resized');
  assert.match(styleSource, /\.nodePreview img[\s\S]*object-fit:\s*contain/, 'media previews should scale inside the block while preserving their source ratio');

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
  assert.match(workspacePersistenceSource, /function workspaceStorageKeyForProject/, 'workspace persistence module should own project-scoped local storage keys');
  assert.match(workspacePersistenceSource, /function readPersistedWorkspaceState/, 'workspace persistence module should own persisted workspace local reads');
  assert.match(workspacePersistenceSource, /function readUserCanvasTemplates/, 'workspace persistence module should own local canvas template reads');
  assert.match(workspacePersistenceSource, /function writeUserCanvasTemplates/, 'workspace persistence module should own local canvas template writes');
  assert.match(workspaceNormalizersSource, /function normalizeOutputOnlySourceNodes/, 'workspace normalizers should own stale source-node handle cleanup');
  assert.match(workspaceNormalizersSource, /function normalizePlaceholderOutputNodes/, 'workspace normalizers should own stale output placeholder cleanup');
  assert.match(workspaceNormalizersSource, /function normalizeTimelineMediaUrls/, 'workspace normalizers should own timeline media URL hydration');
  assert.match(workspaceNormalizersSource, /function playableOutputTimelineUrl/, 'workspace normalizers should own playable output media detection');
  assert.match(timelineEditingSource, /from '\.\/timeline\/timeline-frames'/, 'timeline editing facade should import frame math from the timeline domain');
  assert.match(timelineEditingSource, /from '\.\/timeline\/timeline-collisions'/, 'timeline editing facade should import overlap checks from the timeline domain');
  assert.match(timelineEditingSource, /from '\.\/timeline\/timeline-insert'/, 'timeline editing facade should import insertion helpers from the timeline domain');
  assert.match(timelineEditingSource, /from '\.\/timeline\/timeline-trim'/, 'timeline editing facade should import trim helpers from the timeline domain');
  assert.match(timelineEditingSource, /from '\.\/timeline\/timeline-linked-audio'/, 'timeline editing facade should import linked audio helpers from the timeline domain');
  assert.match(timelineFramesSource, /secondsToTimelineFrame/, 'timeline frame helper should expose seconds-to-frame conversion');
  assert.match(timelineFramesSource, /snapSecondsToTimelineFrame/, 'timeline frame helper should expose frame-accurate second snapping');
  assert.match(timelineCollisionsSource, /timelineRangeOverlapsItem/, 'timeline collision helper should expose range overlap checks');
  assert.match(timelineCollisionsSource, /timelineTrackHasOverlap/, 'timeline collision helper should expose same-track no-overlap assertions');
  assert.match(timelineInsertSource, /editTracksForPreparedItems/, 'timeline insert helper should determine affected tracks for insert packages');
  assert.match(timelineInsertSource, /insertionBoundaryForWholeClipInsert/, 'timeline insert helper should resolve whole-clip insertion boundaries');
  assert.match(timelineTrimSource, /resolveResizeTarget/, 'timeline trim helper should resolve source-capped resize targets');
  assert.match(timelineTrimSource, /resolveTimelineSplitOffset/, 'timeline trim helper should resolve frame-safe split offsets');
  assert.match(timelineLinkedAudioSource, /syncLinkedAudioWithVideo/, 'timeline linked audio helper should synchronize linked audio from its video peer');
  assert.match(timelineLinkedAudioSource, /hasLinkedVideoPeer/, 'timeline linked audio helper should detect video/audio pairs');
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
  assert.match(timelineEditingSource, /export function normalizeWorkspaceTimelineStarts/, 'timeline helper should recalculate clip start times per track');
  assert.match(timelineEditingSource, /export function moveWorkspaceTimelineItem/, 'timeline helper should reorder clips predictably');
  assert.match(timelineEditingSource, /export function reorderWorkspaceTimelineItem/, 'timeline helper should support drag/drop target positions');
  assert.match(timelineEditingSource, /export function splitWorkspaceTimelineItem/, 'timeline helper should split selected clips for cut editing');
  assert.match(timelineEditingSource, /export function insertWorkspaceTimelineItems/, 'timeline helper should support insert, overwrite, and replace edits from the canvas');
  assert.match(timelineEditingSource, /export function deleteWorkspaceTimelineItem/, 'timeline helper should delete selected linked clips with optional ripple behavior');
  assert.match(timelineEditingSource, /WorkspaceTimelineInsertMode/, 'timeline helper should type insert, overwrite, and replace edit modes');
  assert.match(timelineEditingSource, /WorkspaceTimelineTrimMode/, 'timeline helper should type normal, ripple, and roll trim modes');
  assert.match(timelineEditingSource, /export function trimWorkspaceTimelineItem/, 'timeline helper should trim clip starts and ends');
  assert.match(timelineEditingSource, /export function positionWorkspaceTimelineItem/, 'timeline helper should support direct pointer-based clip moves');
  assert.match(timelineEditingSource, /export function moveWorkspaceTimelineSelectionWithMode/, 'timeline helper should route pointer drags through insert, overwrite, and replace modes');
  assert.match(timelineEditingSource, /nextTrack\?: WorkspaceTimelineTrack/, 'timeline helper should support moving clips between video tracks');
  assert.match(timelineTracksSource, /isWorkspaceTimelineVideoTrack/, 'timeline track helper should distinguish video tracks from audio tracks');
  assert.match(timelineEditingSource, /isWorkspaceTimelineVideoTrack/, 'timeline editing should use the shared video-track helper');
  assert.match(timelineEditingSource, /targetTrack/, 'timeline helper should apply a drag target video track');
  assert.match(timelineEditingSource, /export function resizeWorkspaceTimelineItem/, 'timeline helper should support direct pointer-based clip resizing');
  assert.match(timelineTrimSource, /maxResizeDurationForTimelineItem/, 'timeline trim helper should cap trim expansion to source media duration');
  assert.match(timelineEditingSource, /sourceRightRoomForTimelineItem/, 'timeline helper should know how much source media remains after a clip out-point');
  assert.match(timelineEditingSource, /clampSourceStartForDuration/, 'timeline helper should keep clip source in/out inside the original media');
  assert.match(timelineEditingSource, /export function toggleWorkspaceTimelineCrossfade/, 'timeline helper should toggle crossfade transitions between adjacent clips');
  assert.match(timelineEditingSource, /export function buildWorkspaceTimelineItemsForOutput/, 'timeline helper should create linked audio and video clips from generated outputs');
  assert.match(timelineEditingSource, /export function buildWorkspaceTimelineItemsForAsset/, 'timeline helper should create timeline clips from imported canvas media assets');
  assert.match(timelineEditingSource, /workspaceAssetHasTimelineAudio/, 'timeline helper should treat imported video assets as video plus linked audio');
  assert.match(timelineRenderSource, /export function buildWorkspaceTimelineRenderManifest/, 'timeline render helper should build a final-render manifest from timeline clips');
  assert.match(timelineRenderSource, /WorkspaceTimelineRenderManifest/, 'timeline render helper should type the backend handoff contract');
  assert.match(timelineRenderSource, /projectSettings/, 'timeline render manifest should carry project settings for final composition');
  assert.match(timelineRenderSource, /timelineTrackOrderForItems/, 'timeline render helper should include dynamic video tracks in the final handoff');
  assert.match(timelineRenderSource, /isWorkspaceTimelineVideoTrack/, 'timeline render helper should treat V2 and later tracks as video tracks');
  assert.match(timelineRenderSource, /processing_media/, 'timeline render helper should block placeholder and processing media before export');
  assert.match(timelineRenderSource, /overlapping_clips/, 'timeline render helper should detect same-track overlaps before export');
  assert.match(timelineRenderSource, /transitionOut/, 'timeline render helper should preserve transition metadata for final render');
  assert.match(timelineRenderSource, /transform\?: WorkspaceTimelineItem\['transform'\]/, 'timeline render helper should carry clip transform settings');
  assert.match(timelineRenderSource, /audioMix\?: WorkspaceTimelineItem\['audioMix'\]/, 'timeline render helper should carry clip audio mix settings');
  assert.match(timelineRenderSource, /transform: item\.transform/, 'timeline render manifest should serialize clip transform settings');
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
  assert.match(editorAssetLibraryHookSource, /normalizeWorkspaceUserLibraryPayload/, 'studio user library hook should normalize API results before rendering');
  assert.match(editorAssetLibraryHookSource, /useState<WorkspaceLibrarySource>\('all'\)/, 'studio user library hook should own the active app-library source filter');
  assert.match(editorAssetLibraryHookSource, /WORKSPACE_EDITOR_ASSET_LIBRARY_CACHE/, 'studio user library hook should cache loaded assets between picker openings');
  assert.match(editorAssetLibraryHookSource, /shouldUseFallback[\s\S]*Boolean\(error\)/, 'studio user library hook should not show dev assets while a real user-library request is loading or merely empty');
  assert.match(editorAssetLibraryHookSource, /setSource/, 'studio user library hook should expose a source setter to the browser UI');
  assert.match(pricingHookSource, /runPreflight/, 'workspace pricing hook should call the existing generate video preflight API');
  assert.match(workspaceSource, /useWorkspaceShotPricing/, 'orchestrator should inject live shot pricing estimates into nodes');
  assert.match(workspaceSource, /createPendingWorkspaceOutput/, 'orchestrator should create or reuse an output placeholder as soon as generation starts');
  assert.match(workspaceSource, /findGeneratedOutputNodeForShot/, 'orchestrator should reuse an upstream output block when one already exists');
  assert.match(workspaceSource, /onCreateNodeFromHandleDrop/, 'orchestrator should wire handle-drop node creation into the canvas');
  assert.match(workspaceSource, /isWorkspaceConnectionCompatible/, 'orchestrator should reject incompatible graph links before adding edges');
  assert.match(workspaceSource, /workspaceConnectionCapacity/, 'orchestrator should reject graph links when an input connector has no remaining capacity');
  assert.match(workspaceSource, /onCreateNodeFromPaletteDrop/, 'orchestrator should wire sidebar block-template drops into the canvas');
  assert.match(workspaceSource, /appendSelectedWorkspaceGraphNode/, 'orchestrator should select newly added palette blocks so the inspector follows the new block');
  assert.match(workspaceSource, /WorkspaceAssetLibraryModal/, 'orchestrator should open the editor asset library from empty media nodes');
  assert.match(workspaceSource, /buildWorkspaceTimelineItemsForAsset/, 'orchestrator should send imported canvas media blocks into the montage timeline');
  const sendOutputToTimelineHandler = workspaceSource.match(/const handleSendOutputToTimeline = useCallback\([\s\S]*?\n  \);\n\n  const renderNodes/);
  assert.ok(sendOutputToTimelineHandler, 'workspace should define a send-to-timeline handler');
  assert.doesNotMatch(sendOutputToTimelineHandler[0], /setFocusMode\('viewer'\)/, 'sending a canvas item to the timeline should not automatically switch to Viewer mode');
  assert.match(settingsSource, /AssetInspector[\s\S]*timelineInsertActions[\s\S]*Insert at playhead/, 'asset inspector should expose timeline insert actions for imported media blocks');
  assert.match(programPlaybackSyncSource, /playableImageUrlForItem/, 'montage viewer should preview imported image assets as still clips');
  assert.match(workspaceStateSource, /focusMode\?: WorkspaceFocusMode/, 'persisted workspace state should remember whether the user was in canvas or viewer mode');
  assert.match(workspaceSource, /setFocusMode\(persisted\.focusMode/, 'workspace hydration should restore the active canvas/viewer mode');
  assert.match(workspaceSource, /selectedTimelineItemId/, 'orchestrator should track which timeline clip controls the montage viewer');
  assert.match(workspaceSource, /playheadSec/, 'orchestrator should track the montage playhead');
  assert.match(workspaceSource, /handleCutTimelineItem/, 'orchestrator should wire basic cut editing from the bottom timeline');
  assert.match(workspaceSource, /handlePositionTimelineItem/, 'orchestrator should wire pointer-based clip movement');
  assert.match(workspaceSource, /handleResizeTimelineItem/, 'orchestrator should wire pointer-based clip resizing');
  assert.match(workspaceStateSource, /DEFAULT_WORKSPACE_SHOT_MODEL_ID = 'seedance-2-0'/, 'new shot blocks should default to Seedance 2.0');
  assert.match(workspaceSource, /capability\.id === DEFAULT_WORKSPACE_SHOT_MODEL_ID/, 'orchestrator should resolve the default shot model from the current capabilities');
  assert.match(templateSource, /from '\.\/templates\/registry'/, 'workspace template facade should export the focused registry');
  assert.match(templateSource, /from '\.\/templates\/template-core'/, 'workspace template facade should export shared edge helpers');
  assert.match(templateCoreSource, /DEFAULT_WORKSPACE_TEMPLATE_SHOT_MODEL_ID = 'seedance-2-0'/, 'template shot defaults should use Seedance 2.0');
  assert.match(workspaceSource, /videoTrackCount/, 'workspace should remember added video timeline tracks');
  assert.match(workspaceSource, /MAX_TIMELINE_VIDEO_TRACKS/, 'workspace should cap added video tracks to a small editor-friendly count');
  assert.match(workspaceSource, /handleAddTimelineVideoTrack/, 'workspace should expose an add-video-track action to the timeline');
  assert.match(workspaceSource, /onAddVideoTrack=\{handleAddTimelineVideoTrack\}/, 'workspace should let the timeline add video tracks without a separate panel');
  assert.match(workspaceSource, /useWorkspaceEditorAssetLibrary/, 'orchestrator should feed the picker from the signed-in user media library');
  assert.match(workspaceSource, /useWorkspaceEditorAssetLibrary\(assetPickerNode \? assetPickerNode\.data\.kind : undefined\)/, 'orchestrator should load the signed-in media library only when the picker modal is open');
  assert.doesNotMatch(workspaceSource, /selectedMediaNodeKind/, 'selecting a media node should not preload the signed-in media library before the picker opens');
  assert.doesNotMatch(workspaceSource, /sidebarLibrary\s*=\s*useWorkspaceEditorAssetLibrary\(null\)/, 'orchestrator should not load the user media library directly in the sidebar');
  assert.match(workspaceSource, /assetPickerNodeId/, 'orchestrator should track which media node is being filled from the library');
  assert.match(workspaceSource, /workspaceAssetRecordFromLibraryAsset/, 'orchestrator should store selected library assets on media nodes');
  assert.match(renderEdgesSource, /filterRenderableWorkspaceEdges/, 'renderable edge helper should omit edges whose handles are unavailable');
  assert.match(renderEdgesSource, /isWorkspaceConnectionCompatible/, 'renderable edge helper should omit persisted incompatible media-family edges');
  assert.match(workspaceSource, /filterRenderableWorkspaceEdges/, 'orchestrator should avoid passing invalid handle edges to React Flow');
  assert.match(templateProductAdSource, /createProductAdWorkspaceTemplate/, 'Product Ad starter template should be implemented in its own builder');
  assert.match(typesSource, /thumbnailUrl\?: string/, 'canvas template summaries should support visual thumbnails');
  assert.match(templateRegistrySource, /flow: 'Product ref -> style clip -> 4 shots'/, 'canvas template summaries should expose an AI workflow path');
  assert.match(librarySource, /template\.thumbnailUrl/, 'canvas template sidebar should render image-backed template cards');
  assert.match(templateCoreSource, /type: 'workspace-smart'/, 'workspace edges should use the custom smart edge type');
  assert.match(templateDevBlocksSource, /createDevBlocksWorkspaceTemplate/, 'Dev Blocks starter template should be implemented in its own builder');
  assert.match(templateRegistrySource, /id: 'dev-blocks'/, 'Dev Blocks should be exposed as a starter template');
  assert.match(templateRegistrySource, /WORKSPACE_TEMPLATE_REGISTRY/, 'canvas templates should be routed through an additive registry');
  assert.match(templateCharacterDialogueSource, /createCharacterDialogueWorkspaceTemplate/, 'Character Dialogue should have a focused template builder');
  assert.match(templateStoryboardToVideoSource, /createStoryboardToVideoWorkspaceTemplate/, 'Storyboard should have a focused template builder');
  assert.match(templateUgcAdSource, /createUgcAdWorkspaceTemplate/, 'UGC should have a focused template builder');
  assert.match(templateCinematicSceneSource, /createCinematicSceneWorkspaceTemplate/, 'Cinematic Scene should have a focused template builder');
  assert.match(workspaceSource, /getWorkspaceShotTargetHandles/, 'rendered shot nodes should derive target handles from the selected engine');
  assert.match(workspaceSource, /sourceHandles:\s*\[GENERATED_OUTPUT_TARGET_HANDLE\]/, 'rendered shot nodes should expose one reusable generated-output source handle');
  assert.match(workspaceSource, /inputConnectors/, 'rendered shot nodes should receive connector labels and metadata');
  assert.match(nodeSource, /function ShotInputDock/, 'generate block input handles should render in a dedicated bottom dock');
  assert.match(nodeSource, /capacityLabel/, 'generate block input handles should render remaining/max counts for multi-reference connectors');
  assert.match(nodeSource, /remainingCount === 0/, 'generate block input handles should mark full connectors as unavailable');
  assert.match(nodeSource, /statusPill[\s\S]*ShotInputDock/, 'generate block connector dock should render below the Ready status');
  assert.match(nodeSource, /styles\.shotInputDock/, 'generate block should place connector labels in a bottom dock, not over the preview');
  assert.match(shotInputDockStyle, /display:\s*grid/, 'generate block connector dock should be styled in normal card flow');
  assert.doesNotMatch(shotInputDockStyle, /position:\s*absolute/, 'generate block connector dock should not be side-mounted');
  assert.match(shotInputDockStyle, /background:\s*transparent/, 'generate block connector dock should not render as a separate box');
  assert.doesNotMatch(shotInputDockStyle, /border:\s*1px/, 'generate block connector dock should not draw a boxed border');
  assert.match(styleSource, /\.shotInputRow/, 'generate block connector rows should be styled in the isolated editor CSS');
  assert.match(nodeSource, /left:\s*-12/, 'generate block input handles should sit on the card edge, not inside the label row');
  assert.match(typesSource, /pricingEstimate\?: WorkspacePricingEstimate/, 'shot nodes should carry a live parameter-based pricing estimate');
  assert.match(nodeSource, /pricingEstimate/, 'shot nodes should render live parameter-based pricing estimates');
  assert.doesNotMatch(nodeSource, /estimated_cost_or_credits/, 'shot nodes should not render static engine pricing as the estimate');
  assert.match(nodeSource, /function isPlayableVideoUrl/, 'video-capable blocks should detect playable video sources');
  assert.match(nodeSource, /<video[\s\S]*controls/, 'video-capable blocks should render playable previews when a video URL exists');
  assert.match(nodeSource, /function isPlayableAudioUrl/, 'audio-capable blocks should detect playable audio sources');
  assert.match(nodeSource, /<audio[\s\S]*controls/, 'audio blocks should render playable controls when an audio URL exists');
  assert.match(nodeSource, /outputStatus/, 'output blocks should derive placeholder, processing, and ready display states');
  assert.match(nodeSource, /Processing/, 'output blocks should show a processing placeholder while generation is running');
  assert.match(nodeSource, /disabled=\{!canSendToTimeline\}/, 'output blocks should not send placeholders or processing outputs to the timeline');
  assert.match(nodeSource, /function EmptyMediaPicker/, 'media nodes should render an empty picker state when no media is attached');
  assert.match(nodeSource, /onOpenAssetLibrary/, 'media node plus button should open the editor asset library');
  assert.match(settingsSource, /pricingEstimate/, 'shot inspector should render the same live pricing estimate');
  assert.match(settingsSource, /render_options/, 'shot inspector should render engine-derived render options');
  assert.doesNotMatch(settingsSource, /<span>Lip-sync<\/span>[\s\S]*lipSyncEnabled/, 'shot inspector should not always render a generic lip-sync toggle');
  assert.match(settingsSource, /recommendedModels[\s\S]*slice\(0,\s*4\)/, 'shot inspector model selector should cap inline recommendations at four models');
  assert.match(settingsSource, /<optgroup label="Recommended">[\s\S]*recommendedModels\.map/, 'shot inspector model selector should expose recommended models inside the model dropdown');
  assert.match(settingsSource, /remainingCapabilities = capabilities\.filter/, 'shot inspector model selector should derive the full remaining model list after recommendations');
  assert.match(settingsSource, /<optgroup label="All models">[\s\S]*remainingCapabilities\.map/, 'shot inspector model selector should keep the full model list available after recommendations');
  assert.doesNotMatch(settingsSource, /styles\.recommendationList|<span>Recommended models<\/span>/, 'shot inspector should not render a separate recommended models section');
  assert.doesNotMatch(styleSource, /\.recommendationList/, 'editor CSS should not keep styling for the removed recommendation section');
  assert.match(settingsSource, /styles\.pricingActionSummary[\s\S]*pricingEstimate[\s\S]*styles\.primaryPanelButton[\s\S]*<span>Routing<\/span>[\s\S]*Available inputs/, 'shot inspector should keep routing and available inputs below the price and generate action');
  assert.match(styleSource, /\.pricingActionSummary/, 'shot inspector price action summary should be styled in isolated editor CSS');
  assert.match(settingsSource, /<video[\s\S]*controls/, 'output and video inspectors should render playable media when a video URL exists');
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
  assert.match(styleSource, /\.viewerAudioLayer/, 'hidden audio playback elements should be styled in isolated editor CSS');
  assert.match(programPlaybackSyncSource, /PRELOAD_NEXT_CLIP_WINDOW_SEC/, 'playback sync should preload the next cut before the playhead reaches it');
  assert.match(programPlaybackSyncSource, /crossfadeDurationFor/, 'playback sync should preview crossfade transitions between adjacent timeline clips');
  assert.match(programPlaybackLayersSource, /viewerVideoLayerVisible/, 'playback layers should use opacity layers for smooth visual transitions');
  assert.match(programPlaybackLayersSource, /clipVisualStyleFor/, 'playback layers should apply selected clip transform settings to program monitor layers');
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
  assert.match(programMonitorSource, /PROGRAM_ZOOM_OPTIONS/, 'program monitor should expose standard program zoom options');
  assert.match(programMonitorSource, /Program monitor zoom/, 'program monitor should label zoom as a monitor display setting');
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
  assert.doesNotMatch(videoViewerSource, /isSequenceSettingsOpen/, 'viewer should not own project settings dialog state');
  assert.doesNotMatch(videoViewerSource, /sequenceSettingsButton/, 'viewer should not expose project settings in its footer');
  assert.doesNotMatch(workspaceSource, /aria-label="Open project settings"/, 'topbar should not expose sequence settings as a project-level action');
  assert.doesNotMatch(workspaceSource, /WorkspaceProjectSettingsDialog/, 'workspace should not render a project settings dialog at shell level');
  assert.match(workspaceSource, /selectedSequence=\{selectedSequenceForInspector\}/, 'viewer mode inspector should receive selected sequence settings');
  assert.match(timelineProjectSidebarSource, /useProjectMediaController/, 'project media sidebar should delegate media behavior to the project media controller');
  assert.match(timelineProjectSidebarSource, /_styles\/media\.module\.css/, 'project media sidebar should import its focused media CSS module');
  assert.match(projectMediaControllerSource, /onInspectSequence\(sequenceId\)/, 'project media sequence cards should route sequence selection into the inspector');
  assert.match(timelineClipInspectorSource, /Sequence settings/, 'timeline inspector should expose selected sequence settings');
  assert.match(timelineClipInspectorSource, /Sequence aspect ratio/, 'timeline inspector should expose a sequence aspect ratio selector');
  assert.match(timelineClipInspectorSource, /Sequence resolution/, 'timeline inspector should expose a sequence resolution selector');
  assert.match(timelineClipInspectorSource, /Sequence FPS/, 'timeline inspector should expose a sequence FPS selector');
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
  assert.match(workspaceSource, /isTimelinePlaying/, 'workspace should own shared montage playback state');
  assert.match(workspaceSource, /setInterval/, 'workspace should advance the playhead from a timeline clock, not only native video controls');
  assert.match(workspaceSource, /handleToggleTimelinePlayback/, 'workspace should expose a shared play/pause toggle');
  assert.match(workspaceSource, /timelineHistory/, 'workspace should keep undo and redo history for timeline edits');
  assert.match(workspaceSource, /handleUndoTimeline/, 'workspace should support timeline undo');
  assert.match(workspaceSource, /handleRedoTimeline/, 'workspace should support timeline redo');
  assert.doesNotMatch(workspaceSource, /timelineEditMode/, 'workspace should no longer expose selectable insert, overwrite, or replace timeline modes');
  assert.match(workspaceSource, /insertWorkspaceTimelineItems/, 'canvas outputs should enter the sequence through timeline insert operations');
  assert.match(workspaceSource, /handleDropNodeToTimeline/, 'canvas media nodes should be droppable directly onto a timeline track');
  assert.match(workspaceSource, /retargetWorkspaceTimelineItemsForTrack/, 'timeline drops should retarget visual and audio clips to the dropped lane');
  assert.match(workspaceSource, /selectedTimelineItem/, 'workspace should derive the selected timeline item for Viewer mode editing');
  assert.match(workspaceSource, /handlePatchTimelineItem/, 'workspace should expose timeline clip patching for the clip inspector');
  assert.match(workspaceSource, /projectSettings/, 'workspace should persist and pass project-level aspect ratio, resolution, and FPS');
  assert.match(workspaceSource, /handleProjectSettingsChange/, 'workspace should expose project settings changes from the project settings dialog');
  assert.match(workspaceSource, /coerceWorkspaceProjectSettings/, 'workspace should sanitize persisted project settings before use');
  assert.match(workspaceSource, /RENDER_MANIFEST_STORAGE_KEY/, 'workspace should persist the latest timeline render handoff locally');
  assert.match(workspaceSource, /VIDEO_EXPORT_REQUEST_STORAGE_KEY/, 'workspace should persist the latest MP4 video export request locally');
  assert.match(workspaceSource, /\/api\/studio\/timeline-exports\/estimate/, 'editor should estimate server export cost before queueing the job');
  assert.match(workspaceSource, /\/api\/studio\/timeline-exports/, 'editor should create server render export jobs');
  assert.doesNotMatch(workspaceSource, /Render backend pending/, 'export action should no longer present a fake pending backend');
  assert.match(workspaceSource, /buildWorkspaceTimelineRenderManifest/, 'workspace export action should build a timeline render manifest');
  assert.match(workspaceSource, /serializeWorkspaceTimelineRenderManifest/, 'workspace export action should serialize the render manifest contract');
  assert.match(workspaceSource, /buildWorkspaceTimelineVideoExportRequest/, 'workspace export action should build the MP4 video export request contract');
  assert.match(workspaceSource, /serializeWorkspaceTimelineVideoExportRequest/, 'workspace export action should serialize the video export request contract');
  assert.match(workspaceSource, /exportQualityPreset/, 'workspace export action should keep the selected video quality preset');
  assert.match(workspaceSource, /handleExportTimelineVideo/, 'workspace should wire the primary export video action');
  assert.match(workspaceSource, /handleExportTimelineRender/, 'workspace should wire the topbar export action to timeline render handoff');
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
  assert.match(timelineSource, /buildTimelineTracks/, 'timeline should build video tracks dynamically before fixed audio tracks');
  assert.match(timelineSource, /displayedVideoTracks = \[\.\.\.videoTracks\]\.reverse\(\)/, 'new video tracks should display above V1 while audio tracks stay below video tracks');
  assert.match(timelineSource, /timelineVideoTrackId/, 'timeline should label added video tracks as V2, V3, and later');
  assert.match(timelineTrackRowSource, /data-timeline-add-track="video"/, 'timeline track row should own compact add-video-track controls');
  assert.match(timelineTrackRowSource, /data-timeline-add-track="audio"/, 'timeline track row should own compact add-audio-track controls');
  assert.match(timelineTrackRowSource, /data-timeline-video-visibility/, 'timeline track row should own video track visibility toggles');
  assert.match(timelineTrackRowSource, /data-timeline-audio-mute/, 'timeline track row should own audio track mute toggles');
  assert.match(timelineTrackRowSource, /data-timeline-track-lock/, 'timeline track row should own track lock toggles');
  assert.match(timelineSource, /snapEnabled/, 'timeline should keep snap mode state');
  assert.match(timelineSource, /SNAP_TARGET_THRESHOLD_PIXELS/, 'timeline snapping should use a subtle proximity threshold');
  assert.match(timelineSource, /buildSnapTargets/, 'timeline should snap to clip edges, playhead, and zero');
  assert.match(timelineRulerSource, /timelineSnapGuide/, 'timeline ruler should render a visible snap guide while editing');
  assert.match(timelineTrackRowSource, /timelineSnapGuide/, 'timeline track rows should render visible snap guides while editing');
  assert.match(timelineSource, /activeTimelineTool/, 'timeline should keep a selected edit tool mode');
  assert.match(timelineToolbarSource, /Blade \/ Cut tool/, 'cut should be a selected blade tool instead of only a per-clip duplicate action');
  assert.match(timelineToolbarSource, /Timeline editing tools/, 'timeline should expose editing tools as a toolbar');
  assert.match(
    timelineToolbarSource,
    /timelineZoomSlot[\s\S]*timelineTransport[\s\S]*timelineToolGroup[\s\S]*timelineZoomControl/,
    'timeline undo, redo, and editing tools should sit in the right action slot immediately before zoom'
  );
  assert.match(timelineToolbarSource, /Selection tool/, 'timeline should expose selection as an editing tool');
  assert.doesNotMatch(timelineToolbarSource, /aria-label="Trim tool"/, 'timeline toolbar should not expose trim as a selected tool while clip handles own simple trimming');
  assert.doesNotMatch(timelineToolbarSource, /aria-label="Ripple trim tool"/, 'timeline toolbar should not expose ripple trim for now');
  assert.doesNotMatch(timelineToolbarSource, /aria-label="Roll trim tool"/, 'timeline toolbar should not expose roll trim for now');
  assert.match(timelineToolbarSource, /data-tooltip/, 'timeline editing tools should expose shortcut tooltips');
  assert.match(timelineSource, /window\.addEventListener\('keydown'/, 'timeline should register basic keyboard shortcuts');
  assert.match(timelineSource, /event\.code === 'Space'/, 'Space should toggle montage playback');
  assert.match(timelineSource, /event\.key === ' '/, 'Space shortcut should tolerate browser key/code differences');
  assert.match(timelineSource, /event\.code === 'KeyC'/, 'C should activate the cut tool');
  assert.match(timelineSource, /event\.code === 'KeyV'/, 'V should return to the select and drag tool');
  assert.match(timelineSource, /event\.code === 'KeyM'/, 'M should toggle timeline snapping');
  assert.doesNotMatch(timelineSource, /event\.code === 'KeyT'/, 'T should not activate a hidden trim tool');
  assert.doesNotMatch(timelineSource, /event\.code === 'KeyR'/, 'R should not activate hidden ripple trim');
  assert.doesNotMatch(timelineSource, /event\.code === 'KeyY'/, 'Y should not activate hidden roll trim');
  assert.match(timelineSource, /event\.code === 'Delete'/, 'Delete should remove the selected timeline clip');
  assert.match(timelineSource, /Cmd\/Ctrl \+ Z|KeyZ/, 'timeline should expose undo and redo shortcuts');
  assert.match(
    timelineSource,
    /event\.code === 'KeyZ'[\s\S]*if \(!isShortcutActive\) return/,
    'timeline undo and redo shortcuts should run before the surface-scoped shortcut gate'
  );
  assert.doesNotMatch(timelineSource, /Timeline insert mode/, 'timeline toolbar should not expose insert, overwrite, or replace mode switches');
  assert.doesNotMatch(timelineSource, /Timeline trim mode/, 'timeline should not expose trim, ripple, and roll as a text mode switch');
  assert.doesNotMatch(timelineSource, /Toggle crossfade transition/, 'timeline toolbar should not expose ad hoc crossfade controls before the effects menu exists');
  assert.match(timelineSource, /event\.code === 'KeyS'|KeyB/, 'timeline should expose a keyboard split shortcut at the playhead');
  assert.match(timelineClipSource, /timelineClipCutMode/, 'timeline clip should render a dedicated cut-mode pointer state');
  assert.match(timelineSource, /getBoundingClientRect/, 'cut tool should convert the mouse position on the clip into a split time');
  assert.match(timelineSource, /playheadSec/, 'timeline should render and control a playhead');
  assert.match(timelineSource, /projectFps/, 'timeline should format playhead and ruler labels from project FPS');
  assert.match(timelineSource, /formatWorkspaceTimecode/, 'timeline should display HH:MM:SS:FF timecode labels');
  assert.match(timelineSource, /handleBeginPlayheadDrag/, 'timeline should let users drag the playhead line directly');
  assert.match(timelineSource, /handleBeginTimelineSurfacePointerDown/, 'timeline should let users drag empty timeline space to scrub');
  assert.match(timelineRulerSource, /data-playhead-handle="true"/, 'timeline ruler playhead should expose an interactive handle on the line');
  assert.match(timelineTrackRowSource, /data-playhead-handle="true"/, 'timeline track rows should expose interactive playhead handles on each lane');
  assert.match(timelineRulerSource, /Drag timeline playhead/, 'timeline ruler playhead handle should have a clear accessible label');
  assert.match(timelineTrackRowSource, /Drag timeline playhead/, 'timeline row playhead handles should have clear accessible labels');
  assert.match(timelineRulerSource, /Timeline scrubber/, 'timeline ruler should expose a scrubber for playhead positioning');
  assert.match(timelineSource, /onResizeItem/, 'timeline clips should wire resize controls');
  assert.match(timelineClipSource, /Trim clip start/, 'timeline clips should expose a start trim handle');
  assert.match(timelineClipSource, /Trim clip end/, 'timeline clips should expose an end trim handle');
  assert.match(timelineContextMenusSource, /Unlink selected clips/, 'timeline context menus should expose clip unlink actions');
  assert.match(timelineContextMenusSource, /Link selected clips/, 'timeline context menus should expose clip link actions');
  assert.match(timelineContextMenusSource, /Add \{trackMenu\.kind\} track/, 'timeline context menus should expose track add actions');
  assert.match(timelineContextMenusSource, /Delete \{trackMenu\.kind\} track/, 'timeline context menus should expose track delete actions');
  assert.match(timelineSource, /TimelineInteractionState/, 'timeline should keep lightweight preview state during pointer edits');
  assert.match(timelineSource, /originSourceStartSec/, 'timeline drag preview should remember the selected clip source in-point');
  assert.match(timelineSource, /originSourceDurationSec/, 'timeline drag preview should remember the selected clip source duration');
  assert.match(timelineSource, /previewTrack/, 'timeline drag preview should track the target video lane under the pointer');
  assert.match(timelineSource, /trackAtClientY/, 'timeline should infer the destination video track from pointer position');
  assert.match(timelineSource, /data-timeline-track/, 'timeline lanes should expose stable track ids for vertical clip dragging');
  assert.match(timelineSource, /maxResizeDurationForInteraction/, 'timeline drag preview should cap handle extension to available source media');
  assert.match(timelineSource, /onPointerDown/, 'timeline should start mouse and pen edits from pointer events');
  assert.match(timelineSource, /pointermove/, 'timeline should preview clip movement while dragging');
  assert.match(timelineSource, /pointerup/, 'timeline should commit movement and resize edits on release');
  assert.match(timelineSource, /application\/x-maxvideoai-timeline-node/, 'timeline should accept ready canvas media node drops');
  assert.match(timelineTrackRowSource, /timelineExternalDropGhost/, 'timeline track rows should preview external block insertions before drop');
  assert.match(timelineTrackRowSource, /data-timeline-external-drop-duration/, 'timeline external drop preview should expose the incoming clip duration for browser tests');
  assert.match(timelineProjectSidebarSource, /data-project-media-duration-sec/, 'viewer media cards should include clip duration in their timeline drag payload');
  assert.match(timelineSource, /setPointerCapture/, 'timeline should capture pointer drags instead of relying on HTML drag/drop');
  assert.match(timelineSource, /onPositionItem/, 'timeline should commit direct clip movement');
  assert.match(timelineSource, /onResizeItem/, 'timeline should commit direct clip resizing');
  assert.doesNotMatch(timelineSource, /draggable/, 'timeline clips should not use native HTML drag/drop for editor movement');
  assert.doesNotMatch(styleSource, /\.timelineClip[\s\S]*min-width:\s*160px/, 'timeline clip widths should reflect time positions instead of overlapping cut segments with a large fixed minimum');
  assert.match(timelineSource, /selectedItemId/, 'timeline should expose selected clip state');
  assert.match(timelineSource, /onCutItem/, 'timeline should wire the cut tool to selected clips');
  assert.match(timelineToolbarSource, /timelineZoomControl/, 'timeline toolbar should keep zoom controls visually compact');
  assert.match(timelineClipSource, /timelineWaveform/, 'timeline audio clips should render lightweight waveform previews');
  assert.match(workspaceSource, /WorkspaceVideoViewer[\s\S]*playheadSec=\{playheadSec\}/, 'workspace should pass the shared playhead into the montage viewer');
  assert.doesNotMatch(workspaceSource, /<WorkspaceVideoViewer(?:(?!\/>)[\s\S])*onPlayheadChange=/, 'workspace should keep playhead editing in the timeline instead of the viewer');
  assert.match(workspaceSource, /TimelineClipInspector[\s\S]*selectedItem=\{selectedTimelineItem\}/, 'viewer mode inspector should edit the selected timeline item');
  assert.match(workspaceSource, /TimelineClipInspector[\s\S]*onPatchItem=\{handlePatchTimelineItem\}/, 'viewer mode inspector should patch timeline clip edit properties');
  assert.match(timelineClipInspectorSource, /export function TimelineClipInspector/, 'timeline clip inspector should be exported');
  assert.match(timelineClipInspectorSource, /Clip inspector/, 'timeline clip inspector should render a focused empty state');
  assert.match(timelineClipInspectorSource, /formatWorkspaceTimecode/, 'timeline clip inspector should show frame-accurate clip timing');
  assert.match(timelineClipInspectorSource, /Scale/, 'timeline clip inspector should expose video scale');
  assert.match(timelineClipInspectorSource, /Position X/, 'timeline clip inspector should expose video horizontal position');
  assert.match(timelineClipInspectorSource, /Position Y/, 'timeline clip inspector should expose video vertical position');
  assert.match(timelineClipInspectorSource, /Rotation/, 'timeline clip inspector should expose video rotation');
  assert.match(timelineClipInspectorSource, /Opacity/, 'timeline clip inspector should expose video opacity');
  assert.match(timelineClipInspectorSource, /isWorkspaceTimelineVideoTrack/, 'timeline clip inspector should expose audio controls for every video track');
  assert.match(timelineClipInspectorSource, /Volume/, 'timeline clip inspector should expose clip volume');
  assert.match(timelineClipInspectorSource, /Mute clip/, 'timeline clip inspector should expose clip mute');
  assert.match(timelineClipInspectorSource, /Crossfade to next clip/, 'timeline clip inspector should expose selected-clip transition controls');
  assert.match(timelineClipInspectorSource, /onPatchItem\(selectedItem\.id/, 'timeline clip inspector should patch the selected timeline item only');
  assert.match(settingsSource, /Insert at playhead/, 'output inspector should expose insert at playhead');
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
  assert.match(librarySource, /BLOCK_TEMPLATES/, 'sidebar should expose reusable block templates');
  assert.match(librarySource, /data-block-template-kind/, 'sidebar block templates should expose a stable drag test target');
  assert.doesNotMatch(librarySource, /draggable/, 'sidebar block templates should not use native HTML drag because it can leave the custom ghost stuck');
  assert.doesNotMatch(librarySource, /dataTransfer\.setData\('application\/x-maxvideoai-node-kind'/, 'sidebar block templates should avoid native drag payloads');
  assert.match(librarySource, /maxvideoai:palette-drag-start/, 'sidebar should start pointer-based template drags for robust canvas drops');
  assert.match(librarySource, /event\.preventDefault\(\)/, 'sidebar pointer drags should prevent native text selection');
  assert.match(librarySource, /selectstart/, 'sidebar should block selectstart while a block template drag is armed');
  assert.match(librarySource, /window\.getSelection\(\)\?\.removeAllRanges/, 'sidebar should clear accidental selection after palette drags');
  assert.doesNotMatch(librarySource, /onAddNode/, 'sidebar block templates should be drag-and-drop only, not click-to-add');
  assert.doesNotMatch(librarySource, /WorkspaceAssetLibraryBrowser/, 'sidebar should not render the user media asset browser directly');
  assert.doesNotMatch(librarySource, /libraryAssets\.map/, 'library sidebar should not keep a second ad-hoc asset list');
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
  assert.match(styleSource, /\.assetBrowser/, 'studio library browser should be styled with isolated editor CSS');
  assert.match(styleSource, /\.assetLibraryUploadButton/, 'asset library upload button should be styled in isolated editor CSS');
  assert.match(styleSource, /\.assetLibraryUploadInput/, 'asset library hidden file input should be styled in isolated editor CSS');
  assert.match(styleSource, /\.assetBrowserSourceButton/, 'studio library source tabs should be styled with isolated editor CSS');
  assert.match(styleSource, /\.assetBrowserCard/, 'studio library asset cards should be styled with isolated editor CSS');
  assert.match(styleSource, /\.blockTemplateList/, 'sidebar block template list should be styled with isolated editor CSS');
  assert.match(styleSource, /\.blockTemplateList[\s\S]*flex:\s*0 0 auto/, 'sidebar block templates should keep a bounded height when Viewer mode reduces available body space');
  assert.match(styleSource, /\.blockTemplateList[\s\S]*user-select:\s*none/, 'block template labels should not be selectable during block drags');
  assert.match(styleSource, /\.blockTemplateCard/, 'sidebar block template cards should be styled with isolated editor CSS');
  assert.match(librarySource, /Canvas templates/, 'canvas sidebar should label starter templates as canvas templates');
  assert.match(librarySource, /My canvas templates/, 'canvas sidebar should reserve a place for user-saved canvas templates');
  assert.match(librarySource, /onSaveCanvasTemplate/, 'canvas sidebar should let users save the current graph as a canvas template');
  assert.match(librarySource, /onApplyUserTemplate/, 'canvas sidebar should let users re-apply a saved personal canvas template');
  assert.match(librarySource, /onDuplicateUserTemplate/, 'canvas sidebar should let users duplicate a saved canvas template');
  assert.match(librarySource, /onDeleteUserTemplate/, 'canvas sidebar should let users delete a saved canvas template');
  assert.match(workspacePersistenceSource, /USER_CANVAS_TEMPLATES_STORAGE_KEY/, 'workspace should keep personal canvas templates in local storage until backend persistence exists');
  assert.match(workspaceSource, /handleSaveCanvasTemplate/, 'workspace should own saving the current graph as a personal canvas template');
  assert.match(workspaceSource, /handleApplyUserCanvasTemplate/, 'workspace should own applying personal templates without touching timeline state');
  assert.match(styleSource, /\.templateSection[\s\S]*flex:\s*1 1 auto[\s\S]*overflow:\s*hidden/, 'starter templates should own the flexible sidebar height instead of overlapping block templates');
  assert.match(styleSource, /\.templateList[\s\S]*overflow:\s*auto/, 'starter templates should scroll inside the left sidebar when vertical space is tight');
  assert.doesNotMatch(styleSource, /\.viewerFocus \.blockTemplateList/, 'Viewer mode should not compact canvas block templates because they are not mounted there');
  assert.doesNotMatch(styleSource, /\.viewerFocus \.templateButton/, 'Viewer mode should not compact canvas templates because they are not mounted there');
  assert.match(timelineProjectSidebarSource, /Project media/, 'viewer sidebar should lead with project media');
  assert.match(timelineProjectSidebarSource, /Import media/, 'viewer sidebar should expose a media import entry point');
  assert.match(timelineProjectSidebarSource, /projectAssets/, 'viewer sidebar should render persisted project media assets, not canvas nodes');
  assert.match(projectMediaControllerSource, /onInsertProjectAsset/, 'viewer sidebar should insert imported project media at the playhead through its controller');
  assert.match(timelineProjectSidebarSource, /data-project-media-asset-id/, 'viewer sidebar should expose imported media as timeline-draggable project assets');
  assert.match(projectMediaControllerSource, /assetId/, 'viewer sidebar timeline drag payload should identify the imported project asset');
  assert.match(projectMediaControllerSource, /TIMELINE_NODE_DRAG_TYPE/, 'project media controller should own timeline drag payload creation');
  assert.match(timelineProjectSidebarSource, /projectMediaGrid/, 'viewer sidebar should present sequences, imports, and generated clips in one media grid');
  assert.match(mediaStyleSource, /\.timelineProjectSidebar/, 'project media CSS module should own the viewer media sidebar shell styles');
  assert.match(mediaStyleSource, /\.projectMediaGrid/, 'project media CSS module should own the media grid styles');
  assert.match(mediaStyleSource, /\.projectMediaTile/, 'project media CSS module should own media card styles');
  assert.doesNotMatch(styleSource, /\.projectMediaGrid/, 'main editor CSS should no longer own project media grid styles after modularization');
  assert.ok(lineCount(mediaStyleSource) <= 1200, 'project media CSS module should stay under the focused module size threshold');
  assert.match(timelineProjectSidebarSource, /data-project-media-generated-id/, 'viewer sidebar should expose generated clips as timeline-draggable media cards');
  assert.match(projectMediaControllerSource, /nodeId/, 'viewer sidebar timeline drag payload should identify generated output nodes');
  assert.match(timelineProjectSidebarSource, /New folder/, 'viewer sidebar should expose project media folder creation in the footer');
  assert.match(timelineProjectSidebarSource, /New sequence/, 'viewer sidebar should expose sequence creation in the footer');
  assert.match(timelineProjectSidebarSource, /Insert at playhead/, 'viewer sidebar should keep insertion available through the media context menu');
  assert.match(projectMediaControllerSource, /onDeleteProjectAsset/, 'viewer sidebar should let project media assets be deleted from the bin through its controller');
  assert.match(projectMediaControllerSource, /onDeleteGeneratedClip/, 'viewer sidebar should let generated clips be removed from project media through its controller');
  assert.match(workspaceStateSource, /projectAssets\?: WorkspaceAssetRecord\[\]/, 'persisted workspace state should remember imported project media assets');
  assert.match(workspaceSource, /WorkspaceProjectMediaLibraryModal/, 'orchestrator should open a project media import modal in Viewer mode');
  assert.match(workspaceSource, /useWorkspaceEditorAssetLibrary\(isProjectMediaPickerOpen \? null : undefined\)/, 'project media import should load the signed-in library only while its modal is open');
  assert.match(projectMediaLibraryModalSource, /PROJECT_MEDIA_UPLOAD_ACCEPT/, 'project media library modal should accept direct image, video, and audio uploads');
  assert.match(projectMediaLibraryModalSource, /PROJECT_MEDIA_UPLOAD_ENDPOINTS/, 'project media uploads should reuse the app media upload endpoints');
  assert.match(projectMediaLibraryModalSource, /workspaceLibraryAssetFromUploadedAsset/, 'project media uploads should normalize into reusable library assets');
  assert.match(workspaceSource, /handleInsertProjectAssetToTimeline/, 'orchestrator should insert imported project media into the timeline');
  assert.match(workspaceSource, /handleDropProjectAssetToTimeline/, 'orchestrator should insert dragged project media on the target timeline track');
  assert.match(workspaceSource, /retargetWorkspaceTimelineItemsForTrack\(draftItems, targetTrack\)/, 'project media drops should honor the compatible target timeline track');
  assert.match(timelineSource, /onProjectAssetDropToTimeline/, 'timeline should route project media drops separately from canvas node drops');
  assert.match(typesSource, /onOpenAssetLibrary\?:/, 'node data should carry a media library open handler');
  assert.match(styleSource, /\.mediaPickerEmpty/, 'empty media picker state should be styled in isolated editor CSS');
  assert.match(styleSource, /\.processingPreview/, 'processing output placeholders should be styled in isolated editor CSS');
  assert.match(styleSource, /\.previewVideo/, 'playable video previews should be styled in isolated editor CSS');
  assert.match(styleSource, /\.videoViewerShell/, 'central montage viewer should be styled in isolated editor CSS');
  assert.match(styleSource, /\.programMonitor/, 'central viewer should style a program monitor shell');
  assert.match(styleSource, /\.programZoomControl/, 'program monitor should style zoom as a display control');
  assert.match(styleSource, /\.programFrameViewport[\s\S]*container-type:\s*size/, 'program monitor viewport should provide size containment for aspect-ratio fitting');
  assert.match(styleSource, /\.programFrameViewport[\s\S]*overflow:\s*auto/, 'program monitor viewport should allow inspection of 100% sequence pixels without resizing the app shell');
  assert.match(styleSource, /\.programFrame/, 'central viewer should style a project-ratio program frame');
  assert.match(styleSource, /\.viewerVideoLayer/, 'program monitor should stack stable video layers for smoother sequence playback');
  assert.match(styleSource, /\.viewerVideoLayer[\s\S]*transform-origin:\s*center/, 'program monitor layers should transform around the project frame center');
  assert.match(styleSource, /\.viewerVideoLayerVisible/, 'program monitor should expose the active video layer without recreating the video source');
  assert.match(styleSource, /\.programFrameFit/, 'program monitor should fit the full sequence frame by default');
  assert.match(styleSource, /\.programFrameScaled/, 'program monitor should support pixel-based sequence zoom levels');
  assert.match(styleSource, /--workspace-project-aspect-ratio/, 'program frame should use a project aspect-ratio CSS variable');
  assert.match(styleSource, /--workspace-project-aspect-width/, 'program frame should use numeric aspect width for contained fitting');
  assert.match(styleSource, /--workspace-project-aspect-height/, 'program frame should use numeric aspect height for contained fitting');
  assert.match(styleSource, /--workspace-project-preview-width/, 'program frame should use project pixel width for non-Fit monitor zoom');
  assert.match(styleSource, /--workspace-project-preview-height/, 'program frame should use project pixel height for non-Fit monitor zoom');
  assert.match(styleSource, /--workspace-program-zoom-scale/, 'program frame should use monitor zoom scale separately from project resolution');
  assert.doesNotMatch(styleSource, /\.viewerSettingsSlot/, 'viewer should not reserve a footer slot for project settings');
  assert.doesNotMatch(styleSource, /\.sequenceSettingsButton/, 'viewer should not style a footer project settings button');
  assert.match(styleSource, /\.sequenceSettingsOverlay/, 'viewer should style the project settings dialog overlay');
  assert.match(styleSource, /\.sequenceSettingsDialog/, 'viewer should style the project settings dialog');
  assert.match(styleSource, /\.sequenceSettingsFields/, 'viewer should style sequence fields inside the dialog');
  assert.doesNotMatch(styleSource, /\.viewerSequenceControls/, 'viewer should not style always-visible sequence settings controls');
  assert.match(styleSource, /\.timelineClipSelected/, 'selected timeline clips should be visually distinct');
  assert.match(cssBlock(styleSource, '.timelinePanel'), /min-width:\s*0/, 'timeline panel should shrink inside the app shell instead of widening the page when zoomed');
  assert.match(cssBlock(styleSource, '.timelinePanel'), /overflow:\s*hidden/, 'timeline panel should keep horizontal zoom overflow inside timeline scrollers');
  assert.match(styleSource, /\.timelineViewport/, 'timeline should use one shared scroll viewport for ruler and all tracks');
  assert.match(cssBlock(styleSource, '.timelineViewport'), /overflow:\s*auto/, 'timeline zoom should create one shared scrollbar instead of per-track scrollbars');
  assert.match(cssBlock(styleSource, '.trackLane'), /overflow:\s*visible/, 'individual timeline lanes should not render native horizontal scrollbars');
  assert.match(cssBlock(styleSource, '.trackLabel'), /position:\s*sticky/, 'timeline track labels should stay pinned while the shared viewport scrolls horizontally');
  assert.match(styleSource, /\.timelineToolButton/, 'timeline editing tools should be styled in isolated editor CSS');
  assert.match(styleSource, /\.timelineToolGroup/, 'timeline editing tool group should be styled in isolated editor CSS');
  assert.doesNotMatch(styleSource, /\.timelineModeControl/, 'timeline trim tools should not keep segmented mode control styling');
  assert.match(styleSource, /\.timelineInsertActions/, 'output inspector insert actions should be styled in isolated editor CSS');
  assert.match(styleSource, /\.timelineZoomControl/, 'timeline zoom control should be styled in isolated editor CSS');
  assert.match(styleSource, /\.timelineWaveform/, 'timeline audio waveforms should be styled in isolated editor CSS');
  assert.match(styleSource, /\.timelineInspectorGroup/, 'timeline clip inspector groups should be styled in isolated editor CSS');
  assert.match(styleSource, /\.timelineInspectorControlRow/, 'timeline clip inspector slider rows should be styled in isolated editor CSS');
  assert.match(styleSource, /\.settingsRange/, 'timeline clip inspector ranges should be styled in isolated editor CSS');
  assert.match(styleSource, /\.timelineInspectorCheckbox/, 'timeline clip inspector toggles should be styled in isolated editor CSS');
  assert.match(styleSource, /\.timelineInspectorResetButton/, 'timeline clip inspector reset button should be styled in isolated editor CSS');
  assert.match(styleSource, /\.timelinePlayhead/, 'timeline playhead should be styled in isolated editor CSS');
  assert.match(styleSource, /\.timelinePlayhead::before/, 'timeline playhead should draw the visible line from an interactive handle');
  assert.match(styleSource, /\.timelinePlayhead[\s\S]*pointer-events:\s*auto/, 'timeline playhead should be directly draggable instead of decorative only');
  assert.match(styleSource, /\.timelineRulerPlayhead/, 'timeline should expose a dedicated ruler playhead handle');
  assert.match(styleSource, /--timeline-track-label-width:\s*150px/, 'timeline should define the track label width once for ruler and lane alignment');
  assert.match(styleSource, /--timeline-track-lane-padding-x:\s*10px/, 'timeline should define the lane padding once for ruler and lane alignment');
  assert.match(styleSource, /\.timelineRulerLane/, 'timeline ruler should align with track lane content after the sticky track label');
  assert.match(styleSource, /\.timelineTrack[\s\S]*grid-template-columns:\s*var\(--timeline-track-label-width\) minmax\(0,\s*1fr\)/, 'timeline track layout should share the same label width variable as the ruler');
  assert.match(styleSource, /\.timelineRulerInner span[\s\S]*font-variant-numeric:\s*tabular-nums/, 'timeline ruler timecodes should use tabular frame digits');
  assert.match(styleSource, /\.trackLaneContent[\s\S]*cursor:\s*ew-resize/, 'empty timeline lanes should communicate playhead scrubbing');
  assert.match(styleSource, /\.timelineSnapGuide/, 'timeline snap guide should be styled in isolated editor CSS');
  assert.match(styleSource, /\.timelineScrubber/, 'timeline scrubber should be styled in isolated editor CSS');
  assert.match(styleSource, /\.trimHandle/, 'timeline trim handles should be styled in isolated editor CSS');
  assert.match(styleSource, /\.assetLibraryOverlay/, 'asset library modal overlay should be styled in isolated editor CSS');
  assert.match(styleSource, /\.assetLibraryModal/, 'asset library modal shell should be styled in isolated editor CSS');
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
      assert.deepEqual(node.data.sourceHandles ?? [], ['generated_output'], `${node.id} should expose one reusable generated output handle`);
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
  assert.equal(pending.outputEdge.sourceHandle, 'generated_output');
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

  const importedVideoItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'asset-video-a',
    title: 'Imported Clip',
    asset: {
      id: 'imported-video',
      kind: 'video',
      filename: 'phone-shot.mp4',
      subtitle: 'Video · upload',
      url: '/uploads/phone-shot.mp4',
      thumbUrl: '/uploads/phone-shot.jpg',
      durationSec: 9,
    },
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
    WORKSPACE_TIMELINE_EXPORT_QUALITY_PRESETS,
    buildWorkspaceTimelineVideoExportRequest,
    buildWorkspaceTimelineEdl,
    buildWorkspaceTimelineRenderManifest,
    serializeWorkspaceTimelineVideoExportRequest,
    serializeWorkspaceTimelineRenderManifest,
    workspaceTimelineExportReadinessChecks,
    workspaceTimelineRenderReadinessLabel,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render');
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
    createdAt: '2026-06-06T10:00:00.000Z',
  });
  const videoTrack = manifest.tracks.find((track) => track.id === 'video');
  const linkedAudioTrack = manifest.tracks.find((track) => track.id === 'audio');
  const musicTrack = manifest.tracks.find((track) => track.id === 'audio-2');

  assert.equal(manifest.status, 'ready', 'ready timelines should produce a renderable manifest');
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
  assert.equal(buildWorkspaceUserLibraryUrl(null), '/api/media-library/assets?limit=60');

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
  const styleSource = source(stylesPath);
  assert.match(
    styleSource,
    /\.assetLibraryModal\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\)/,
    'asset library modal should constrain its browser child to the available modal height'
  );
  assert.match(
    styleSource,
    /\.assetBrowserModal\s*\{[\s\S]*height:\s*100%/,
    'asset library browser should fill the constrained modal row'
  );
  assert.match(
    styleSource,
    /\.assetBrowserModal\s+\.assetBrowserGrid\s*\{[\s\S]*overflow-y:\s*auto/,
    'asset library modal grid should be the vertical scroll container'
  );
});
