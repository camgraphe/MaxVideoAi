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
import type { WorkspaceEditorSurface, WorkspaceFocusMode } from '../_state/workspace-state';
import type {
  WorkspaceCanvasFileDropRequest,
  WorkspaceCanvasTextPasteRequest,
} from '../_components/WorkspaceCanvas.client';
import type { WorkspaceProgramSnapshotPayload } from '../_components/WorkspaceVideoViewer';

function createLocalCanvasImportId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type UseWorkspaceCanvasImportActionsParams = {
  defaultModelId: string;
  nodes: WorkspaceGraphNode[];
  patchNodeData: (nodeId: string, patch: Partial<WorkspaceGraphNode['data']>) => void;
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setFocusMode: Dispatch<SetStateAction<WorkspaceFocusMode>>;
  setNodes: Dispatch<SetStateAction<WorkspaceGraphNode[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
};

export function useWorkspaceCanvasImportActions({
  defaultModelId,
  nodes,
  patchNodeData,
  setActiveEditorSurface,
  setFocusMode,
  setNodes,
  setNotice,
  setSelectedNodeId,
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
        patchNodeData(targetNode.id, params.nodeData);
        setActiveEditorSurface('canvas');
        setSelectedNodeId(targetNode.id);
        setNotice(params.notice);
        return;
      }

      const importIndex = nodes.length + canvasImportSequenceRef.current;
      canvasImportSequenceRef.current += 1;
      const node = createAdHocWorkspaceNode(params.kind, importIndex, defaultModelId, {
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
      setNodes((current) => appendSelectedWorkspaceGraphNode(current, importedNode));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(importedNode.id);
      setNotice(params.notice);
    },
    [defaultModelId, nodes, patchNodeData, setActiveEditorSurface, setNodes, setNotice, setSelectedNodeId]
  );

  const handleCanvasTextPaste = useCallback(
    (request: WorkspaceCanvasTextPasteRequest, sourceLabel = 'pasted-text.txt') => {
      const text = request.text.trim();
      if (!text) return;
      applyCanvasImportedNodeData({
        kind: 'text-prompt',
        nodeData: {
          subtitle: sourceLabel,
          promptRole: 'prompt',
          promptText: text,
        },
        notice: request.targetNodeId ? `${sourceLabel} pasted into the prompt block.` : `${sourceLabel} added to the canvas.`,
        position: request.position,
        targetNodeId: request.targetNodeId,
      });
    },
    [applyCanvasImportedNodeData]
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
          unsupportedFiles.push(file.name || 'Untitled file');
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
                file.name || localCanvasImportFallbackName(kind)
              );
            })
            .catch(() => {
              setNotice(`Could not read ${file.name || 'the text file'}.`);
            });
          return;
        }

        const idSeed = `${Date.now().toString(36)}-${index}-${canvasImportSequenceRef.current}`;
        const objectUrl = URL.createObjectURL(file);
        localCanvasObjectUrlsRef.current.push(objectUrl);
        const asset = workspaceAssetRecordFromCanvasFile(file, kind, objectUrl, idSeed);
        if (!asset) {
          unsupportedFiles.push(file.name || 'Untitled file');
          return;
        }
        applyCanvasImportedNodeData({
          kind,
          nodeData: {
            subtitle: asset.filename,
            asset,
          },
          notice: targetNodeId ? `${asset.filename} attached to the media block.` : `${asset.filename} added to the canvas.`,
          position,
          targetNodeId,
        });
      });

      if (unsupportedFiles.length) {
        setNotice(`Unsupported file${unsupportedFiles.length > 1 ? 's' : ''}: ${unsupportedFiles.join(', ')}.`);
      }
    },
    [applyCanvasImportedNodeData, handleCanvasTextPaste, setNotice]
  );

  const handleSendProgramSnapshotToCanvas = useCallback(
    (snapshot: WorkspaceProgramSnapshotPayload) => {
      const snapshotUrl = snapshot.dataUrl ?? snapshot.sourceUrl;
      if (!snapshotUrl) {
        setNotice('No visible program frame is available for a snapshot.');
        return;
      }

      const importIndex = nodes.length + canvasImportSequenceRef.current;
      canvasImportSequenceRef.current += 1;
      const asset: WorkspaceAssetRecord = {
        id: createLocalCanvasImportId('program_snapshot'),
        kind: 'image',
        filename: snapshot.filename,
        subtitle: `Snapshot · ${snapshot.timecode}`,
        url: snapshotUrl,
        thumbUrl: snapshotUrl,
        dimensions: `${snapshot.width}x${snapshot.height}`,
      };
      const node = createAdHocWorkspaceNode('asset-image', importIndex, defaultModelId, {
        x: -260 + (importIndex % 4) * 180,
        y: -170 + Math.floor(importIndex / 4) * 140,
      });
      const snapshotNode: WorkspaceGraphNode = {
        ...node,
        data: {
          ...node.data,
          title: 'Program Snapshot',
          subtitle: asset.filename,
          asset,
        },
      };

      setNodes((current) => appendSelectedWorkspaceGraphNode(current, snapshotNode));
      setFocusMode('canvas');
      setActiveEditorSurface('canvas');
      setSelectedNodeId(snapshotNode.id);
      setNotice(`${asset.filename} sent to the canvas.`);
    },
    [defaultModelId, nodes.length, setActiveEditorSurface, setFocusMode, setNodes, setNotice, setSelectedNodeId]
  );

  return {
    handleCanvasFileDrop,
    handleCanvasTextPaste,
    handleSendProgramSnapshotToCanvas,
  };
}
