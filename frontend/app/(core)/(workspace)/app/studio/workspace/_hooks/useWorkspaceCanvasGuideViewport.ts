'use client';

import type { Viewport } from '@xyflow/react';
import { useCallback, useMemo, useRef } from 'react';
import type {
  WorkspaceProjectStarterTemplateId,
  WorkspaceTemplateId,
} from '../_lib/workspace-types';

type UseWorkspaceCanvasGuideViewportParams = {
  activeTemplateId: WorkspaceTemplateId;
  activeUserCanvasTemplateId: string | null;
  canvasRevision: number;
  sourceTemplateId?: WorkspaceProjectStarterTemplateId;
};

function canvasViewportKey({
  activeTemplateId,
  activeUserCanvasTemplateId,
  canvasRevision,
  sourceTemplateId,
}: UseWorkspaceCanvasGuideViewportParams): string {
  const canvasIdentity = sourceTemplateId
    ? `source:${sourceTemplateId}`
    : activeUserCanvasTemplateId
      ? `canvas:${activeUserCanvasTemplateId}`
      : `template:${activeTemplateId}`;
  return `${canvasIdentity}:revision:${canvasRevision}`;
}

export function useWorkspaceCanvasGuideViewport(params: UseWorkspaceCanvasGuideViewportParams) {
  const completedInitialFitKeysRef = useRef(new Set<string>());
  const canvasViewportsRef = useRef(new Map<string, Viewport>());
  const key = canvasViewportKey(params);

  const initialFit = useMemo(() => ({
    isCompleted: () => completedInitialFitKeysRef.current.has(key),
    markCompleted: () => {
      completedInitialFitKeysRef.current.add(key);
    },
  }), [key]);

  const onViewportChange = useCallback((viewport: Viewport) => {
    canvasViewportsRef.current.set(key, viewport);
  }, [key]);

  return {
    initialFit,
    initialViewport: canvasViewportsRef.current.get(key) ?? null,
    onViewportChange,
  };
}
