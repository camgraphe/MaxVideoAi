import type { FitViewOptions } from '@xyflow/react';

const COMPACT_CANVAS_BREAKPOINT = 700;

export function workspaceCanvasFitViewOptions(params: {
  mapExpanded: boolean;
  viewportHeight: number;
  viewportWidth: number;
}): FitViewOptions {
  if (params.viewportHeight <= 500 && params.viewportWidth >= 621) {
    return {
      includeHiddenNodes: false,
      padding: {
        top: '8px',
        right: '152px',
        bottom: '64px',
        left: '312px',
      },
    };
  }

  if (params.viewportWidth <= COMPACT_CANVAS_BREAKPOINT) {
    return {
      includeHiddenNodes: false,
      padding: {
        top: '128px',
        right: `${params.mapExpanded ? 204 : 20}px`,
        bottom: '128px',
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
