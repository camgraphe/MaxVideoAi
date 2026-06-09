'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type RefObject } from 'react';
import { useReactFlow, type XYPosition } from '@xyflow/react';

import {
  isWorkspaceNodeKind,
  PALETTE_DRAG_START_EVENT,
  palettePreviewForKind,
  type PaletteDragPreview,
  type PaletteDragStartDetail,
  WORKSPACE_NODE_KIND_DRAG_TYPE,
} from '../_components/canvas/CanvasPaletteDragPreview';
import type { WorkspaceGraphEdge, WorkspaceGraphNode, WorkspaceNodeKind } from '../_lib/workspace-types';

export type WorkspacePaletteDropRequest = {
  kind: WorkspaceNodeKind;
  position: XYPosition;
};

export type WorkspaceCanvasFileDropRequest = {
  files: File[];
  position: XYPosition;
  targetNodeId: string | null;
};

export type WorkspaceCanvasTextPasteRequest = {
  text: string;
  position: XYPosition;
  targetNodeId: string | null;
};

type UseCanvasControllerOptions = {
  canvasShellRef: RefObject<HTMLElement | null>;
  onCanvasFileDrop: (request: WorkspaceCanvasFileDropRequest) => void;
  onCanvasInteraction: () => void;
  onCanvasTextPaste: (request: WorkspaceCanvasTextPasteRequest) => void;
  onCreateNodeFromPaletteDrop: (request: WorkspacePaletteDropRequest) => void;
};

function targetNodeIdFromEventTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest('.react-flow__node')?.getAttribute('data-id') ?? null;
}

function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], audio, video'));
}

export function useCanvasController({
  canvasShellRef,
  onCanvasFileDrop,
  onCanvasInteraction,
  onCanvasTextPaste,
  onCreateNodeFromPaletteDrop,
}: UseCanvasControllerOptions) {
  const reactFlow = useReactFlow<WorkspaceGraphNode, WorkspaceGraphEdge>();
  const [paletteDragPreview, setPaletteDragPreview] = useState<PaletteDragPreview | null>(null);
  const paletteDragPreviewRef = useRef<PaletteDragPreview | null>(null);

  const updatePaletteDragPreview = useCallback((preview: PaletteDragPreview | null) => {
    paletteDragPreviewRef.current = preview;
    setPaletteDragPreview(preview);
  }, []);

  const canvasCenterFlowPosition = useCallback(() => {
    const rect = canvasShellRef.current?.getBoundingClientRect();
    if (!rect) return reactFlow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    return reactFlow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }, [canvasShellRef, reactFlow]);

  useEffect(() => {
    const handlePaletteDragStart = (event: Event) => {
      const detail = (event as CustomEvent<PaletteDragStartDetail>).detail;
      if (!detail || !isWorkspaceNodeKind(detail.kind)) return;
      const position = reactFlow.screenToFlowPosition({ x: detail.clientX, y: detail.clientY });
      updatePaletteDragPreview(palettePreviewForKind(detail.kind, position));
    };

    window.addEventListener(PALETTE_DRAG_START_EVENT, handlePaletteDragStart);
    return () => {
      window.removeEventListener(PALETTE_DRAG_START_EVENT, handlePaletteDragStart);
    };
  }, [reactFlow, updatePaletteDragPreview]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditablePasteTarget(event.target)) return;
      const target = event.target instanceof Element ? event.target : null;
      const activeElement = document.activeElement;
      const isNeutralDocumentPaste =
        !target ||
        target === document.body ||
        target === document.documentElement ||
        activeElement === document.body ||
        activeElement === document.documentElement;
      if (target && !canvasShellRef.current?.contains(target) && !isNeutralDocumentPaste) return;
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;
      const files = Array.from(clipboardData.files);
      const text = clipboardData.getData('text/plain').trim();
      if (!files.length && !text) return;

      event.preventDefault();
      onCanvasInteraction();
      const requestBase = {
        position: canvasCenterFlowPosition(),
        targetNodeId: targetNodeIdFromEventTarget(event.target),
      };
      if (files.length) {
        onCanvasFileDrop({
          ...requestBase,
          files,
        });
        return;
      }
      onCanvasTextPaste({
        ...requestBase,
        text,
      });
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [canvasCenterFlowPosition, canvasShellRef, onCanvasFileDrop, onCanvasInteraction, onCanvasTextPaste]);

  const isPaletteDragging = Boolean(paletteDragPreview);

  useEffect(() => {
    if (!isPaletteDragging) return;

    const clearPaletteDragPreview = () => {
      updatePaletteDragPreview(null);
    };
    const handleMove = (event: MouseEvent) => {
      const preview = paletteDragPreviewRef.current;
      if (!preview) return;
      updatePaletteDragPreview({
        ...preview,
        position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
    };
    const handleUp = (event: MouseEvent) => {
      const preview = paletteDragPreviewRef.current;
      clearPaletteDragPreview();
      if (!preview) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!(target instanceof Element) || !target.closest('[aria-label="MaxVideoAI editor canvas"]')) return;
      onCreateNodeFromPaletteDrop({
        kind: preview.kind,
        position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('dragend', clearPaletteDragPreview);
    window.addEventListener('drop', clearPaletteDragPreview);
    window.addEventListener('blur', clearPaletteDragPreview);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('dragend', clearPaletteDragPreview);
      window.removeEventListener('drop', clearPaletteDragPreview);
      window.removeEventListener('blur', clearPaletteDragPreview);
    };
  }, [isPaletteDragging, onCreateNodeFromPaletteDrop, reactFlow, updatePaletteDragPreview]);

  const handleDragOver = useCallback((event: ReactDragEvent) => {
    const dragTypes = Array.from(event.dataTransfer.types);
    if (
      !event.dataTransfer.files.length &&
      !dragTypes.includes('Files') &&
      !dragTypes.includes(WORKSPACE_NODE_KIND_DRAG_TYPE) &&
      !dragTypes.includes('text/plain')
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (event: ReactDragEvent) => {
      updatePaletteDragPreview(null);
      const files = Array.from(event.dataTransfer.files);
      if (files.length) {
        event.preventDefault();
        onCanvasInteraction();
        onCanvasFileDrop({
          files,
          position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          targetNodeId: targetNodeIdFromEventTarget(event.target),
        });
        return;
      }

      const nodeKind = event.dataTransfer.getData(WORKSPACE_NODE_KIND_DRAG_TYPE) || event.dataTransfer.getData('text/plain');
      if (!isWorkspaceNodeKind(nodeKind)) {
        const text = event.dataTransfer.getData('text/plain').trim();
        if (!text) return;
        event.preventDefault();
        onCanvasInteraction();
        onCanvasTextPaste({
          text,
          position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          targetNodeId: targetNodeIdFromEventTarget(event.target),
        });
        return;
      }
      event.preventDefault();
      onCanvasInteraction();
      onCreateNodeFromPaletteDrop({
        kind: nodeKind,
        position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
    },
    [onCanvasFileDrop, onCanvasInteraction, onCanvasTextPaste, onCreateNodeFromPaletteDrop, reactFlow, updatePaletteDragPreview]
  );

  return {
    handleDragOver,
    handleDrop,
    paletteDragPreview,
  };
}
