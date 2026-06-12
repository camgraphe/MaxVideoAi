'use client';

import { useEffect, useRef, useState } from 'react';
import { useWorkspaceCanvasHistory } from './useWorkspaceCanvasHistory';
import type { WorkspaceGraphEdge, WorkspaceGraphNode } from '../_lib/workspace-types';

type UseWorkspaceCanvasGraphStateParams = {
  defaultEdges: WorkspaceGraphEdge[];
  defaultNodes: WorkspaceGraphNode[];
};

export function useWorkspaceCanvasGraphState({
  defaultEdges,
  defaultNodes,
}: UseWorkspaceCanvasGraphStateParams) {
  const nodesRef = useRef<WorkspaceGraphNode[]>(defaultNodes);
  const edgesRef = useRef<WorkspaceGraphEdge[]>(defaultEdges);
  const [nodes, setNodes] = useState<WorkspaceGraphNode[]>(defaultNodes);
  const [edges, setEdges] = useState<WorkspaceGraphEdge[]>(defaultEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const canvasHistoryController = useWorkspaceCanvasHistory({
    edgesRef,
    nodesRef,
    setEdges,
    setNodes,
    setSelectedNodeId,
  });

  return {
    canvasHistoryController,
    edges,
    edgesRef,
    nodes,
    nodesRef,
    selectedNodeId,
    setEdges,
    setNodes,
    setSelectedNodeId,
  };
}
