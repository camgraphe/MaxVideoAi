'use client';

import styles from '../maxvideoai-editor.module.css';
import type { WorkspaceProjectSettings, WorkspaceTimelineItem } from '../_lib/workspace-types';
import { formatWorkspaceTimecode } from '../_lib/workspace-timecode';
import { ProgramControls } from './viewer/ProgramControls';
import { ProgramMonitor } from './viewer/ProgramMonitor';
import { ProgramPlaybackLayers } from './viewer/ProgramPlaybackLayers';
import { useProgramPlaybackSync } from './viewer/useProgramPlaybackSync';
import type { WorkspaceProgramSnapshotPayload } from './viewer/useProgramPlaybackSync';

export type { WorkspaceProgramSnapshotPayload } from './viewer/useProgramPlaybackSync';

type WorkspaceVideoViewerProps = {
  canGoToNextCut: boolean;
  canGoToPreviousCut: boolean;
  inPointSec: number | null;
  isPlaying: boolean;
  items: WorkspaceTimelineItem[];
  outPointSec: number | null;
  playheadSec: number;
  projectSettings: WorkspaceProjectSettings;
  selectedItemId: string | null;
  onClearInOut: () => void;
  onGoToNextCut: () => void;
  onGoToPreviousCut: () => void;
  onMarkIn: () => void;
  onMarkOut: () => void;
  onSelectItem: (itemId: string) => void;
  onSendSnapshotToCanvas: (snapshot: WorkspaceProgramSnapshotPayload) => void;
  onTogglePlayback: () => void;
};

function programModelLabel(modelId?: string): string | null {
  if (!modelId) return null;
  const knownLabels: Record<string, string> = {
    'kling-3-pro': 'Kling 3 Pro',
    'kling-3-omni-standard': 'Kling 3.0 Omni',
    'seedance-2': 'Seedance 2.0',
    'seedance-2-pro': 'Seedance 2.0 Pro',
    'veo-3-1': 'Veo 3.1',
    'veo-3-1-fast': 'Veo 3.1 Fast',
    'veo-3-1-lite': 'Veo 3.1 Lite',
  };
  if (knownLabels[modelId]) return knownLabels[modelId];
  return modelId
    .split('-')
    .filter(Boolean)
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

export function WorkspaceVideoViewer({
  canGoToNextCut,
  canGoToPreviousCut,
  inPointSec,
  isPlaying,
  items,
  outPointSec,
  playheadSec,
  projectSettings,
  selectedItemId,
  onClearInOut,
  onGoToNextCut,
  onGoToPreviousCut,
  onMarkIn,
  onMarkOut,
  onSelectItem,
  onSendSnapshotToCanvas,
  onTogglePlayback,
}: WorkspaceVideoViewerProps) {
  const {
    activePlaybackItem,
    audioPlaybackLayers,
    handleSendSnapshotToCanvas,
    hasVisiblePlayableLayer,
    linkedAudioGroupIds,
    playbackLayers,
    registerPlaybackAudio,
    registerPlaybackVideo,
    shouldShowEmptyState,
    syncPlaybackAudios,
    syncPlaybackVideos,
    timelineDurationSec,
  } = useProgramPlaybackSync({
    isPlaying,
    items,
    playheadSec,
    projectSettings,
    selectedItemId,
    onSelectItem,
    onSendSnapshotToCanvas,
  });
  const safeInPointSec = typeof inPointSec === 'number' && Number.isFinite(inPointSec) ? inPointSec : null;
  const safeOutPointSec = typeof outPointSec === 'number' && Number.isFinite(outPointSec) ? outPointSec : null;
  const hasInOutMarks = safeInPointSec !== null || safeOutPointSec !== null;
  const inTimecode = safeInPointSec === null ? '--:--:--:--' : formatWorkspaceTimecode(safeInPointSec, projectSettings.fps);
  const outTimecode = safeOutPointSec === null ? '--:--:--:--' : formatWorkspaceTimecode(safeOutPointSec, projectSettings.fps);
  const playheadTimecode = formatWorkspaceTimecode(playheadSec, projectSettings.fps);
  const timelineDurationTimecode = formatWorkspaceTimecode(timelineDurationSec, projectSettings.fps);
  const activeModelLabel = programModelLabel(activePlaybackItem?.modelId);

  return (
    <section className={styles.videoViewerShell} aria-label="Montage video viewer" data-testid="editor-video-viewer">
      <div className={styles.viewerStage}>
        <ProgramMonitor
          activeModelLabel={activeModelLabel}
          playheadSec={playheadSec}
          playheadTimecode={playheadTimecode}
          projectSettings={projectSettings}
          layers={(
            <ProgramPlaybackLayers
              audioPlaybackLayers={audioPlaybackLayers}
              linkedAudioGroupIds={linkedAudioGroupIds}
              playbackLayers={playbackLayers}
              registerPlaybackAudio={registerPlaybackAudio}
              registerPlaybackVideo={registerPlaybackVideo}
              shouldShowEmptyState={shouldShowEmptyState}
              syncPlaybackAudios={syncPlaybackAudios}
              syncPlaybackVideos={syncPlaybackVideos}
            />
          )}
          controls={(
            <ProgramControls
              canGoToNextCut={canGoToNextCut}
              canGoToPreviousCut={canGoToPreviousCut}
              hasInOutMarks={hasInOutMarks}
              hasVisiblePlayableLayer={hasVisiblePlayableLayer}
              inTimecode={inTimecode}
              isPlaying={isPlaying}
              outTimecode={outTimecode}
              playheadSec={playheadSec}
              playheadTimecode={playheadTimecode}
              timelineDurationSec={timelineDurationSec}
              timelineDurationTimecode={timelineDurationTimecode}
              onClearInOut={onClearInOut}
              onGoToNextCut={onGoToNextCut}
              onGoToPreviousCut={onGoToPreviousCut}
              onMarkIn={onMarkIn}
              onMarkOut={onMarkOut}
              onSendSnapshotToCanvas={handleSendSnapshotToCanvas}
              onTogglePlayback={onTogglePlayback}
            />
          )}
        />
      </div>
    </section>
  );
}
