import React from 'react';
import {SubtitleOverlay} from '../../lib/subtitles/SubtitleOverlay';
import {TimelineSubtitleOverlay} from '../../lib/subtitles/TimelineSubtitleOverlay';
import { AbsoluteFill, Audio, Img, Sequence, OffthreadVideo, useVideoConfig, useCurrentFrame } from 'remotion';
import type { WorkspaceTimelineRenderClip } from '../../../app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render';
import type { TimelineExportRenderProps } from './types';
import {
  resolveWorkspaceAudioProvenance,
  shouldMuteWorkspaceTimelineVideo,
} from '../../../app/(core)/(workspace)/app/studio/_shared/_lib/workspace-audio-provenance';

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
  const { fps,width,height } = useVideoConfig();
  const frame=useCurrentFrame();
  if (props.mediaTrust !== 'server-validated' && props.manifest.tracks.some((track) => track.clips.length > 0)) {
    throw new Error('TIMELINE_EXPORT_MEDIA_NOT_VALIDATED');
  }
  const videoTracks = props.manifest.tracks.filter((track) => track.id.startsWith('video'));
  const audioTracks = props.manifest.tracks.filter((track) => track.id.startsWith('audio'));
  const externalAudioGroupIds = new Set(audioTracks.flatMap((track) => (
    track.clips
      .filter((clip) => clip.linkedGroupId && clip.audioProvenance !== 'none')
      .map((clip) => clip.linkedGroupId as string)
  )));

  if(props.audioOnly){
    const audible=props.manifest.tracks.flatMap(track=>track.clips).filter(clip=>props.includeAudio&&clip.mediaKind!=='image'&&(!clip.audioMix?.muted)&&(clip.mediaKind==='audio'||!shouldMuteWorkspaceTimelineVideo({includeAudio:true,audioProvenance:resolveWorkspaceAudioProvenance({kind:'video',audioProvenance:clip.audioProvenance,hasAudio:clip.hasEmbeddedAudio}),hasExternalLinkedAudio:Boolean(clip.linkedGroupId&&externalAudioGroupIds.has(clip.linkedGroupId)),audioMixMuted:false})));
    return <AbsoluteFill>{audible.map(clip=><Sequence key={clip.id} from={secondsToFrames(clip.startSec,fps)} durationInFrames={secondsToFrames(clip.durationSec,fps)}><Audio src={clip.mediaUrl} trimBefore={secondsToFrames(clip.sourceStartSec,fps)} trimAfter={secondsToFrames(clip.sourceEndSec,fps)} volume={(clip.audioMix?.volume??100)/100}/></Sequence>)}</AbsoluteFill>;
  }

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
                  <OffthreadVideo
                    src={clip.mediaUrl}
                    trimBefore={trimBefore}
                    trimAfter={trimAfter}
                    muted={shouldMuteWorkspaceTimelineVideo({
                      includeAudio: props.includeAudio,
                      audioProvenance: resolveWorkspaceAudioProvenance({
                        kind: 'video',
                        audioProvenance: clip.audioProvenance,
                        hasAudio: clip.hasEmbeddedAudio,
                      }),
                      hasExternalLinkedAudio: Boolean(
                        clip.linkedGroupId && externalAudioGroupIds.has(clip.linkedGroupId)
                      ),
                      audioMixMuted: Boolean(clip.audioMix?.muted),
                    })}
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
      {props.manifest.sequenceSubtitleDocument?<div style={{position:'absolute',inset:0,zIndex:100}}><SubtitleOverlay document={props.manifest.sequenceSubtitleDocument} timeMs={(frame/fps+props.manifest.exportRange.startSec)*1000} width={width} height={height}/></div>:<TimelineSubtitleOverlay items={props.manifest.tracks.flatMap(track=>track.clips)} timeMs={frame/fps*1000} width={width} height={height}/>}
    </AbsoluteFill>
  );
}
