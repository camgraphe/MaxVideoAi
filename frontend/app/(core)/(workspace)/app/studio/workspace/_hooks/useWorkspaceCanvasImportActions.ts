import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { appendSelectedWorkspaceGraphNode } from '../_lib/workspace-graph-helpers';
import {
  createAdHocWorkspaceNode,
  localCanvasImportFallbackName,
  workspaceAssetRecordFromCanvasFile,
  workspaceNodeKindForCanvasFile,
} from '../_lib/workspace-canvas-imports';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceNodeKind,
} from '../_lib/workspace-types';
import type { CanvasGraphHistorySnapshot, WorkspaceEditorSurface, WorkspaceFocusMode } from '../_state/workspace-state';
import type {
  WorkspaceCanvasFileDropRequest,
  WorkspaceCanvasTextPasteRequest,
} from '../_components/WorkspaceCanvas.client';
import type { WorkspaceProgramSnapshotPayload } from '../_components/WorkspaceVideoViewer';
import type { StudioCopy } from '../../_lib/studio-copy';

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function createLocalCanvasImportId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type UseWorkspaceCanvasImportActionsParams = {
  commitCanvasGraph: (
    updater: (current: CanvasGraphHistorySnapshot) => CanvasGraphHistorySnapshot,
    options?: { gesture?: boolean; history?: boolean }
  ) => void;
  defaultModelId: string;
  nodes: WorkspaceGraphNode[];
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setFocusMode: Dispatch<SetStateAction<WorkspaceFocusMode>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  studioNotices: StudioCopy['notices'];
};

export function useWorkspaceCanvasImportActions({
  commitCanvasGraph,
  defaultModelId,
  nodes,
  setActiveEditorSurface,
  setFocusMode,
  setNotice,
  setSelectedNodeId,
  studioNotices,
}: UseWorkspaceCanvasImportActionsParams): {
  handleCanvasFileDrop: (request: WorkspaceCanvasFileDropRequest) => void;
  handleCanvasTextPaste: (request: WorkspaceCanvasTextPasteRequest, sourceLabel?: string) => void;
  handleSendProgramSnapshotToCanvas: (snapshot: WorkspaceProgramSnapshotPayload) => void;
} {
  const canvasImportSequenceRef = useRef(0);
  const localCanvasObjectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      localCanvasObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      localCanvasObjectUrlsRef.current = [];
    };
  }, []);

  const applyCanvasImportedNodeData = useCallback(
    (params: {
      kind: WorkspaceNodeKind;
      nodeData: Partial<WorkspaceGraphNode['data']>;
      notice: string;
      position: { x: number; y: number };
      targetNodeId: string | null;
    }) => {
      const targetNode = params.targetNodeId
        ? nodes.find((node) => node.id === params.targetNodeId && node.data.kind === params.kind)
        : null;
      if (targetNode) {
        commitCanvasGraph(({ nodes: currentNodes, edges: currentEdges }) => ({
          edges: currentEdges,
          nodes: currentNodes.map((node) =>
            node.id === targetNode.id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    ...params.nodeData,
                  },
                }
              : node
          ),
        }));
        setActiveEditorSurface('canvas');
        setSelectedNodeId(targetNode.id);
        setNotice(params.notice);
        return;
      }

      const importIndex = nodes.length + canvasImportSequenceRef.current;
      canvasImportSequenceRef.current += 1;
      const node = createAdHocWorkspaceNode(params.kind, importIndex, defaultModelId, studioNotices, {
        x: params.position.x - 105,
        y: params.position.y - 48,
      });
      const importedNode = {
        ...node,
        data: {
          ...node.data,
          ...params.nodeData,
        },
      };
      commitCanvasGraph(({ nodes: currentNodes, edges: currentEdges }) => ({
        edges: currentEdges,
        nodes: appendSelectedWorkspaceGraphNode(currentNodes, importedNode),
      }));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(importedNode.id);
      setNotice(params.notice);
    },
    [commitCanvasGraph, defaultModelId, nodes, setActiveEditorSurface, setNotice, setSelectedNodeId, studioNotices]
  );

  const handleCanvasTextPaste = useCallback(
    (request: WorkspaceCanvasTextPasteRequest, sourceLabel?: string) => {
      const text = request.text.trim();
      if (!text) return;
      const resolvedSourceLabel = sourceLabel ?? studioNotices.pastedTextFilename;
      applyCanvasImportedNodeData({
        kind: 'text-prompt',
        nodeData: {
          subtitle: resolvedSourceLabel,
          promptRole: 'prompt',
          promptText: text,
        },
        notice: request.targetNodeId
          ? formatNotice(studioNotices.textPastedIntoPrompt, { source: resolvedSourceLabel })
          : formatNotice(studioNotices.sourceAddedToCanvas, { source: resolvedSourceLabel }),
        position: request.position,
        targetNodeId: request.targetNodeId,
      });
    },
    [
      applyCanvasImportedNodeData,
      studioNotices.pastedTextFilename,
      studioNotices.sourceAddedToCanvas,
      studioNotices.textPastedIntoPrompt,
    ]
  );

  const handleCanvasFileDrop = useCallback(
    (request: WorkspaceCanvasFileDropRequest) => {
      const unsupportedFiles: string[] = [];
      request.files.forEach((file, index) => {
        const kind = workspaceNodeKindForCanvasFile(file);
        const position = {
          x: request.position.x + index * 28,
          y: request.position.y + index * 22,
        };
        const targetNodeId = index === 0 ? request.targetNodeId : null;
        if (!kind) {
          unsupportedFiles.push(file.name || studioNotices.untitledFile);
          return;
        }

        if (kind === 'text-prompt') {
          void file
            .text()
            .then((text) => {
              handleCanvasTextPaste(
                {
                  text,
                  position,
                  targetNodeId,
                },
                file.name || localCanvasImportFallbackName(kind, studioNotices)
              );
            })
            .catch(() => {
              setNotice(formatNotice(studioNotices.couldNotReadTextFile, { filename: file.name || localCanvasImportFallbackName(kind, studioNotices) }));
            });
          return;
        }

        const idSeed = `${Date.now().toString(36)}-${index}-${canvasImportSequenceRef.current}`;
        const objectUrl = URL.createObjectURL(file);
        localCanvasObjectUrlsRef.current.push(objectUrl);
        const asset = workspaceAssetRecordFromCanvasFile(file, kind, objectUrl, idSeed, studioNotices);
        if (!asset) {
          unsupportedFiles.push(file.name || studioNotices.untitledFile);
          return;
        }
        applyCanvasImportedNodeData({
          kind,
          nodeData: {
            subtitle: asset.filename,
            asset,
          },
          notice: targetNodeId
            ? formatNotice(studioNotices.fileAttachedToMediaBlock, { filename: asset.filename })
            : formatNotice(studioNotices.fileAddedToCanvas, { filename: asset.filename }),
          position,
          targetNodeId,
        });
      });

      if (unsupportedFiles.length) {
        setNotice(formatNotice(unsupportedFiles.length > 1 ? studioNotices.unsupportedFiles : studioNotices.unsupportedFile, { files: unsupportedFiles.join(', ') }));
      }
    },
    [
      applyCanvasImportedNodeData,
      handleCanvasTextPaste,
      setNotice,
      studioNotices,
    ]
  );

  const handleSendProgramSnapshotToCanvas = useCallback(
    (snapshot: WorkspaceProgramSnapshotPayload) => {
      const snapshotUrl = snapshot.dataUrl ?? snapshot.sourceUrl;
      if (!snapshotUrl) {
        setNotice(studioNotices.noSnapshotFrame);
        return;
      }

      const importIndex = nodes.length + canvasImportSequenceRef.current;
      canvasImportSequenceRef.current += 1;
      const asset: WorkspaceAssetRecord = {
        id: createLocalCanvasImportId('program_snapshot'),
        kind: 'image',
        filename: snapshot.filename,
        subtitle: formatNotice(studioNotices.snapshotSubtitle, { timecode: snapshot.timecode }),
        url: snapshotUrl,
        thumbUrl: snapshotUrl,
        dimensions: `${snapshot.width}x${snapshot.height}`,
      };
      const node = createAdHocWorkspaceNode('asset-image', importIndex, defaultModelId, studioNotices, {
        x: -260 + (importIndex % 4) * 180,
        y: -170 + Math.floor(importIndex / 4) * 140,
      });
      const snapshotNode: WorkspaceGraphNode = {
        ...node,
        data: {
          ...node.data,
          title: studioNotices.programSnapshotTitle,
          subtitle: asset.filename,
          asset,
        },
      };

      commitCanvasGraph(({ nodes: currentNodes, edges: currentEdges }) => ({
        edges: currentEdges,
        nodes: appendSelectedWorkspaceGraphNode(currentNodes, snapshotNode),
      }));
      setFocusMode('canvas');
      setActiveEditorSurface('canvas');
      setSelectedNodeId(snapshotNode.id);
      setNotice(formatNotice(studioNotices.snapshotSentToCanvas, { filename: asset.filename }));
    },
    [
      defaultModelId,
      commitCanvasGraph,
      nodes.length,
      setActiveEditorSurface,
      setFocusMode,
      setNotice,
      setSelectedNodeId,
      studioNotices,
    ]
  );

  return {
    handleCanvasFileDrop,
    handleCanvasTextPaste,
    handleSendProgramSnapshotToCanvas,
  };
}
