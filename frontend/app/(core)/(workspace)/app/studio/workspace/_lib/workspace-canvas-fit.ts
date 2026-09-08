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
        top: 128,
        right: 20,
        bottom: 92,
        left: 20,
      },
    };
  }

  return {
    includeHiddenNodes: false,
    padding: {
      top: 76,
      right: params.mapExpanded ? 204 : 24,
      bottom: 86,
      left: 24,
    },
  };
}
