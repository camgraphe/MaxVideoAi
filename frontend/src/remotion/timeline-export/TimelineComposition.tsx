import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, Video, useVideoConfig } from 'remotion';
import type { WorkspaceTimelineRenderClip } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';
import type { TimelineExportRenderProps } from './types';

function secondsToFrames(seconds: number, fps: number): number {
  return Math.max(0, Math.round(seconds * fps));
}

function clipTransformStyle(clip: WorkspaceTimelineRenderClip): React.CSSProperties {
  const scale = clip.transform?.scale ?? 1;
  const x = clip.transform?.positionX ?? 0;
  const y = clip.transform?.positionY ?? 0;
  const rotation = clip.transform?.rotation ?? 0;
  const opacity = clip.transform?.opacity ?? 1;
  if (clip.composition) {
    return {
      position: 'absolute',
      left: clip.composition.left,
      top: clip.composition.top,
      width: clip.composition.width,
      height: clip.composition.height,
      objectFit: 'contain',
      opacity: clip.composition.opacity,
      transform: `translate(-50%, -50%) scale(${clip.composition.scale}) rotate(${clip.composition.rotation}deg)`,
      transformOrigin: 'center center',
    };
  }
  return {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    opacity,
    transform: `translate(${x}%, ${y}%) scale(${scale}) rotate(${rotation}deg)`,
    transformOrigin: 'center center',
  };
}

export function TimelineComposition(props: TimelineExportRenderProps) {
  const { fps } = useVideoConfig();
  const videoTracks = props.manifest.tracks.filter((track) => track.id.startsWith('video'));
  const audioTracks = props.manifest.tracks.filter((track) => track.id.startsWith('audio'));

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', overflow: 'hidden' }}>
      {videoTracks.map((track, trackIndex) =>
        track.clips.map((clip) => {
          const from = secondsToFrames(clip.startSec, fps);
          const durationInFrames = secondsToFrames(clip.durationSec, fps);
          const trimBefore = secondsToFrames(clip.sourceStartSec, fps);
          const trimAfter = secondsToFrames(clip.sourceEndSec, fps);
          return (
            <Sequence key={clip.id} from={from} durationInFrames={durationInFrames} premountFor={fps}>
              <AbsoluteFill style={{ zIndex: trackIndex + 1 }}>
                {clip.mediaKind === 'image' ? (
                  <Img src={clip.mediaUrl} style={clipTransformStyle(clip)} />
                ) : (
                  <Video
                    src={clip.mediaUrl}
                    trimBefore={trimBefore}
                    trimAfter={trimAfter}
                    muted={!props.includeAudio || clip.hasEmbeddedAudio === false || clip.audioMix?.muted}
                    volume={(clip.audioMix?.volume ?? 100) / 100}
                    style={clipTransformStyle(clip)}
                  />
                )}
              </AbsoluteFill>
            </Sequence>
          );
        })
      )}
      {props.includeAudio
        ? audioTracks.map((track) =>
            track.clips.map((clip) => (
              <Sequence
                key={clip.id}
                from={secondsToFrames(clip.startSec, fps)}
                durationInFrames={secondsToFrames(clip.durationSec, fps)}
                premountFor={fps}
              >
                <Audio
                  src={clip.mediaUrl}
                  trimBefore={secondsToFrames(clip.sourceStartSec, fps)}
                  trimAfter={secondsToFrames(clip.sourceEndSec, fps)}
                  muted={clip.audioMix?.muted}
                  volume={(clip.audioMix?.volume ?? 100) / 100}
                />
              </Sequence>
            ))
          )
        : null}
    </AbsoluteFill>
  );
}
