import type { WorkspaceTimelineRenderManifest } from '../../../app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render';

export type TimelineExportRenderProps = {
  manifest: WorkspaceTimelineRenderManifest;
  width: number;
  height: number;
  fps: number;
  includeAudio: boolean;
  mediaTrust: 'server-validated' | 'untrusted';
};
