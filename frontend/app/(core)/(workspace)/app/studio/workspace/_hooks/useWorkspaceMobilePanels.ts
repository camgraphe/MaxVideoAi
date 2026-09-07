'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type MobileWorkspacePanel = 'media' | 'inspector' | null;

type UseWorkspaceMobilePanelsOptions = {
  canOpenInspector: boolean;
  canOpenProjectMedia: boolean;
  focusMode: string;
};

export function useWorkspaceMobilePanels({
  canOpenInspector,
  canOpenProjectMedia,
  focusMode,
}: UseWorkspaceMobilePanelsOptions) {
  const [activePanel, setActivePanel] = useState<MobileWorkspacePanel>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const projectMediaPanelRef = useRef<HTMLDivElement | null>(null);
  const inspectorPanelRef = useRef<HTMLDivElement | null>(null);

  const closePanel = useCallback(() => {
    setActivePanel(null);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  const togglePanel = useCallback((panel: Exclude<MobileWorkspacePanel, null>, trigger: HTMLButtonElement) => {
    setActivePanel((current) => {
      returnFocusRef.current = trigger;
      if (current === panel) {
        window.requestAnimationFrame(() => returnFocusRef.current?.focus());
        return null;
      }
      return panel;
    });
  }, []);

  useEffect(() => {
    setActivePanel(null);
  }, [focusMode]);

  useEffect(() => {
    if ((activePanel === 'media' && !canOpenProjectMedia) || (activePanel === 'inspector' && !canOpenInspector)) {
      setActivePanel(null);
    }
  }, [activePanel, canOpenInspector, canOpenProjectMedia]);

  useEffect(() => {
    if (!activePanel) return;
    const panelRef = activePanel === 'media' ? projectMediaPanelRef : inspectorPanelRef;
    const frame = window.requestAnimationFrame(() => {
      const closeButton = panelRef.current?.querySelector<HTMLElement>('[data-mobile-panel-close]');
      (closeButton ?? panelRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePanel]);

  return {
    activePanel,
    closePanel,
    inspectorPanelRef,
    projectMediaPanelRef,
    togglePanel,
  };
}
