'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

export type MobileWorkspacePanel = 'media' | 'inspector' | null;

const FOCUSABLE_DRAWER_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableDrawerElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_DRAWER_SELECTOR)).filter((element) => (
    element.offsetParent !== null && element.getAttribute('aria-hidden') !== 'true'
  ));
}

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

  const handlePanelKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!activePanel) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusables = focusableDrawerElements(event.currentTarget);
    if (!focusables.length) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }, [activePanel, closePanel]);

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
      (closeButton ?? focusableDrawerElements(panelRef.current)[0] ?? panelRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePanel]);

  return {
    activePanel,
    closePanel,
    handlePanelKeyDown,
    inspectorPanelRef,
    projectMediaPanelRef,
    togglePanel,
  };
}
