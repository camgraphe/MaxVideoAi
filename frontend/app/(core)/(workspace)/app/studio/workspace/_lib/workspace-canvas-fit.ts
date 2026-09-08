import type { FitViewOptions } from '@xyflow/react';

const COMPACT_CANVAS_BREAKPOINT = 700;

export function workspaceCanvasFitViewOptions(params: {
  mapExpanded: boolean;
  viewportWidth: number;
}): FitViewOptions {
  if (params.viewportWidth <= COMPACT_CANVAS_BREAKPOINT) {
    return {
      includeHiddenNodes: false,
      padding: {
        top: '128px',
        right: `${params.mapExpanded ? 204 : 20}px`,
        bottom: '92px',
        left: '20px',
      },
    };
  }

  return {
    includeHiddenNodes: false,
    padding: {
      top: '76px',
      right: `${params.mapExpanded ? 204 : 24}px`,
      bottom: '86px',
      left: '24px',
    },
  };
}
