'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';
import { useReactFlow, type XYPosition } from '@xyflow/react';

import {
  isWorkspaceNodeKind,
  PALETTE_DRAG_START_EVENT,
  PALETTE_PLACEMENT_ARM_EVENT,
  palettePreviewForKind,
  type PaletteDragPreview,
  type PalettePlacementArmDetail,
  type PaletteDragStartDetail,
  WORKSPACE_NODE_KIND_DRAG_TYPE,
} from '../_components/canvas/CanvasPaletteDragPreview';
import type {
  WorkspaceGenerationPresetId,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceNodeKind,
} from '../_lib/workspace-types';
import type { StudioCopy } from '../../_lib/studio-copy';

export const WORKSPACE_GRAPH_CLIPBOARD_TYPE = 'application/x-maxvideoai-canvas-graph';
export const WORKSPACE_GRAPH_CLIPBOARD_TEXT = 'MaxVideoAI canvas graph selection';

export type WorkspacePaletteDropRequest = {
  kind: WorkspaceNodeKind;
  presetId?: WorkspaceGenerationPresetId;
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
  copy: StudioCopy['canvas']['nodes'];
  onCanvasFileDrop: (request: WorkspaceCanvasFileDropRequest) => void;
  onCanvasGraphPaste: (center: XYPosition) => void;
  onCanvasInteraction: () => void;
  onCanvasTextPaste: (request: WorkspaceCanvasTextPasteRequest) => void;
  onCreateNodeFromPaletteDrop: (request: WorkspacePaletteDropRequest) => void;
};

type PaletteInteractionMode = 'drag' | 'placement';

function targetNodeIdFromEventTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest('.react-flow__node')?.getAttribute('data-id') ?? null;
}

function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], audio, video, [role="dialog"], [aria-modal="true"]'));
}

export function useCanvasController({
  canvasShellRef,
  copy,
  onCanvasFileDrop,
  onCanvasGraphPaste,
  onCanvasInteraction,
  onCanvasTextPaste,
  onCreateNodeFromPaletteDrop,
}: UseCanvasControllerOptions) {
  const reactFlow = useReactFlow<WorkspaceGraphNode, WorkspaceGraphEdge>();
  const [paletteDragPreview, setPaletteDragPreview] = useState<PaletteDragPreview | null>(null);
  const [paletteInteractionMode, setPaletteInteractionMode] = useState<PaletteInteractionMode | null>(null);
  const paletteDragPreviewRef = useRef<PaletteDragPreview | null>(null);
  const paletteInteractionModeRef = useRef<PaletteInteractionMode | null>(null);

  const updatePaletteDragPreview = useCallback((preview: PaletteDragPreview | null, mode?: PaletteInteractionMode | null) => {
    paletteDragPreviewRef.current = preview;
    const nextMode = preview ? mode ?? paletteInteractionModeRef.current ?? 'drag' : null;
    paletteInteractionModeRef.current = nextMode;
    setPaletteInteractionMode(nextMode);
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
      updatePaletteDragPreview(palettePreviewForKind(detail.kind, position, copy, detail.presetId), 'drag');
    };
    const handlePalettePlacementArm = (event: Event) => {
      const detail = (event as CustomEvent<PalettePlacementArmDetail>).detail;
      if (!detail || !isWorkspaceNodeKind(detail.kind)) return;
      const position = reactFlow.screenToFlowPosition({ x: detail.clientX, y: detail.clientY });
      updatePaletteDragPreview(palettePreviewForKind(detail.kind, position, copy, detail.presetId), 'placement');
    };

    window.addEventListener(PALETTE_DRAG_START_EVENT, handlePaletteDragStart);
    window.addEventListener(PALETTE_PLACEMENT_ARM_EVENT, handlePalettePlacementArm);
    return () => {
      window.removeEventListener(PALETTE_DRAG_START_EVENT, handlePaletteDragStart);
      window.removeEventListener(PALETTE_PLACEMENT_ARM_EVENT, handlePalettePlacementArm);
    };
  }, [copy, reactFlow, updatePaletteDragPreview]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditablePasteTarget(event.target) || isEditablePasteTarget(document.activeElement)) return;
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
      const types = Array.from(clipboardData.types);
      if (types.includes(WORKSPACE_GRAPH_CLIPBOARD_TYPE) || text === WORKSPACE_GRAPH_CLIPBOARD_TEXT) {
        event.preventDefault();
        onCanvasInteraction();
        onCanvasGraphPaste(canvasCenterFlowPosition());
        return;
      }
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
  }, [canvasCenterFlowPosition, canvasShellRef, onCanvasFileDrop, onCanvasGraphPaste, onCanvasInteraction, onCanvasTextPaste]);

  const isPaletteDragging = paletteInteractionMode === 'drag';
  const isPalettePlacementArmed = paletteInteractionMode === 'placement';

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
      if (!(target instanceof Element) || !target.closest('[data-studio-canvas-shell="true"]')) return;
      onCreateNodeFromPaletteDrop({
        kind: preview.kind,
        presetId: preview.presetId,
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

  useEffect(() => {
    if (!isPalettePlacementArmed) return;

    const clearPalettePlacement = () => {
      updatePaletteDragPreview(null);
    };
    const handlePalettePlacementMove = (event: MouseEvent) => {
      const preview = paletteDragPreviewRef.current;
      if (!preview) return;
      updatePaletteDragPreview({
        ...preview,
        position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
    };
    const handlePalettePlacementKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        clearPalettePlacement();
      }
    };
    const handlePalettePlacementPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-studio-canvas-shell="true"]')) return;
      clearPalettePlacement();
    };

    window.addEventListener('mousemove', handlePalettePlacementMove);
    window.addEventListener('keydown', handlePalettePlacementKeyDown, { capture: true });
    window.addEventListener('mousedown', handlePalettePlacementPointerDown);
    window.addEventListener('blur', clearPalettePlacement);
    return () => {
      window.removeEventListener('mousemove', handlePalettePlacementMove);
      window.removeEventListener('keydown', handlePalettePlacementKeyDown, true);
      window.removeEventListener('mousedown', handlePalettePlacementPointerDown);
      window.removeEventListener('blur', clearPalettePlacement);
    };
  }, [isPalettePlacementArmed, reactFlow, updatePaletteDragPreview]);

  const handlePalettePlacementCommit = useCallback(
    (event: ReactMouseEvent) => {
      if (paletteInteractionModeRef.current !== 'placement') return false;
      const preview = paletteDragPreviewRef.current;
      updatePaletteDragPreview(null);
      if (!preview) return false;
      onCanvasInteraction();
      onCreateNodeFromPaletteDrop({
        kind: preview.kind,
        presetId: preview.presetId,
        position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
      return true;
    },
    [onCanvasInteraction, onCreateNodeFromPaletteDrop, reactFlow, updatePaletteDragPreview]
  );

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
    handlePalettePlacementCommit,
    paletteDragPreview,
  };
}
