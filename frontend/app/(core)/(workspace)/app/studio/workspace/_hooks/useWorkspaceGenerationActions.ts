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
      setActiveEditorSurface('canvas');
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
                  subtitle: outputNodeSubtitle(result.output),
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
            ? `${result.output.modelLabel} output created. Send it to the timeline when ready.`
            : result.output.status === 'failed'
              ? `${result.output.modelLabel} generation failed.`
              : `${result.output.modelLabel} render is still processing. It will be available when the job completes.`
        );
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
    ]
  );

  return { handleGenerateShot };
}
