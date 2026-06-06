import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  createDevBlocksWorkspaceTemplate,
  createProductAdWorkspaceTemplate,
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
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import type { EngineCaps } from '../frontend/types/engines';

const root = process.cwd();
const workspaceDir = join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace');
const pagePath = join(workspaceDir, 'page.tsx');
const workspacePagePath = join(workspaceDir, 'WorkspacePage.client.tsx');
const canvasPath = join(workspaceDir, '_components/WorkspaceCanvas.client.tsx');
const assetLibraryModalPath = join(workspaceDir, '_components/WorkspaceAssetLibraryModal.tsx');
const assetLibraryBrowserPath = join(workspaceDir, '_components/WorkspaceAssetLibraryBrowser.tsx');
const libraryPath = join(workspaceDir, '_components/NodeLibrarySidebar.tsx');
const settingsPath = join(workspaceDir, '_components/NodeSettingsPanel.tsx');
const timelinePath = join(workspaceDir, '_components/WorkspaceTimeline.tsx');
const videoViewerPath = join(workspaceDir, '_components/WorkspaceVideoViewer.tsx');
const nodeTypesPath = join(workspaceDir, '_components/nodes/workspace-node-types.tsx');
const edgeTypesPath = join(workspaceDir, '_components/edges/workspace-smart-edge.tsx');
const typesPath = join(workspaceDir, '_lib/workspace-types.ts');
const capabilitiesPath = join(workspaceDir, '_lib/workspace-capabilities.ts');
const generationPath = join(workspaceDir, '_lib/workspace-generation.ts');
const pricingPath = join(workspaceDir, '_lib/workspace-pricing.ts');
const handleDropPath = join(workspaceDir, '_lib/workspace-handle-drop.ts');
const timelineEditingPath = join(workspaceDir, '_lib/workspace-timeline-editing.ts');
const libraryAssetsPath = join(workspaceDir, '_lib/workspace-library-assets.ts');
const renderEdgesPath = join(workspaceDir, '_lib/workspace-render-edges.ts');
const templatesPath = join(workspaceDir, '_lib/workspace-templates.ts');
const editorAssetLibraryHookPath = join(workspaceDir, '_hooks/useWorkspaceEditorAssetLibrary.ts');
const pricingHookPath = join(workspaceDir, '_hooks/useWorkspaceShotPricing.ts');
const stylesPath = join(workspaceDir, 'maxvideoai-editor.module.css');
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

test('MaxVideoAI editor workspace is an isolated authenticated app route', () => {
  assert.ok(existsSync(pagePath), 'editor workspace route should live under the authenticated /app studio workspace');
  assert.ok(existsSync(workspacePagePath), 'editor workspace client orchestrator should be route-local');
  assert.ok(existsSync(canvasPath), 'canvas surface should live in a route-local component');
  assert.ok(existsSync(assetLibraryModalPath), 'asset picker modal should live in a route-local editor component');
  assert.ok(existsSync(assetLibraryBrowserPath), 'asset picker browser should mirror the app library structure in route-local editor CSS');
  assert.ok(existsSync(libraryPath), 'block template sidebar should live in a route-local component');
  assert.ok(existsSync(settingsPath), 'node settings panel should live in a route-local component');
  assert.ok(existsSync(timelinePath), 'timeline should live in a route-local component');
  assert.ok(existsSync(videoViewerPath), 'video montage viewer should live in a route-local component');
  assert.ok(existsSync(nodeTypesPath), 'custom node renderers should live in a route-local node module');
  assert.ok(existsSync(edgeTypesPath), 'custom edge renderers should live in a route-local edge module');
  assert.ok(existsSync(stylesPath), 'editor styling should be isolated in a route-local CSS module');

  const pageSource = source(pagePath);
  const workspaceSource = source(workspacePagePath);
  const styleSource = source(stylesPath);
  assert.match(pageSource, /from '\.\/WorkspacePage\.client'/, 'route should delegate to the editor workspace orchestrator');
  assert.doesNotMatch(pageSource, /AppClient/, 'editor route must not reuse the existing video workspace AppClient');
  assert.match(workspaceSource, /WorkspaceCanvas/, 'orchestrator should compose the canvas surface');
  assert.match(workspaceSource, /WorkspaceVideoViewer/, 'orchestrator should compose a central montage video viewer');
  assert.match(workspaceSource, /NodeLibrarySidebar/, 'orchestrator should compose the block template library');
  assert.match(workspaceSource, /NodeSettingsPanel/, 'orchestrator should compose the settings inspector');
  assert.match(workspaceSource, /WorkspaceTimeline/, 'orchestrator should compose the bottom timeline');
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
  assert.match(workspaceSource, /normalizeGeneratedOutputEdges/, 'orchestrator should normalize stale output edge handles from persisted editor state');
  assert.match(workspaceSource, /normalizeShotOutputNodes/, 'orchestrator should normalize stale generated-shot output handles from persisted editor state');
  assert.match(workspaceSource, /normalizeShotOutputEdges/, 'orchestrator should normalize stale generated-shot source edge handles');
  assert.match(workspaceSource, /normalizeWorkspaceEdgeTypes/, 'orchestrator should normalize stale saved edge types');
  assert.match(styleSource, /react-flow__handle-left/, 'local editor CSS should position left handles without inheriting React Flow global CSS');
  assert.match(styleSource, /react-flow__handle-right/, 'local editor CSS should position right handles without inheriting React Flow global CSS');

  const visitorAccessSource = source(visitorAccessPath);
  assert.match(visitorAccessSource, /normalized === '\/app\/studio\/workspace'/, 'editor route should follow existing visitor workspace browse access');
});

test('MaxVideoAI editor owns graph, node, generation, and capability contracts', () => {
  assert.ok(existsSync(typesPath), 'workspace graph and timeline contracts should live in _lib/workspace-types.ts');
  assert.ok(existsSync(capabilitiesPath), 'model capability mapping should live in _lib/workspace-capabilities.ts');
  assert.ok(existsSync(generationPath), 'workspace generation adapter should live in _lib/workspace-generation.ts');
  assert.ok(existsSync(pricingPath), 'workspace pricing adapter should live in _lib/workspace-pricing.ts');
  assert.ok(existsSync(handleDropPath), 'handle-drop node creation should live in a pure route-local helper');
  assert.ok(existsSync(timelineEditingPath), 'timeline editing helpers should live in a pure route-local helper');
  assert.ok(existsSync(libraryAssetsPath), 'studio library assets should live in a pure route-local helper');
  assert.ok(existsSync(editorAssetLibraryHookPath), 'studio should load the signed-in user media library through a route-local hook');
  assert.ok(existsSync(pricingHookPath), 'workspace pricing hook should live in _hooks/useWorkspaceShotPricing.ts');
  assert.ok(existsSync(renderEdgesPath), 'renderable edge filtering should live in a pure route-local helper');
  assert.ok(existsSync(templatesPath), 'starter templates should live in _lib/workspace-templates.ts');

  const canvasSource = source(canvasPath);
  const assetLibraryBrowserSource = source(assetLibraryBrowserPath);
  const edgeSource = source(edgeTypesPath);
  const librarySource = source(libraryPath);
  const assetLibraryModalSource = source(assetLibraryModalPath);
  const nodeSource = source(nodeTypesPath);
  const settingsSource = source(settingsPath);
  const workspaceSource = source(workspacePagePath);
  const capabilitySource = source(capabilitiesPath);
  const generationSource = source(generationPath);
  const pricingSource = source(pricingPath);
  const handleDropSource = source(handleDropPath);
  const timelineEditingSource = source(timelineEditingPath);
  const libraryAssetsSource = source(libraryAssetsPath);
  const editorAssetLibraryHookSource = source(editorAssetLibraryHookPath);
  const pricingHookSource = source(pricingHookPath);
  const renderEdgesSource = source(renderEdgesPath);
  const templateSource = source(templatesPath);
  const typesSource = source(typesPath);
  const styleSource = source(stylesPath);
  const timelineSource = source(timelinePath);
  const videoViewerSource = source(videoViewerPath);
  const shotInputDockStyle = cssBlock(styleSource, '.shotInputDock');

  assert.match(canvasSource, /@xyflow\/react/, 'canvas should use React Flow for pan, zoom, nodes, handles, and edges');
  assert.match(canvasSource, /MiniMap/, 'canvas should expose a mini-map');
  assert.match(canvasSource, /Controls/, 'canvas should expose graph controls');
  assert.match(canvasSource, /Background/, 'canvas should render an infinite-canvas background');
  assert.match(canvasSource, /onNodeClick/, 'canvas should select a node when it is clicked');
  assert.match(canvasSource, /onConnectStart/, 'canvas should track drags that start from a connector handle');
  assert.match(canvasSource, /onConnectEnd/, 'canvas should create a matching node when a connector drag ends on the pane');
  assert.match(canvasSource, /onDragOver/, 'canvas should accept block template drags from the sidebar');
  assert.match(canvasSource, /onDrop/, 'canvas should create dropped block templates on the pane');
  assert.match(canvasSource, /maxvideoai:palette-drag-start/, 'canvas should also support pointer-based block template drags from the sidebar');
  assert.match(canvasSource, /paletteDragPreview/, 'canvas should show a ghost block while dragging a sidebar template');
  assert.match(canvasSource, /screenToFlowPosition/, 'canvas should convert dropped sidebar templates into flow coordinates');
  assert.match(canvasSource, /application\/x-maxvideoai-node-kind/, 'canvas should read the block template drag payload');
  assert.match(canvasSource, /ViewportPortal/, 'canvas should render handle-drag previews in flow coordinates');
  assert.match(canvasSource, /workspaceGhostNode/, 'canvas should show a ghost block while dragging from a connector');
  assert.match(canvasSource, /workspaceGhostLink/, 'canvas should show a ghost link while dragging from a connector');
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

  assert.match(capabilitySource, /getBaseEngines|listFalEngines/, 'capabilities should derive from existing engine config');
  assert.doesNotMatch(capabilitySource, /const WORKSPACE_ENGINE_CAPABILITIES = \[/, 'capabilities should not be a copied fake engine roster');
  assert.match(capabilitySource, /export function getWorkspaceModelCapabilities/, 'capabilities helper should expose model capabilities');
  assert.match(capabilitySource, /export function validateShotConnections/, 'capabilities helper should validate connected shot inputs');
  assert.match(capabilitySource, /export function isWorkspaceConnectionCompatible/, 'capabilities helper should reject graph links between incompatible media families');
  assert.match(capabilitySource, /export function workspaceConnectionCapacity/, 'capabilities helper should expose per-input remaining connection capacity');
  assert.match(capabilitySource, /sanitizeConnectorLabel/, 'capabilities should remove copied "up to N" counts from connector labels');
  assert.match(capabilitySource, /export function suggestWorkspaceModels/, 'capabilities helper should suggest compatible models');
  assert.match(capabilitySource, /input_connectors/, 'capabilities should expose engine-derived editor input connectors');
  assert.match(capabilitySource, /getWorkspaceShotTargetHandles/, 'capabilities should expose shot target handles for the selected engine');
  assert.match(capabilitySource, /resolveWorkspaceWorkflowType/, 'capabilities should infer the internal generation workflow from connected inputs');
  assert.match(capabilitySource, /resolveWorkspaceRenderOptions/, 'capabilities should expose engine-derived render options');
  assert.match(capabilitySource, /workspaceAudioEnabledForRequest/, 'capabilities should centralize when audio can be sent to generate and pricing');
  assert.match(typesSource, /WorkspaceOutputStatus/, 'workspace outputs should type placeholder, processing, and ready states');
  assert.match(typesSource, /WorkspaceRenderOption/, 'workspace capabilities should type render options separately from graph inputs');
  assert.match(typesSource, /mediaUrl\?: string \| null/, 'timeline clips should carry a playable media URL for the central viewer');
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
  assert.match(timelineEditingSource, /export function normalizeWorkspaceTimelineStarts/, 'timeline helper should recalculate clip start times per track');
  assert.match(timelineEditingSource, /export function moveWorkspaceTimelineItem/, 'timeline helper should reorder clips predictably');
  assert.match(timelineEditingSource, /export function reorderWorkspaceTimelineItem/, 'timeline helper should support drag/drop target positions');
  assert.match(timelineEditingSource, /export function splitWorkspaceTimelineItem/, 'timeline helper should split selected clips for cut editing');
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
  assert.match(editorAssetLibraryHookSource, /setSource/, 'studio user library hook should expose a source setter to the browser UI');
  assert.match(pricingHookSource, /runPreflight/, 'workspace pricing hook should call the existing generate video preflight API');
  assert.match(workspaceSource, /useWorkspaceShotPricing/, 'orchestrator should inject live shot pricing estimates into nodes');
  assert.match(workspaceSource, /createPendingWorkspaceOutput/, 'orchestrator should create or reuse an output placeholder as soon as generation starts');
  assert.match(workspaceSource, /findGeneratedOutputNodeForShot/, 'orchestrator should reuse an upstream output block when one already exists');
  assert.match(workspaceSource, /onCreateNodeFromHandleDrop/, 'orchestrator should wire handle-drop node creation into the canvas');
  assert.match(workspaceSource, /isWorkspaceConnectionCompatible/, 'orchestrator should reject incompatible graph links before adding edges');
  assert.match(workspaceSource, /workspaceConnectionCapacity/, 'orchestrator should reject graph links when an input connector has no remaining capacity');
  assert.match(workspaceSource, /onCreateNodeFromPaletteDrop/, 'orchestrator should wire sidebar block-template drops into the canvas');
  assert.match(workspaceSource, /WorkspaceAssetLibraryModal/, 'orchestrator should open the editor asset library from empty media nodes');
  assert.match(workspaceSource, /selectedTimelineItemId/, 'orchestrator should track which timeline clip controls the montage viewer');
  assert.match(workspaceSource, /handleCutTimelineItem/, 'orchestrator should wire basic cut editing from the bottom timeline');
  assert.match(workspaceSource, /handleReorderTimelineItem/, 'orchestrator should wire drag/drop timeline reordering');
  assert.match(workspaceSource, /useWorkspaceEditorAssetLibrary/, 'orchestrator should feed the picker from the signed-in user media library');
  assert.doesNotMatch(workspaceSource, /sidebarLibrary\s*=\s*useWorkspaceEditorAssetLibrary\(null\)/, 'orchestrator should not load the user media library directly in the sidebar');
  assert.match(workspaceSource, /assetPickerNodeId/, 'orchestrator should track which media node is being filled from the library');
  assert.match(workspaceSource, /workspaceAssetRecordFromLibraryAsset/, 'orchestrator should store selected library assets on media nodes');
  assert.match(renderEdgesSource, /filterRenderableWorkspaceEdges/, 'renderable edge helper should omit edges whose handles are unavailable');
  assert.match(renderEdgesSource, /isWorkspaceConnectionCompatible/, 'renderable edge helper should omit persisted incompatible media-family edges');
  assert.match(workspaceSource, /filterRenderableWorkspaceEdges/, 'orchestrator should avoid passing invalid handle edges to React Flow');
  assert.match(templateSource, /createProductAdWorkspaceTemplate/, 'Product Ad starter template should be implemented');
  assert.match(templateSource, /type: 'workspace-smart'/, 'workspace edges should use the custom smart edge type');
  assert.match(templateSource, /createDevBlocksWorkspaceTemplate/, 'Dev Blocks starter template should be implemented');
  assert.match(templateSource, /id: 'dev-blocks'/, 'Dev Blocks should be exposed as a starter template');
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
  assert.match(videoViewerSource, /<video[\s\S]*controls/, 'viewer should play selected timeline video clips');
  assert.match(videoViewerSource, /selectedItemId/, 'viewer should follow timeline clip selection');
  assert.match(videoViewerSource, /onSelectItem/, 'viewer should let montage strip selection update the active clip');
  assert.match(timelineSource, /Scissors/, 'timeline should expose a cut tool');
  assert.match(timelineSource, /draggable/, 'timeline clips should be draggable');
  assert.match(timelineSource, /onDragStart/, 'timeline should start drag reordering from clips');
  assert.match(timelineSource, /onDrop/, 'timeline should accept dropped clips for reordering');
  assert.match(timelineSource, /selectedItemId/, 'timeline should expose selected clip state');
  assert.match(timelineSource, /onCutItem/, 'timeline should wire the cut tool to selected clips');
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
  assert.match(librarySource, /draggable/, 'sidebar block templates should be draggable');
  assert.match(librarySource, /dataTransfer\.setData\('application\/x-maxvideoai-node-kind'/, 'sidebar should put node kind in the drag payload');
  assert.match(librarySource, /maxvideoai:palette-drag-start/, 'sidebar should start pointer-based template drags for robust canvas drops');
  assert.match(librarySource, /onAddNode\(template\.kind\)/, 'sidebar block templates should keep click-to-add as a fallback');
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
  assert.match(styleSource, /\.blockTemplateCard/, 'sidebar block template cards should be styled with isolated editor CSS');
  assert.match(typesSource, /onOpenAssetLibrary\?:/, 'node data should carry a media library open handler');
  assert.match(styleSource, /\.mediaPickerEmpty/, 'empty media picker state should be styled in isolated editor CSS');
  assert.match(styleSource, /\.processingPreview/, 'processing output placeholders should be styled in isolated editor CSS');
  assert.match(styleSource, /\.previewVideo/, 'playable video previews should be styled in isolated editor CSS');
  assert.match(styleSource, /\.videoViewerShell/, 'central montage viewer should be styled in isolated editor CSS');
  assert.match(styleSource, /\.timelineClipSelected/, 'selected timeline clips should be visually distinct');
  assert.match(styleSource, /\.timelineToolButton/, 'timeline editing tools should be styled in isolated editor CSS');
  assert.match(styleSource, /\.assetLibraryOverlay/, 'asset library modal overlay should be styled in isolated editor CSS');
  assert.match(styleSource, /\.assetLibraryModal/, 'asset library modal shell should be styled in isolated editor CSS');
  for (const nodeType of ["type: 'asset-image'", "type: 'asset-video'", "type: 'asset-audio'", "type: 'text-prompt'", "type: 'shot'", "type: 'output'"]) {
    assert.match(templateSource, new RegExp(nodeType), `Dev Blocks template should include ${nodeType}`);
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
    moveWorkspaceTimelineItem,
    reorderWorkspaceTimelineItem,
    splitWorkspaceTimelineItem,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing');
  const items: WorkspaceTimelineItem[] = [
    {
      id: 'clip-a',
      outputNodeId: 'output-a',
      track: 'video',
      title: 'Clip A',
      durationSec: 8,
      startSec: 0,
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
      track: 'music',
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
    moved.filter((item) => item.track === 'music').map((item) => [item.id, item.startSec]),
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
    split.filter((item) => item.track === 'video').map((item) => [item.id, item.durationSec, item.startSec]),
    [
      ['clip-a', 3, 0],
      ['clip-a-split', 5, 3],
      ['clip-b', 6, 8],
    ],
    'cut should split a clip at the requested offset and keep subsequent clips aligned'
  );
});

test('MaxVideoAI editor library assets map to media node records', async () => {
  assert.ok(existsSync(libraryAssetsPath), 'workspace library asset helper should exist before mapping node media');
  const {
    WORKSPACE_LIBRARY_ASSETS,
    WORKSPACE_LIBRARY_SOURCE_OPTIONS,
    buildWorkspaceUserLibraryUrl,
    normalizeWorkspaceUserLibraryPayload,
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
    ['all', 'upload', 'generated'],
    'studio library should start from the same source filter structure as the app library'
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
          kind: 'video',
          mime: 'video/mp4',
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
