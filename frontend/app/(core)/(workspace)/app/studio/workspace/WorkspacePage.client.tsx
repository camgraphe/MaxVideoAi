'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react';
import { Download, GitBranch, PanelRight, Play, RefreshCcw, Settings, Share2, Sparkles } from 'lucide-react';
import { NodeLibrarySidebar } from './_components/NodeLibrarySidebar';
import { NodeSettingsPanel } from './_components/NodeSettingsPanel';
import { WorkspaceCanvas, type WorkspaceHandleDropRequest, type WorkspacePaletteDropRequest } from './_components/WorkspaceCanvas.client';
import { WorkspaceAssetLibraryModal } from './_components/WorkspaceAssetLibraryModal';
import { WorkspaceTimeline } from './_components/WorkspaceTimeline';
import { WorkspaceVideoViewer } from './_components/WorkspaceVideoViewer';
import { useWorkspaceEditorAssetLibrary } from './_hooks/useWorkspaceEditorAssetLibrary';
import { useWorkspaceShotPricing } from './_hooks/useWorkspaceShotPricing';
import {
  getWorkspaceModelCapability,
  getWorkspaceModelCapabilities,
  getWorkspaceShotInputConnectors,
  getWorkspaceShotTargetHandles,
  isWorkspaceConnectionCompatible,
  validateShotConnections,
  workspaceConnectionCapacity,
} from './_lib/workspace-capabilities';
import { createPendingWorkspaceOutput, submitWorkspaceShotGeneration } from './_lib/workspace-generation';
import type {
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceInputConnector,
  WorkspaceNodeKind,
  WorkspaceShotSettings,
  WorkspaceTemplateId,
  WorkspaceTimelineItem,
} from './_lib/workspace-types';
import { createWorkspaceHandleDropNode, resolveWorkspaceHandleDropDraft } from './_lib/workspace-handle-drop';
import { workspaceAssetRecordFromLibraryAsset, type WorkspaceLibraryAsset } from './_lib/workspace-library-assets';
import {
  WORKSPACE_TEMPLATE_SUMMARIES,
  createStarterWorkspaceTemplate,
  createWorkspaceEdge,
  inferWorkspaceEdgeKind,
} from './_lib/workspace-templates';
import { filterRenderableWorkspaceEdges } from './_lib/workspace-render-edges';
import {
  moveWorkspaceTimelineItem,
  reorderWorkspaceTimelineItem,
  splitWorkspaceTimelineItem,
} from './_lib/workspace-timeline-editing';
import styles from './maxvideoai-editor.module.css';

const STORAGE_KEY = 'maxvideoai.editor.workspace.v1';

type PersistedWorkspaceState = {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  timelineItems: WorkspaceTimelineItem[];
  activeTemplateId: WorkspaceTemplateId;
};

const OUTPUT_ONLY_SOURCE_HANDLES: Partial<Record<WorkspaceNodeKind, WorkspaceEdgeKind>> = {
  'asset-image': 'reference',
  'asset-video': 'video_reference',
  'asset-audio': 'audio',
  'text-prompt': 'prompt',
};

const GENERATED_OUTPUT_TARGET_HANDLE: WorkspaceEdgeKind = 'generated_output';
const GENERATED_OUTPUT_SOURCE_HANDLE: WorkspaceEdgeKind = 'video_reference';
const WORKSPACE_EDGE_TYPE = 'workspace-smart';

function isPlayableVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

function outputOnlySourceHandle(node: WorkspaceGraphNode): WorkspaceEdgeKind | null {
  return OUTPUT_ONLY_SOURCE_HANDLES[node.data.kind] ?? null;
}

function normalizeOutputOnlySourceNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.map((node) => {
    const sourceHandle = outputOnlySourceHandle(node);
    if (!sourceHandle) return node;
    if (node.data.sourceHandles?.length === 1 && node.data.sourceHandles[0] === sourceHandle && !node.data.targetHandles?.length) {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        targetHandles: [],
        sourceHandles: [sourceHandle],
      },
    };
  });
}

function normalizeOutputOnlySourceEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  const sourceHandleByNodeId = new Map(
    nodes
      .map((node): [string, WorkspaceEdgeKind] | null => {
        const sourceHandle = outputOnlySourceHandle(node);
        return sourceHandle ? [node.id, sourceHandle] : null;
      })
      .filter((entry): entry is [string, WorkspaceEdgeKind] => Boolean(entry))
  );

  return edges.map((edge) => {
    const sourceHandle = sourceHandleByNodeId.get(edge.source);
    if (!sourceHandle || edge.sourceHandle === sourceHandle) return edge;
    return {
      ...edge,
      sourceHandle,
    };
  });
}

function normalizeGeneratedOutputNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.map((node) => {
    if (node.data.kind !== 'output') return node;
    if (
      node.data.targetHandles?.length === 1 &&
      node.data.targetHandles[0] === GENERATED_OUTPUT_TARGET_HANDLE &&
      node.data.sourceHandles?.length === 1 &&
      node.data.sourceHandles[0] === GENERATED_OUTPUT_SOURCE_HANDLE
    ) {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        targetHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
        sourceHandles: [GENERATED_OUTPUT_SOURCE_HANDLE],
      },
    };
  });
}

function normalizeGeneratedOutputEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  const outputNodeIds = new Set(nodes.filter((node) => node.data.kind === 'output').map((node) => node.id));
  return edges.map((edge) => {
    const nextEdge = { ...edge };
    if (outputNodeIds.has(edge.target) && edge.data?.kind === GENERATED_OUTPUT_TARGET_HANDLE) {
      nextEdge.targetHandle = GENERATED_OUTPUT_TARGET_HANDLE;
    }
    if (outputNodeIds.has(edge.source)) {
      nextEdge.sourceHandle = GENERATED_OUTPUT_SOURCE_HANDLE;
    }
    return nextEdge;
  });
}

function normalizePlaceholderOutputNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.map((node) => {
    const output = node.data.output;
    if (node.data.kind !== 'output' || !output || output.status || output.kind !== 'video' || isPlayableVideoUrl(output.url)) {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        subtitle: 'Waiting for generated media',
        output: {
          ...output,
          status: 'placeholder',
          thumbUrl: null,
          url: null,
        },
      },
    };
  });
}

function normalizeShotOutputNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.map((node) => {
    if (node.data.kind !== 'shot') return node;
    if (node.data.sourceHandles?.length === 1 && node.data.sourceHandles[0] === GENERATED_OUTPUT_TARGET_HANDLE) {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        sourceHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
      },
    };
  });
}

function normalizeShotOutputEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  const shotNodeIds = new Set(nodes.filter((node) => node.data.kind === 'shot').map((node) => node.id));
  return edges.map((edge) => {
    if (!shotNodeIds.has(edge.source) || edge.sourceHandle === GENERATED_OUTPUT_TARGET_HANDLE) return edge;
    return {
      ...edge,
      sourceHandle: GENERATED_OUTPUT_TARGET_HANDLE,
    };
  });
}

function normalizeWorkspaceEdgeTypes(edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  return edges.map((edge) => (edge.type === WORKSPACE_EDGE_TYPE ? edge : { ...edge, type: WORKSPACE_EDGE_TYPE }));
}

function normalizeTimelineMediaUrls(nodes: WorkspaceGraphNode[], items: WorkspaceTimelineItem[]): WorkspaceTimelineItem[] {
  return items.map((item) => {
    if (item.mediaUrl) return item;
    const output = nodes.find((node) => node.id === item.outputNodeId)?.data.output;
    const mediaUrl = output?.kind === 'video' && isPlayableVideoUrl(output.url) ? output.url : null;
    if (!mediaUrl) return item;
    return {
      ...item,
      mediaUrl,
      thumbnailUrl: item.thumbnailUrl ?? output?.thumbUrl ?? null,
    };
  });
}

function readPersistedWorkspaceState(): PersistedWorkspaceState | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PersistedWorkspaceState> | null;
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || !Array.isArray(parsed.timelineItems)) return null;
    const nodes = normalizePlaceholderOutputNodes(
      normalizeGeneratedOutputNodes(normalizeShotOutputNodes(normalizeOutputOnlySourceNodes(parsed.nodes)))
    );
    const edges = normalizeWorkspaceEdgeTypes(
      normalizeGeneratedOutputEdges(nodes, normalizeShotOutputEdges(nodes, normalizeOutputOnlySourceEdges(nodes, parsed.edges)))
    );
    return {
      nodes,
      edges,
      timelineItems: normalizeTimelineMediaUrls(nodes, parsed.timelineItems),
      activeTemplateId: parsed.activeTemplateId ?? 'product-ad',
    };
  } catch {
    return null;
  }
}

function connectedInputKinds(nodeId: string, edges: WorkspaceGraphEdge[]): WorkspaceEdgeKind[] {
  return edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edge.data?.kind ?? inferWorkspaceEdgeKind(edge.sourceHandle, edge.targetHandle))
    .filter((kind) => kind !== 'generated_output' && kind !== 'output_to_timeline');
}

function connectedInputCounts(nodeId: string, edges: WorkspaceGraphEdge[]): Map<WorkspaceEdgeKind, number> {
  return edges
    .filter((edge) => edge.target === nodeId)
    .reduce((counts, edge) => {
      const kind = edge.data?.kind ?? inferWorkspaceEdgeKind(edge.sourceHandle, edge.targetHandle);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      return counts;
    }, new Map<WorkspaceEdgeKind, number>());
}

function findGeneratedOutputNodeForShot(
  shotNodeId: string,
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[]
): WorkspaceGraphNode | null {
  const outputEdge = edges.find(
    (edge) =>
      edge.source === shotNodeId &&
      (edge.data?.kind === GENERATED_OUTPUT_TARGET_HANDLE || edge.targetHandle === GENERATED_OUTPUT_TARGET_HANDLE)
  );
  if (!outputEdge) return null;
  return nodes.find((node) => node.id === outputEdge.target && node.data.kind === 'output') ?? null;
}

function outputNodeSubtitle(output: NonNullable<WorkspaceGraphNode['data']['output']>): string {
  if (output.status === 'processing') return 'Processing render...';
  if (output.status === 'placeholder') return 'Waiting for generated media';
  if (output.status === 'failed') return 'Generation failed';
  if (output.durationSec && output.aspectRatio) return `${output.durationSec}s · ${output.aspectRatio}`;
  return 'Generated media';
}

function connectorForTarget({
  targetNode,
  targetHandle,
  capabilities,
}: {
  targetNode: WorkspaceGraphNode | null;
  targetHandle: WorkspaceEdgeKind;
  capabilities: ReturnType<typeof getWorkspaceModelCapabilities>;
}): WorkspaceInputConnector | null {
  if (!targetNode) return null;
  if (targetNode.data.kind === 'shot' && targetNode.data.shot) {
    const capability = getWorkspaceModelCapability(targetNode.data.shot.modelId, capabilities);
    return getWorkspaceShotInputConnectors(capability).find((connector) => connector.kind === targetHandle) ?? null;
  }
  if (targetNode.data.kind === 'output' && targetHandle === 'generated_output') {
    return {
      kind: 'generated_output',
      label: 'Output',
      required: true,
      maxCount: 1,
      sourceType: 'video',
    };
  }
  return null;
}

function workspaceConnectionRejectionReason({
  connection,
  nodes,
  edges,
  capabilities,
}: {
  connection: Pick<Connection, 'source' | 'target'> & { sourceHandle?: string | null; targetHandle?: string | null };
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  capabilities: ReturnType<typeof getWorkspaceModelCapabilities>;
}): string | null {
  if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
    return 'This link needs a source and a target connector.';
  }
  if (connection.source === connection.target) {
    return 'A block cannot link to itself.';
  }
  if (!isWorkspaceConnectionCompatible({ sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle })) {
    return 'These block connectors are not compatible.';
  }
  const targetHandle = inferWorkspaceEdgeKind(connection.sourceHandle, connection.targetHandle);
  const targetNode = nodes.find((node) => node.id === connection.target) ?? null;
  const connector = connectorForTarget({ targetNode, targetHandle, capabilities });
  if (!connector) return null;
  const capacity = workspaceConnectionCapacity({
    connector,
    connectedCount: connectedInputCounts(connection.target, edges).get(targetHandle) ?? 0,
  });
  if (capacity.isFull) {
    return `${connector.label} is full.`;
  }
  return null;
}

function timelineTrackForNode(node: WorkspaceGraphNode): WorkspaceTimelineItem['track'] {
  const outputKind = node.data.output?.kind;
  if (outputKind === 'audio') return 'music';
  return 'video';
}

function timelineStartForTrack(items: WorkspaceTimelineItem[], track: WorkspaceTimelineItem['track']): number {
  return items.filter((item) => item.track === track).reduce((seconds, item) => seconds + item.durationSec, 0);
}

function defaultTimelineSelection(items: WorkspaceTimelineItem[]): string | null {
  return items.find((item) => item.track === 'video')?.id ?? items[0]?.id ?? null;
}

function createAdHocNode(kind: WorkspaceNodeKind, index: number, modelId: string, positionOverride?: { x: number; y: number }): WorkspaceGraphNode {
  const position = positionOverride ?? { x: -220 + (index % 4) * 180, y: -120 + Math.floor(index / 4) * 140 };
  const id = `${kind}-${Date.now().toString(36)}-${index}`;

  if (kind === 'asset-image') {
    return {
      id,
      type: 'asset-image',
      position,
      data: {
        kind,
        title: 'Image Reference',
        subtitle: 'No image selected',
        accent: '#8b5cf6',
        targetHandles: [],
        sourceHandles: ['reference'],
      },
    };
  }

  if (kind === 'asset-video') {
    return {
      id,
      type: 'asset-video',
      position,
      data: {
        kind,
        title: 'Video Reference',
        subtitle: 'No video selected',
        accent: '#2563eb',
        targetHandles: [],
        sourceHandles: ['video_reference'],
      },
    };
  }

  if (kind === 'asset-audio') {
    return {
      id,
      type: 'asset-audio',
      position,
      data: {
        kind,
        title: 'Audio Reference',
        subtitle: 'No audio selected',
        accent: '#22c55e',
        targetHandles: [],
        sourceHandles: ['audio'],
      },
    };
  }

  if (kind === 'text-prompt') {
    return {
      id,
      type: 'text-prompt',
      position,
      data: {
        kind,
        title: 'Prompt',
        subtitle: 'prompt.txt',
        accent: '#60a5fa',
        promptRole: 'prompt',
        promptText: 'Describe the next shot with subject, motion, lighting, lens, and mood.',
        sourceHandles: ['prompt'],
      },
    };
  }

  return {
    id,
    type: 'shot',
    position,
    data: {
      kind: 'shot',
      title: 'Shot',
      subtitle: 'New generation block',
      accent: '#f97316',
      shot: {
        modelId,
        workflowType: 'image_to_video',
        durationSec: 7,
        aspectRatio: '16:9',
        resolution: '1080p',
        fps: 24,
        seed: null,
        audioEnabled: false,
        lipSyncEnabled: false,
        referenceStrength: 0.65,
        outputName: 'New Shot',
        status: 'draft',
      },
      targetHandles: ['prompt', 'negative_prompt', 'product', 'character', 'style', 'video_reference', 'motion_reference', 'audio', 'voiceover', 'music', 'camera', 'dialogue', 'narration', 'previous_shot'],
      sourceHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
    },
  };
}

function defaultSelectedNodeId(nodes: WorkspaceGraphNode[], templateId: WorkspaceTemplateId): string | null {
  if (templateId === 'product-ad' && nodes.some((node) => node.id === 'shot-03')) return 'shot-03';
  return nodes[0]?.id ?? null;
}

export default function WorkspacePage() {
  const defaultTemplate = useMemo(() => createStarterWorkspaceTemplate('product-ad'), []);
  const capabilities = useMemo(() => getWorkspaceModelCapabilities(), []);
  const defaultModelId = capabilities.find((capability) => capability.id === 'kling-3-pro')?.id ?? capabilities[0]?.id ?? 'kling-3-pro';
  const [nodes, setNodes] = useState<WorkspaceGraphNode[]>(defaultTemplate.nodes);
  const [edges, setEdges] = useState<WorkspaceGraphEdge[]>(defaultTemplate.edges);
  const [timelineItems, setTimelineItems] = useState<WorkspaceTimelineItem[]>(defaultTemplate.timelineItems);
  const [selectedTimelineItemId, setSelectedTimelineItemId] = useState<string | null>(defaultTimelineSelection(defaultTemplate.timelineItems));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('shot-03');
  const [activeTemplateId, setActiveTemplateId] = useState<WorkspaceTemplateId>('product-ad');
  const [focusMode, setFocusMode] = useState<'canvas' | 'viewer'>('canvas');
  const [mockMode, setMockMode] = useState(process.env.NODE_ENV !== 'production');
  const [notice, setNotice] = useState('Product Ad template loaded. Select Shot 03 to generate an output.');
  const [hydrated, setHydrated] = useState(false);
  const [canvasRevision, setCanvasRevision] = useState(0);
  const [assetPickerNodeId, setAssetPickerNodeId] = useState<string | null>(null);
  const activeTemplateName = WORKSPACE_TEMPLATE_SUMMARIES.find((template) => template.id === activeTemplateId)?.name ?? 'Workspace';
  const pricingEstimates = useWorkspaceShotPricing({ nodes, edges, capabilities });

  useEffect(() => {
    const persisted = readPersistedWorkspaceState();
    if (persisted) {
      setNodes(persisted.nodes);
      setEdges(persisted.edges);
      setTimelineItems(persisted.timelineItems);
      setSelectedTimelineItemId(defaultTimelineSelection(persisted.timelineItems));
      setActiveTemplateId(persisted.activeTemplateId);
      setCanvasRevision((value) => value + 1);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    const state: PersistedWorkspaceState = { nodes, edges, timelineItems, activeTemplateId };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [activeTemplateId, edges, hydrated, nodes, timelineItems]);

  useEffect(() => {
    if (!timelineItems.length) {
      setSelectedTimelineItemId(null);
      return;
    }
    if (!selectedTimelineItemId || !timelineItems.some((item) => item.id === selectedTimelineItemId)) {
      setSelectedTimelineItemId(defaultTimelineSelection(timelineItems));
    }
  }, [selectedTimelineItemId, timelineItems]);

  const patchNodeData = useCallback((nodeId: string, patch: Partial<WorkspaceGraphNode['data']>) => {
    setNodes((current) =>
      current.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node))
    );
  }, []);

  const patchShot = useCallback((nodeId: string, patch: Partial<WorkspaceShotSettings>) => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== nodeId || !node.data.shot) return node;
        const nextShot = {
          ...node.data.shot,
          ...patch,
          status: patch.status ?? (node.data.shot.status === 'incompatible' ? 'draft' : node.data.shot.status),
        };
        return {
          ...node,
          data: {
            ...node.data,
            subtitle: patch.outputName ?? node.data.subtitle,
            shot: nextShot,
          },
        };
      })
    );
  }, []);

  const handleOpenAssetLibrary = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setAssetPickerNodeId(nodeId);
  }, []);

  const handleSelectLibraryAsset = useCallback((nodeId: string, asset: WorkspaceLibraryAsset) => {
    const assetRecord = workspaceAssetRecordFromLibraryAsset(asset);
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                subtitle: asset.name,
                asset: assetRecord,
              },
            }
          : node
      )
    );
    setSelectedNodeId(nodeId);
    setAssetPickerNodeId(null);
    setNotice(`${asset.name} attached to the media block.`);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange<WorkspaceGraphNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<WorkspaceGraphEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const isValidConnection = useCallback(
    (connection: Connection | WorkspaceGraphEdge) => !workspaceConnectionRejectionReason({ connection, nodes, edges, capabilities }),
    [capabilities, edges, nodes]
  );

  const onConnect = useCallback((connection: Connection) => {
    const rejectionReason = workspaceConnectionRejectionReason({ connection, nodes, edges, capabilities });
    if (rejectionReason) {
      setNotice(rejectionReason);
      return;
    }
    if (!connection.source || !connection.target) return;
    const kind = inferWorkspaceEdgeKind(connection.sourceHandle, connection.targetHandle);
    const edge = createWorkspaceEdge({
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? kind,
      targetHandle: connection.targetHandle ?? kind,
      kind,
    });
    setEdges((current) => addEdge(edge, current));
    setNotice(`${edge.data?.label ?? 'Graph'} link connected.`);
  }, [capabilities, edges, nodes]);

  const handleCreateNodeFromHandleDrop = useCallback(
    (request: WorkspaceHandleDropRequest) => {
      const draft = resolveWorkspaceHandleDropDraft(request.handleId, request.handleType);
      if (!draft) {
        setNotice('No matching block is available for this connector.');
        return;
      }
      if (request.handleType === 'target') {
        const rejectionReason = workspaceConnectionRejectionReason({
          connection: {
            source: 'pending-node',
            target: request.sourceNodeId,
            sourceHandle: draft.sourceHandle,
            targetHandle: request.handleId,
          },
          nodes,
          edges,
          capabilities,
        });
        if (rejectionReason) {
          setNotice(rejectionReason);
          return;
        }
      }

      const node = createWorkspaceHandleDropNode({
        draft,
        defaultModelId,
        index: nodes.length,
        position: {
          x: request.position.x - 110,
          y: request.position.y - 48,
        },
      });
      const edge =
        request.handleType === 'target'
          ? createWorkspaceEdge({
              source: node.id,
              target: request.sourceNodeId,
              sourceHandle: draft.sourceHandle,
              targetHandle: request.handleId,
              kind: request.handleId,
            })
          : createWorkspaceEdge({
              source: request.sourceNodeId,
              target: node.id,
              sourceHandle: request.handleId,
              targetHandle: draft.targetHandle,
              kind: request.handleId,
            });

      setNodes((current) => [...current, node]);
      setEdges((current) => addEdge(edge, current));
      setSelectedNodeId(node.id);
      setNotice(`${node.data.title} created from the ${edge.data?.label ?? 'connector'} connector.`);
    },
    [capabilities, defaultModelId, edges, nodes]
  );

  const handleCreateNodeFromPaletteDrop = useCallback(
    (request: WorkspacePaletteDropRequest) => {
      const node = createAdHocNode(request.kind, nodes.length, defaultModelId, {
        x: request.position.x - 105,
        y: request.position.y - 48,
      });
      setNodes((current) => [...current, node]);
      setSelectedNodeId(node.id);
      setNotice(`${node.data.title} dropped onto the canvas.`);
    },
    [defaultModelId, nodes.length]
  );

  const handleGenerateShot = useCallback(
    async (nodeId: string): Promise<void> => {
      const shotNode = nodes.find((node) => node.id === nodeId);
      if (!shotNode?.data.shot) return;
      const validation = validateShotConnections({
        settings: shotNode.data.shot,
        connectedInputs: connectedInputKinds(nodeId, edges),
        capabilities,
      });
      if (!validation.canGenerate) {
        patchShot(nodeId, { status: 'incompatible' });
        setNotice('This shot has incompatible or missing inputs for the selected model.');
        return;
      }

      const capability = getWorkspaceModelCapability(shotNode.data.shot.modelId, capabilities);
      const existingOutputNode = findGeneratedOutputNodeForShot(nodeId, nodes, edges);
      const pendingOutput = createPendingWorkspaceOutput({
        shotNode,
        settings: shotNode.data.shot,
        capability,
        nodes,
        edges,
        siblingCount: nodes.filter((node) => node.data.output?.sourceShotId === shotNode.id).length,
        outputNodeId: existingOutputNode?.id,
      });
      const pendingOutputNode = existingOutputNode
        ? {
            ...existingOutputNode,
            data: {
              ...existingOutputNode.data,
              title: shotNode.data.shot.outputName || existingOutputNode.data.title,
              subtitle: outputNodeSubtitle(pendingOutput.output),
              output: pendingOutput.output,
            },
          }
        : pendingOutput.outputNode;

      setNodes((current) => {
        const hasOutputNode = current.some((node) => node.id === pendingOutputNode.id);
        const nextNodes = current.map((node) => {
          if (node.id === nodeId && node.data.shot) {
            return {
              ...node,
              data: {
                ...node.data,
                shot: {
                  ...node.data.shot,
                  status: 'generating' as const,
                },
              },
            };
          }
          if (node.id === pendingOutputNode.id) return pendingOutputNode;
          return node;
        });
        return hasOutputNode ? nextNodes : [...nextNodes, pendingOutputNode];
      });
      if (!existingOutputNode) {
        setEdges((current) => addEdge(pendingOutput.outputEdge, current));
      }
      setSelectedNodeId(pendingOutputNode.id);
      setNotice(`${shotNode.data.title} generation started${mockMode ? ' in mock mode' : ''}.`);
      try {
        const result = await submitWorkspaceShotGeneration({
          nodes,
          edges,
          shotNodeId: nodeId,
          capability,
          generationMode: mockMode ? 'mock' : 'real',
        });
        setNodes((current) =>
          current.map((node) => {
            if (node.id === nodeId && node.data.shot) {
              return {
                ...node,
                data: {
                  ...node.data,
                  shot: {
                    ...node.data.shot,
                    status: 'completed' as const,
                  },
                },
              };
            }
            if (node.id === pendingOutputNode.id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  title: shotNode.data.shot?.outputName || node.data.title,
                  subtitle: outputNodeSubtitle(result.output),
                  output: result.output,
                },
              };
            }
            return node;
          })
        );
        setSelectedNodeId(pendingOutputNode.id);
        setNotice(`${result.output.modelLabel} output created. Send it to the timeline when ready.`);
      } catch (error) {
        setNodes((current) =>
          current.map((node) => {
            if (node.id === nodeId && node.data.shot) {
              return {
                ...node,
                data: {
                  ...node.data,
                  shot: {
                    ...node.data.shot,
                    status: 'failed' as const,
                  },
                },
              };
            }
            if (node.id === pendingOutputNode.id && node.data.output) {
              const failedOutput = {
                ...node.data.output,
                status: 'failed' as const,
                thumbUrl: null,
                url: null,
              };
              return {
                ...node,
                data: {
                  ...node.data,
                  subtitle: outputNodeSubtitle(failedOutput),
                  output: failedOutput,
                },
              };
            }
            return node;
          })
        );
        const message = error instanceof Error ? error.message : 'Generation failed.';
        setNotice(message);
      }
    },
    [capabilities, edges, mockMode, nodes, patchShot]
  );

  const handleSendOutputToTimeline = useCallback(
    (nodeId: string) => {
      const outputNode = nodes.find((node) => node.id === nodeId);
      const output = outputNode?.data.output;
      if (!outputNode || !output) return;
      if (
        !output.url ||
        (output.kind === 'video' && !isPlayableVideoUrl(output.url)) ||
        output.status === 'placeholder' ||
        output.status === 'processing' ||
        output.status === 'failed'
      ) {
        setNotice('This output is not ready for the timeline yet.');
        return;
      }
      const track = timelineTrackForNode(outputNode);
      const existingTimelineItem = timelineItems.find((item) => item.outputNodeId === nodeId);
      const nextTimelineItemId = existingTimelineItem?.id ?? `timeline-${nodeId}-${Date.now().toString(36)}`;
      setTimelineItems((current) => {
        const existing = current.find((item) => item.outputNodeId === nodeId);
        if (existing) {
          return current.map((item) =>
            item.id === existing.id
              ? {
                  ...item,
                  title: outputNode.data.title,
                  mediaUrl: output.url ?? null,
                  thumbnailUrl: output.thumbUrl ?? output.url ?? null,
                  durationSec: output.durationSec ?? item.durationSec,
                  modelId: output.modelId,
                }
              : item
          );
        }
        const durationSec = output.durationSec ?? 5;
        return [
          ...current,
          {
            id: nextTimelineItemId,
            outputNodeId: nodeId,
            track,
            title: outputNode.data.title,
            durationSec,
            startSec: timelineStartForTrack(current, track),
            mediaUrl: output.url ?? null,
            thumbnailUrl: output.thumbUrl ?? output.url ?? null,
            modelId: output.modelId,
            status: 'completed',
          },
        ];
      });
      setSelectedTimelineItemId(nextTimelineItemId);
      setFocusMode('viewer');
      setNotice(`${outputNode.data.title} is on the ${track} track.`);
    },
    [nodes, timelineItems]
  );

  const renderNodes = useMemo(() => {
    return nodes.map((node) => {
      if (node.data.kind !== 'shot' || !node.data.shot) {
        return {
          ...node,
          data: {
            ...node.data,
            onPromptChange: (nodeId: string, value: string) => patchNodeData(nodeId, { promptText: value }),
            onOpenAssetLibrary: handleOpenAssetLibrary,
            onSendOutputToTimeline: handleSendOutputToTimeline,
          },
        };
      }
      const validation = validateShotConnections({
        settings: node.data.shot,
        connectedInputs: connectedInputKinds(node.id, edges),
        capabilities,
      });
      const inputCounts = connectedInputCounts(node.id, edges);
      const inputConnectors = getWorkspaceShotInputConnectors(validation.capability).map((connector) => {
        const connectedCount = inputCounts.get(connector.kind) ?? 0;
        const capacity = workspaceConnectionCapacity({ connector, connectedCount });
        return {
          ...connector,
          connectedCount,
          remainingCount: capacity.remainingCount,
          capacityLabel: capacity.capacityLabel,
        };
      });
      return {
        ...node,
        data: {
          ...node.data,
          sourceHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
          targetHandles: getWorkspaceShotTargetHandles(validation.capability),
          inputConnectors,
          validation,
          pricingEstimate: pricingEstimates[node.id],
          onGenerateShot: (nodeId: string): void => {
            void handleGenerateShot(nodeId);
          },
        },
      };
    });
  }, [capabilities, edges, handleGenerateShot, handleOpenAssetLibrary, handleSendOutputToTimeline, nodes, patchNodeData, pricingEstimates]);

  const renderEdges = useMemo(() => filterRenderableWorkspaceEdges(renderNodes, edges), [edges, renderNodes]);
  const selectedNode = renderNodes.find((node) => node.id === selectedNodeId) ?? null;
  const assetPickerNode = renderNodes.find((node) => node.id === assetPickerNodeId) ?? null;
  const assetPickerLibrary = useWorkspaceEditorAssetLibrary(assetPickerNode ? assetPickerNode.data.kind : undefined);

  const handleAddNode = useCallback(
    (kind: WorkspaceNodeKind) => {
      const node = createAdHocNode(kind, nodes.length, defaultModelId);
      setNodes((current) => [...current, node]);
      setSelectedNodeId(node.id);
      setNotice(`${node.data.title} added to the canvas.`);
    },
    [defaultModelId, nodes.length]
  );

  const handleApplyTemplate = useCallback((templateId: WorkspaceTemplateId) => {
    const template = createStarterWorkspaceTemplate(templateId);
    setNodes(template.nodes);
    setEdges(template.edges);
    setTimelineItems(template.timelineItems);
    setSelectedTimelineItemId(defaultTimelineSelection(template.timelineItems));
    setSelectedNodeId(defaultSelectedNodeId(template.nodes, template.id));
    setActiveTemplateId(template.id);
    setCanvasRevision((value) => value + 1);
    setNotice(`${template.name} template loaded.`);
  }, []);

  const handleMoveTimelineItem = useCallback((itemId: string, direction: -1 | 1) => {
    setSelectedTimelineItemId(itemId);
    setTimelineItems((current) => moveWorkspaceTimelineItem(current, itemId, direction));
  }, []);

  const handleReorderTimelineItem = useCallback((itemId: string, targetItemId: string) => {
    setSelectedTimelineItemId(itemId);
    setTimelineItems((current) => reorderWorkspaceTimelineItem(current, itemId, targetItemId));
  }, []);

  const handleCutTimelineItem = useCallback((itemId: string) => {
    setSelectedTimelineItemId(itemId);
    setTimelineItems((current) => splitWorkspaceTimelineItem(current, itemId));
  }, []);

  return (
    <main className={`${styles.editorShell} ${focusMode === 'viewer' ? styles.viewerFocus : ''}`}>
      <header className={styles.editorTopbar}>
        <div className={styles.brandCluster}>
          <span className={styles.brandMark}>M</span>
          <div>
            <p>MaxVideoAI Editor</p>
            <span>Projects / {activeTemplateName} / Workspace</span>
          </div>
        </div>
        <div className={styles.modeSwitch} aria-label="Workspace view">
          <button type="button" className={focusMode === 'canvas' ? styles.modeActive : ''} onClick={() => setFocusMode('canvas')}>
            <GitBranch size={14} />
            Canvas
          </button>
          <button type="button" className={focusMode === 'viewer' ? styles.modeActive : ''} onClick={() => setFocusMode('viewer')}>
            <PanelRight size={14} />
            Viewer
          </button>
        </div>
        <div className={styles.topbarActions}>
          <button type="button" className={styles.iconButton} onClick={() => selectedNode?.data.kind === 'shot' && void handleGenerateShot(selectedNode.id)} aria-label="Generate selected shot">
            <Play size={15} />
          </button>
          <button type="button" className={styles.iconButton} aria-label="Share project">
            <Share2 size={15} />
          </button>
          <button type="button" className={`${styles.exportButton}`} aria-label="Export project">
            <Download size={15} />
            Export
          </button>
          <button type="button" className={styles.iconButton} onClick={() => setMockMode((value) => !value)} aria-label="Toggle mock generation">
            <Settings size={15} />
            <span>{mockMode ? 'Mock' : 'Live'}</span>
          </button>
        </div>
      </header>

      <div className={styles.noticeBar}>
        <Sparkles size={14} />
        <span>{notice}</span>
        <button type="button" onClick={() => handleApplyTemplate(activeTemplateId)}>
          <RefreshCcw size={13} />
          Reset template
        </button>
      </div>

      <div className={styles.editorBody}>
        <NodeLibrarySidebar
          templates={WORKSPACE_TEMPLATE_SUMMARIES}
          activeTemplateId={activeTemplateId}
          onAddNode={handleAddNode}
          onApplyTemplate={handleApplyTemplate}
        />
        {focusMode === 'canvas' ? (
          <WorkspaceCanvas
            key={`${activeTemplateId}-${canvasRevision}`}
            nodes={renderNodes}
            edges={renderEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onCreateNodeFromHandleDrop={handleCreateNodeFromHandleDrop}
            onCreateNodeFromPaletteDrop={handleCreateNodeFromPaletteDrop}
            onSelectedNodeChange={setSelectedNodeId}
          />
        ) : (
          <WorkspaceVideoViewer
            items={timelineItems}
            selectedItemId={selectedTimelineItemId}
            onSelectItem={setSelectedTimelineItemId}
          />
        )}
        <NodeSettingsPanel
          selectedNode={selectedNode}
          edges={edges}
          capabilities={capabilities}
          onPatchNodeData={patchNodeData}
          onPatchShot={patchShot}
          onGenerateShot={handleGenerateShot}
          onSendOutputToTimeline={handleSendOutputToTimeline}
          onOpenAssetLibrary={handleOpenAssetLibrary}
        />
      </div>

      <WorkspaceTimeline
        items={timelineItems}
        selectedItemId={selectedTimelineItemId}
        onCutItem={handleCutTimelineItem}
        onMoveItem={handleMoveTimelineItem}
        onReorderItem={handleReorderTimelineItem}
        onSelectItem={setSelectedTimelineItemId}
      />
      <WorkspaceAssetLibraryModal
        node={assetPickerNode}
        assets={assetPickerLibrary.assets}
        isLoading={assetPickerLibrary.isLoading}
        error={assetPickerLibrary.error}
        usingFallback={assetPickerLibrary.usingFallback}
        source={assetPickerLibrary.source}
        sourceOptions={assetPickerLibrary.sourceOptions}
        sourceLabels={assetPickerLibrary.sourceLabels}
        onClose={() => setAssetPickerNodeId(null)}
        onSelectAsset={handleSelectLibraryAsset}
        onSourceChange={assetPickerLibrary.setSource}
      />
    </main>
  );
}
