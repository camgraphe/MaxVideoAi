'use client';

import { createContext, useContext, type ReactNode } from 'react';

type CanvasNodeActions = {
  isSingleSelection: boolean;
  onConnections: (nodeId: string) => void;
  onCopyNode: (nodeId: string) => Promise<boolean>;
  onDeleteNode: (nodeId: string) => void;
};

const CanvasNodeActionsContext = createContext<CanvasNodeActions | null>(null);

export function CanvasNodeActionsProvider({
  children,
  isSingleSelection,
  onConnections,
  onCopyNode,
  onDeleteNode,
}: CanvasNodeActions & { children: ReactNode }) {
  return (
    <CanvasNodeActionsContext.Provider value={{ isSingleSelection, onConnections, onCopyNode, onDeleteNode }}>
      {children}
    </CanvasNodeActionsContext.Provider>
  );
}

export function useCanvasNodeActions(): CanvasNodeActions | null {
  return useContext(CanvasNodeActionsContext);
}
