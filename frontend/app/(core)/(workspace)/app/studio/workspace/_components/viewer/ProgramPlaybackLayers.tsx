'use client';

/* eslint-disable @next/next/no-img-element */

import { Film } from 'lucide-react';
import styles from '../../_styles/viewer.module.css';
import { clipVisualStyleFor } from './useProgramPlaybackSync';
import type { AudioPlaybackLayer, PlaybackLayer } from './useProgramPlaybackSync';

type ProgramPlaybackLayersProps = {
  audioPlaybackLayers: AudioPlaybackLayer[];
  linkedAudioGroupIds: Set<string>;
  playbackLayers: PlaybackLayer[];
  shouldShowEmptyState: boolean;
  registerPlaybackAudio: (audio: HTMLAudioElement | null) => void;
  registerPlaybackVideo: (video: HTMLVideoElement | null) => void;
  syncPlaybackAudios: () => void;
  syncPlaybackVideos: () => void;
};

export function ProgramPlaybackLayers({
  audioPlaybackLayers,
  linkedAudioGroupIds,
  playbackLayers,
  shouldShowEmptyState,
  registerPlaybackAudio,
  registerPlaybackVideo,
  syncPlaybackAudios,
  syncPlaybackVideos,
}: ProgramPlaybackLayersProps) {
  return (
    <>
      {playbackLayers.map((layer) => (
        layer.mediaKind === 'image' ? (
          <img
            key={layer.item.id}
            className={`${styles.viewerVideoLayer} ${layer.isVisible ? styles.viewerVideoLayerVisible : ''}`}
            data-playback-image-item-id={layer.item.id}
            src={layer.url}
            alt=""
            style={clipVisualStyleFor(layer)}
          />
        ) : (
          <video
            key={layer.item.id}
            ref={registerPlaybackVideo}
            className={`${styles.viewerVideoLayer} ${layer.isVisible ? styles.viewerVideoLayerVisible : ''}`}
            controls={false}
            data-playback-item-id={layer.item.id}
            muted={
              layer.opacity <= 0.001 ||
              Boolean(layer.item.audioMix?.muted) ||
              Boolean(layer.item.linkedGroupId && linkedAudioGroupIds.has(layer.item.linkedGroupId))
            }
            onLoadedMetadata={syncPlaybackVideos}
            playsInline
            preload="auto"
            src={layer.url}
            style={clipVisualStyleFor(layer)}
          />
        )
      ))}
      {audioPlaybackLayers.map((layer) => (
        <audio
          key={layer.item.id}
          ref={registerPlaybackAudio}
          className={styles.viewerAudioLayer}
          data-playback-audio-item-id={layer.item.id}
          data-playback-audio-muted={layer.item.audioMix?.muted ? 'true' : 'false'}
          data-playback-audio-track-id={layer.item.track}
          muted={Boolean(layer.item.audioMix?.muted)}
          onLoadedMetadata={syncPlaybackAudios}
          preload="auto"
          src={layer.url}
        />
      ))}
      {shouldShowEmptyState ? (
        <div className={styles.viewerEmpty}>
          <Film size={34} />
          <p>No playable clip selected</p>
          <span>Send a generated video to the timeline, then select it for preview.</span>
        </div>
      ) : null}
    </>
  );
}
