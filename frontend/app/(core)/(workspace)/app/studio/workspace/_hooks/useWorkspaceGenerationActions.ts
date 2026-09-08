import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { addEdge } from '@xyflow/react';
import { getWorkspaceModelCapability, validateShotConnections } from '../_lib/workspace-capabilities';
import {
  connectedInputKinds,
  outputNodeSubtitle,
} from '../_lib/workspace-graph-helpers';
import {
  createPendingWorkspaceOutputs,
  createWorkspaceGenerationSubmissionId,
  mergeWorkspaceGenerationOutputNodes,
  submitWorkspaceShotGeneration,
} from '../_lib/workspace-generation';
import { workspaceAssetFromOutputNode } from '../_lib/workspace-generated-media';
import { resolveWorkspaceEngineOperationalEligibility } from '../_lib/models/workspace-engine-availability';
import { workspaceGenerationActionReady } from '../_lib/workspace-canvas-actions';
import type {
  WorkspaceAssetRecord,
  WorkspaceChatMessage,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspacePricingEstimate,
  WorkspaceShotSettings,
} from '../_lib/workspace-types';
import {
  buildWorkspaceChatApiRequest,
  workspaceChatContextSummariesForNode,
} from '../_lib/workspace-tool-requests';
import {
  localizeWorkspaceNodeTitle,
  workspaceOutputNodeTitleDataForShot,
} from '../_lib/workspace-generated-copy';
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
  pricingEstimates: Record<string, WorkspacePricingEstimate>;
  onGeneratedProjectAsset: (asset: WorkspaceAssetRecord) => void;
  patchShot: (nodeId: string, patch: Partial<WorkspaceShotSettings>) => void;
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setEdges: Dispatch<SetStateAction<WorkspaceGraphEdge[]>>;
  setNodes: Dispatch<SetStateAction<WorkspaceGraphNode[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes'];
  studioNotices: StudioCopy['notices'];
};

function chatMessageId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `${prefix}-${randomId}` : `${prefix}-${Date.now().toString(36)}`;
}

function mergeGenerationEdges(
  current: WorkspaceGraphEdge[],
  generationEdges: WorkspaceGraphEdge[],
  pendingNodeIds: readonly string[] = []
): WorkspaceGraphEdge[] {
  const pendingIds = new Set(pendingNodeIds);
  const sourceNodeId = generationEdges[0]?.source;
  const withoutPending = current.filter((edge) => !(
    pendingIds.has(edge.target) && edge.data?.kind === 'generated_output'
  ));
  const merged = generationEdges.reduce(
    (next, edge) => next.some((candidate) => (
      candidate.source === edge.source &&
      candidate.target === edge.target &&
      candidate.targetHandle === edge.targetHandle
    )) ? next : addEdge(edge, next),
    withoutPending
  );
  if (!sourceNodeId) return merged;
  const generated = merged
    .filter((edge) => edge.source === sourceNodeId && edge.data?.kind === 'generated_output')
    .sort((left, right) => left.target.localeCompare(right.target));
  const other = merged.filter((edge) => !(edge.source === sourceNodeId && edge.data?.kind === 'generated_output'));
  const firstGeneratedIndex = withoutPending.findIndex((edge) => (
    edge.source === sourceNodeId && edge.data?.kind === 'generated_output'
  ));
  const insertIndex = firstGeneratedIndex < 0
    ? other.length
    : Math.min(other.length, withoutPending.slice(0, firstGeneratedIndex).filter((edge) => (
        !(edge.source === sourceNodeId && edge.data?.kind === 'generated_output')
      )).length);
  return [...other.slice(0, insertIndex), ...generated, ...other.slice(insertIndex)];
}

export function useWorkspaceGenerationActions({
  capabilities,
  edges,
  mockMode,
  nodes,
  pricingEstimates,
  onGeneratedProjectAsset,
  patchShot,
  setActiveEditorSurface,
  setEdges,
  setNodes,
  setNotice,
  setSelectedNodeId,
  studioCanvasNodeCopy,
  studioNotices,
}: UseWorkspaceGenerationActionsParams): {
  handleGenerateShot: (nodeId: string) => Promise<void>;
  handleRunChat: (nodeId: string) => Promise<void>;
} {
  const handleGenerateShot = useCallback(
    async (nodeId: string): Promise<void> => {
      const shotNode = nodes.find((node) => node.id === nodeId);
      if (!shotNode?.data.shot) return;
      const capability = getWorkspaceModelCapability(shotNode.data.shot.modelId, capabilities);
      const operationalEligibility = resolveWorkspaceEngineOperationalEligibility(capability);
      const validation = validateShotConnections({
        settings: shotNode.data.shot,
        connectedInputs: connectedInputKinds(nodeId, edges),
        capabilities,
      });
      if (!operationalEligibility.isOperational || !validation.canGenerate) {
        patchShot(nodeId, { status: 'incompatible' });
        setNotice(studioNotices.generationInvalidInputs);
        return;
      }
      const estimate = pricingEstimates[nodeId];
      if (!workspaceGenerationActionReady(validation.canGenerate, shotNode.data.shot.status, estimate, mockMode)) {
        setNotice(estimate?.error ?? estimate?.label ?? studioCanvasNodeCopy.estimating);
        return;
      }

      const submissionId = createWorkspaceGenerationSubmissionId(nodeId);
      const priorOutputs = nodes.flatMap((node) => (
        node.data.output?.sourceShotId === nodeId ? [node.data.output] : []
      ));
      const priorAttemptCount = new Set(priorOutputs.map((output) => (
        output.submissionId?.trim() || output.createdAt
      ))).size;
      const latestAttemptOrdinal = priorOutputs.reduce((latest, output) => (
        typeof output.attemptOrdinal === 'number' && Number.isSafeInteger(output.attemptOrdinal)
          ? Math.max(latest, output.attemptOrdinal)
          : latest
      ), 0);
      const attemptOrdinal = Math.max(priorAttemptCount, latestAttemptOrdinal) + 1;
      const pendingOutputs = createPendingWorkspaceOutputs({
        shotNode,
        settings: shotNode.data.shot,
        capability,
        nodes,
        edges,
        siblingCount: nodes.filter((node) => node.data.output?.sourceShotId === shotNode.id).length,
        attemptOrdinal,
        submissionId,
        notices: studioNotices,
      });
      const outputTitleData = workspaceOutputNodeTitleDataForShot(shotNode);
      const pendingOutputNodes = pendingOutputs.map((pendingOutput): WorkspaceGraphNode => {
        const baseNode = pendingOutput.outputNode;
        const pendingOutputTitleData = outputTitleData.title
          ? outputTitleData
          : {
              title: baseNode.data.title ?? studioNotices.generatedOutputTitle,
              generatedCopy: baseNode.data.generatedCopy,
            };
        return {
          ...baseNode,
          data: {
            ...baseNode.data,
            ...pendingOutputTitleData,
            subtitle: outputNodeSubtitle(pendingOutput.output, studioNotices),
            output: {
              ...pendingOutput.output,
              projectMediaFolderId: null,
            },
          },
        };
      });

      const titledPendingOutputs = pendingOutputs.map((pendingOutput, outputIndex) => ({
        ...pendingOutput,
        outputNode: pendingOutputNodes[outputIndex] ?? pendingOutput.outputNode,
      }));
      setNodes((current) => mergeWorkspaceGenerationOutputNodes({
        nodes: current,
        shotNode: current.find((node) => node.id === nodeId) ?? shotNode,
        results: titledPendingOutputs,
        pendingNodeIds: [],
      }));
      setEdges((current) => mergeGenerationEdges(
        current,
        pendingOutputs.map((pendingOutput) => pendingOutput.outputEdge)
      ));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(pendingOutputNodes[0]?.id ?? nodeId);
      setNotice(formatNotice(mockMode ? studioNotices.generationStartedMock : studioNotices.generationStarted, {
        title: localizeWorkspaceNodeTitle(shotNode, studioCanvasNodeCopy),
      }));
      try {
        const results = await submitWorkspaceShotGeneration({
          nodes,
          edges,
          shotNodeId: nodeId,
          capability,
          generationMode: mockMode ? 'mock' : 'real',
          submissionId,
          canvasNodeCopy: studioCanvasNodeCopy,
        });
        const finalOutputTitleData = shotNode.data.shot
          ? workspaceOutputNodeTitleDataForShot(shotNode)
          : {
              title: pendingOutputNodes[0]?.data.title ?? studioNotices.generatedOutputTitle,
              generatedCopy: pendingOutputNodes[0]?.data.generatedCopy,
            };
        const readyResults = results.map((result, outputIndex) => {
          const pendingNode = pendingOutputNodes[outputIndex] ?? result.outputNode;
          const output = {
            ...result.output,
            attemptOrdinal: pendingNode.data.output?.attemptOrdinal ?? attemptOrdinal,
          };
          const outputNode: WorkspaceGraphNode = {
            ...result.outputNode,
            position: pendingNode.position,
            data: {
              ...result.outputNode.data,
              ...finalOutputTitleData,
              subtitle: outputNodeSubtitle(output, studioNotices),
              output: {
                ...output,
                projectMediaFolderId: null,
              },
            },
          };
          return { ...result, output, outputNode };
        });
        const unmatchedPendingResults = titledPendingOutputs
          .slice(results.length)
          .map((pendingResult) => {
            const node = pendingResult.outputNode;
            const failedOutput = {
              ...node.data.output!,
              status: 'failed' as const,
              thumbUrl: null,
              url: null,
            };
            const outputNode: WorkspaceGraphNode = {
              ...node,
              data: {
                ...node.data,
                subtitle: outputNodeSubtitle(failedOutput, studioNotices),
                output: failedOutput,
              },
            };
            return { ...pendingResult, output: failedOutput, outputNode };
          });
        const completionResults = [...readyResults, ...unmatchedPendingResults];
        const readyOutputNodes = readyResults.map((result) => result.outputNode);
        const nextShotStatus = results.every((result) => result.output.status === 'ready')
          ? 'completed' as const
          : results.every((result) => result.output.status === 'failed')
            ? 'failed' as const
            : 'generating' as const;
        setNodes((current) => mergeWorkspaceGenerationOutputNodes({
          nodes: current,
          shotNode: current.find((node) => node.id === nodeId) ?? shotNode,
          results: completionResults,
          pendingNodeIds: pendingOutputNodes.map((node) => node.id),
        }));
        setEdges((current) => mergeGenerationEdges(
          current,
          completionResults.map((result) => result.outputEdge),
          pendingOutputNodes.map((node) => node.id)
        ));
        for (const readyOutputNode of readyOutputNodes) {
          const generatedAsset = workspaceAssetFromOutputNode(readyOutputNode);
          if (generatedAsset) onGeneratedProjectAsset(generatedAsset);
        }
        setActiveEditorSurface('canvas');
        setSelectedNodeId(readyOutputNodes[0]?.id ?? nodeId);
        const primaryOutput = results[0]?.output;
        setNotice(
          nextShotStatus === 'completed' && primaryOutput
            ? formatNotice(studioNotices.generationOutputCreated, { model: primaryOutput.modelLabel })
            : nextShotStatus === 'failed' && primaryOutput
              ? formatNotice(studioNotices.generationOutputFailed, { model: primaryOutput.modelLabel })
              : primaryOutput
                ? formatNotice(studioNotices.generationStillProcessing, { model: primaryOutput.modelLabel })
                : studioNotices.generationFailed
        );
      } catch {
        const failedResults = titledPendingOutputs.map((pendingResult) => {
          const failedOutput = {
            ...pendingResult.output,
            status: 'failed' as const,
            thumbUrl: null,
            url: null,
          };
          return {
            ...pendingResult,
            output: failedOutput,
            outputNode: {
              ...pendingResult.outputNode,
              data: {
                ...pendingResult.outputNode.data,
                subtitle: outputNodeSubtitle(failedOutput, studioNotices),
                output: failedOutput,
              },
            },
          };
        });
        setNodes((current) => mergeWorkspaceGenerationOutputNodes({
          nodes: current,
          shotNode: current.find((node) => node.id === nodeId) ?? shotNode,
          results: failedResults,
          pendingNodeIds: pendingOutputNodes.map((node) => node.id),
        }));
        setNotice(studioNotices.generationFailed);
      }
    },
    [
      capabilities,
      edges,
      mockMode,
      pricingEstimates,
      nodes,
      onGeneratedProjectAsset,
      patchShot,
      setActiveEditorSurface,
      setEdges,
      setNodes,
      setNotice,
      setSelectedNodeId,
      studioCanvasNodeCopy,
      studioNotices,
    ]
  );

  const handleRunChat = useCallback(
    async (nodeId: string): Promise<void> => {
      const chatNode = nodes.find((node) => node.id === nodeId);
      const chat = chatNode?.data.chat;
      const draftMessage = chat?.draftMessage.trim();
      if (!chat || chat.status === 'running' || !draftMessage) return;

      const createdAt = new Date().toISOString();
      const userMessage: WorkspaceChatMessage = {
        id: chatMessageId('chat-user'),
        role: 'user',
        content: draftMessage,
        createdAt,
      };
      const nextMessages = [...chat.messages, userMessage];
      const chatRequest = buildWorkspaceChatApiRequest({
        chat,
        nextMessages,
        contextSummaries: workspaceChatContextSummariesForNode({
          nodes,
          edges,
          chatNodeId: nodeId,
          canvasNodeCopy: studioCanvasNodeCopy,
        }),
      });

      setNodes((current) => current.map((node) => (
        node.id === nodeId && node.data.chat
          ? {
              ...node,
              data: {
                ...node.data,
                promptText: draftMessage,
                chat: {
                  ...node.data.chat,
                  messages: nextMessages,
                  draftMessage: '',
                  status: 'running',
                },
              },
            }
          : node
      )));

      try {
        const response = await fetch('/api/studio/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(chatRequest),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok || typeof data.content !== 'string') {
          throw new Error(data?.message ?? 'Chat failed.');
        }
        const assistantMessage: WorkspaceChatMessage = {
          id: chatMessageId('chat-assistant'),
          role: 'assistant',
          content: data.content,
          createdAt: new Date().toISOString(),
        };
        setNodes((current) => current.map((node) => (
          node.id === nodeId && node.data.chat
            ? {
                ...node,
                data: {
                  ...node.data,
                  promptText: data.content,
                  chat: {
                    ...node.data.chat,
                    messages: [...nextMessages, assistantMessage],
                    status: 'idle',
                  },
                },
              }
            : node
        )));
      } catch (error) {
        setNodes((current) => current.map((node) => (
          node.id === nodeId && node.data.chat
            ? {
                ...node,
                data: {
                  ...node.data,
                  chat: {
                    ...node.data.chat,
                    status: 'failed',
                  },
                },
              }
            : node
        )));
        setNotice(error instanceof Error ? error.message : studioNotices.generationFailed);
      }
    },
    [edges, nodes, setNodes, setNotice, studioCanvasNodeCopy, studioNotices.generationFailed]
  );

  return { handleGenerateShot, handleRunChat };
}
