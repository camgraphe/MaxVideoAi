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
  WorkspaceChatMessage,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspaceShotSettings,
} from '../_lib/workspace-types';
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
      const outputTitleData = workspaceOutputNodeTitleDataForShot(shotNode);
      const pendingOutputTitleData = outputTitleData.title
        ? outputTitleData
        : {
            title: existingOutputNode
              ? existingOutputNode.data.title
              : studioNotices.generatedOutputTitle,
            generatedCopy: existingOutputNode?.data.generatedCopy,
          };
      const pendingOutputNode = existingOutputNode
        ? {
            ...existingOutputNode,
            data: {
              ...existingOutputNode.data,
              ...pendingOutputTitleData,
              subtitle: outputNodeSubtitle(pendingOutput.output, studioNotices),
              output: pendingOutput.output,
            },
          }
        : {
            ...pendingOutput.outputNode,
            data: {
              ...pendingOutput.outputNode.data,
              ...pendingOutputTitleData,
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
        title: localizeWorkspaceNodeTitle(shotNode, studioCanvasNodeCopy),
      }));
      try {
        const result = await submitWorkspaceShotGeneration({
          nodes,
          edges,
          shotNodeId: nodeId,
          capability,
          generationMode: mockMode ? 'mock' : 'real',
          canvasNodeCopy: studioCanvasNodeCopy,
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
              const finalOutputTitleData = shotNode.data.shot
                ? workspaceOutputNodeTitleDataForShot(shotNode)
                : {
                    title: node.data.title,
                    generatedCopy: node.data.generatedCopy,
                  };
              return {
                ...node,
                data: {
                  ...node.data,
                  ...finalOutputTitleData,
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
      const apiMessages = [
        ...(chat.systemPrompt.trim()
          ? [{ role: 'system' as const, content: chat.systemPrompt.trim() }]
          : []),
        ...nextMessages.map(({ role, content }) => ({ role, content })),
      ];

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
          body: JSON.stringify({
            provider: chat.provider,
            modelId: chat.modelId,
            messages: apiMessages,
          }),
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
    [nodes, setNodes, setNotice, studioNotices.generationFailed]
  );

  return { handleGenerateShot, handleRunChat };
}
