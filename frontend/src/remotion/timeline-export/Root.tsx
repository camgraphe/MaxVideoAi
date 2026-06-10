import React from 'react';
import { Composition } from 'remotion';
import { TimelineComposition } from './TimelineComposition';
import type { TimelineExportRenderProps } from './types';

const defaultProps: TimelineExportRenderProps = {
  manifest: {
    version: 1,
    source: 'maxvideoai-editor',
    projectName: 'Timeline Export',
    sequenceId: 'sequence-main',
    sequenceName: 'Main sequence',
    createdAt: new Date(0).toISOString(),
    status: 'ready',
    durationSec: 1,
    exportRange: { mode: 'sequence', startSec: 0, endSec: 1, durationSec: 1 },
    tracks: [],
    issues: [],
  },
  width: 1920,
  height: 1080,
  fps: 30,
  includeAudio: true,
};

export function RemotionTimelineExportRoot() {
  return (
    <Composition
      id="MaxVideoAITimelineExport"
      component={TimelineComposition}
      durationInFrames={30}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, Math.ceil(props.manifest.durationSec * props.fps)),
        fps: props.fps,
        width: props.width,
        height: props.height,
      })}
    />
  );
}

export default RemotionTimelineExportRoot;
