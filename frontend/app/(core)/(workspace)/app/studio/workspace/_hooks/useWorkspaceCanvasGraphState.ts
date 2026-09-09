'use client';

import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { useWorkspaceCanvasHistory } from './useWorkspaceCanvasHistory';
import type { WorkspaceCanvasGuideState, WorkspaceGraphEdge, WorkspaceGraphNode } from '../_lib/workspace-types';

type UseWorkspaceCanvasGraphStateParams = {
  defaultEdges: WorkspaceGraphEdge[];
  defaultGuideState: WorkspaceCanvasGuideState;
  defaultNodes: WorkspaceGraphNode[];
  defaultSelectedNodeId?: string | null;
};

export function useWorkspaceCanvasGraphState({
  defaultEdges,
  defaultGuideState,
  defaultNodes,
  defaultSelectedNodeId,
}: UseWorkspaceCanvasGraphStateParams) {
  const nodesRef = useRef<WorkspaceGraphNode[]>(defaultNodes);
  const edgesRef = useRef<WorkspaceGraphEdge[]>(defaultEdges);
  const guideStateRef = useRef<WorkspaceCanvasGuideState>(defaultGuideState);
  const [nodes, setNodes] = useState<WorkspaceGraphNode[]>(defaultNodes);
  const [edges, setEdges] = useState<WorkspaceGraphEdge[]>(defaultEdges);
  const [guideState, setGuideStateState] = useState<WorkspaceCanvasGuideState>(defaultGuideState);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(defaultSelectedNodeId ?? null);

  const setGuideState = useCallback((value: SetStateAction<WorkspaceCanvasGuideState>) => {
    setGuideStateState((current) => {
      const next = typeof value === 'function'
        ? (value as (current: WorkspaceCanvasGuideState) => WorkspaceCanvasGuideState)(current)
        : value;
      guideStateRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    guideStateRef.current = guideState;
  }, [guideState]);

  const canvasHistoryController = useWorkspaceCanvasHistory({
    edgesRef,
    guideStateRef,
    nodesRef,
    setEdges,
    setGuideState,
    setNodes,
    setSelectedNodeId,
  });

  return {
    canvasHistoryController,
    edges,
    edgesRef,
    guideState,
    guideStateRef,
    nodes,
    nodesRef,
    selectedNodeId,
    setEdges,
    setGuideState,
    setNodes,
    setSelectedNodeId,
  };
}
