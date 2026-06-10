export type TimelinePerformanceMarker =
  | 'drag-start'
  | 'drag-frame'
  | 'drag-commit'
  | 'playhead-frame'
  | 'playhead-commit';

export function markTimelinePerformance(name: TimelinePerformanceMarker) {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
  performance.mark(`maxvideoai.timeline.${name}`);
}
