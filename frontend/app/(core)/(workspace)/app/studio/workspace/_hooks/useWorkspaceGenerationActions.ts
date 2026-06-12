import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { addEdge } from '@xyflow/react';
import { getWorkspaceModelCapability, validateShotConnections } from '../_lib/workspace-capabilities';
import {
  connectedInputKinds,
  findGeneratedOutputNodeForShot,
  outputNodeSubtitle,
} from '../_lib/workspace-graph-helpers';
import { createPendingWorkspaceOutput, submitWorkspaceShotGeneration } from '../_lib/workspace-generation';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspaceShotSettings,
} from '../_lib/workspace-types';
import type { WorkspaceEditorSurface } from '../_state/workspace-state';
import type { StudioCopy } from '../../_lib/studio-copy';

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

type UseWorkspaceGenerationActionsParams = {
  capabilities: WorkspaceModelCapability[];
  edges: WorkspaceGraphEdge[];
  mockMode: boolean;
  nodes: WorkspaceGraphNode[];
  patchShot: (nodeId: string, patch: Partial<WorkspaceShotSettings>) => void;
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setEdges: Dispatch<SetStateAction<WorkspaceGraphEdge[]>>;
  setNodes: Dispatch<SetStateAction<WorkspaceGraphNode[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  studioNotices: StudioCopy['notices'];
};

export function useWorkspaceGenerationActions({
  capabilities,
  edges,
  mockMode,
  nodes,
  patchShot,
  setActiveEditorSurface,
  setEdges,
  setNodes,
  setNotice,
  setSelectedNodeId,
  studioNotices,
}: UseWorkspaceGenerationActionsParams): {
  handleGenerateShot: (nodeId: string) => Promise<void>;
} {
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
        setNotice(studioNotices.generationInvalidInputs);
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
        notices: studioNotices,
      });
      const pendingOutputTitle = shotNode.data.shot.outputName || existingOutputNode?.data.title || studioNotices.generatedOutputTitle;
      const pendingOutputNode = existingOutputNode
        ? {
            ...existingOutputNode,
            data: {
              ...existingOutputNode.data,
              title: pendingOutputTitle,
              subtitle: outputNodeSubtitle(pendingOutput.output, studioNotices),
              output: pendingOutput.output,
            },
          }
        : {
            ...pendingOutput.outputNode,
            data: {
              ...pendingOutput.outputNode.data,
              title: pendingOutputTitle,
            },
          };

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
      setActiveEditorSurface('canvas');
      setSelectedNodeId(pendingOutputNode.id);
      setNotice(formatNotice(mockMode ? studioNotices.generationStartedMock : studioNotices.generationStarted, {
        title: shotNode.data.title,
      }));
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
              const nextShotStatus =
                result.output.status === 'ready'
                  ? 'completed'
                  : result.output.status === 'failed'
                    ? 'failed'
                    : 'generating';
              return {
                ...node,
                data: {
                  ...node.data,
                  shot: {
                    ...node.data.shot,
                    status: nextShotStatus,
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
                  subtitle: outputNodeSubtitle(result.output, studioNotices),
                  output: result.output,
                },
              };
            }
            return node;
          })
        );
        setActiveEditorSurface('canvas');
        setSelectedNodeId(pendingOutputNode.id);
        setNotice(
          result.output.status === 'ready'
            ? formatNotice(studioNotices.generationOutputCreated, { model: result.output.modelLabel })
            : result.output.status === 'failed'
              ? formatNotice(studioNotices.generationOutputFailed, { model: result.output.modelLabel })
              : formatNotice(studioNotices.generationStillProcessing, { model: result.output.modelLabel })
        );
      } catch {
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
                  subtitle: outputNodeSubtitle(failedOutput, studioNotices),
                  output: failedOutput,
                },
              };
            }
            return node;
          })
        );
        setNotice(studioNotices.generationFailed);
      }
    },
    [
      capabilities,
      edges,
      mockMode,
      nodes,
      patchShot,
      setActiveEditorSurface,
      setEdges,
      setNodes,
      setNotice,
      setSelectedNodeId,
      studioNotices,
    ]
  );

  return { handleGenerateShot };
}
