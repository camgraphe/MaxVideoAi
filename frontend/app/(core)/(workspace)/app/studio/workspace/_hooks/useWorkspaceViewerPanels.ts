'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ViewerPanelVisibility = {
  mediaVisible: boolean;
  inspectorVisible: boolean;
};

export type WorkspaceViewerPanels = ViewerPanelVisibility & {
  isViewerFocused: boolean;
  enterViewerFocus: () => void;
  exitViewerFocus: () => void;
  toggleInspector: () => void;
  toggleMedia: () => void;
};

const DEFAULT_VISIBILITY: ViewerPanelVisibility = {
  mediaVisible: true,
  inspectorVisible: true,
};

export function useWorkspaceViewerPanels(isViewerMode: boolean): WorkspaceViewerPanels {
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);
  const [isViewerFocused, setIsViewerFocused] = useState(false);
  const beforeFocusRef = useRef(DEFAULT_VISIBILITY);

  const exitViewerFocus = useCallback(() => {
    setIsViewerFocused(false);
    setVisibility(beforeFocusRef.current);
  }, []);

  const enterViewerFocus = useCallback(() => {
    setVisibility((current) => {
      beforeFocusRef.current = current;
      return { mediaVisible: false, inspectorVisible: false };
    });
    setIsViewerFocused(true);
  }, []);

  const toggleMedia = useCallback(() => {
    setVisibility((current) => ({ ...current, mediaVisible: !current.mediaVisible }));
  }, []);

  const toggleInspector = useCallback(() => {
    setVisibility((current) => ({ ...current, inspectorVisible: !current.inspectorVisible }));
  }, []);

  useEffect(() => {
    if (!isViewerMode && isViewerFocused) exitViewerFocus();
  }, [exitViewerFocus, isViewerFocused, isViewerMode]);

  useEffect(() => {
    if (!isViewerFocused) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      exitViewerFocus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exitViewerFocus, isViewerFocused]);

  return {
    ...visibility,
    isViewerFocused,
    enterViewerFocus,
    exitViewerFocus,
    toggleInspector,
    toggleMedia,
  };
}
