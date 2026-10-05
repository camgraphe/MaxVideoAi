import { useCallback, useEffect, useRef, useState } from 'react';

import { formatWorkspaceTimecode } from '../_lib/workspace-timecode';
import type { StudioCopy } from '../../_lib/studio-copy';

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

type UseWorkspaceTimelinePlaybackOptions = {
  onNotice: (notice: string) => void;
  onResetExportRangeMode: () => void;
  projectFps: number;
  studioNotices: StudioCopy['notices'];
  timelineCutPoints: number[];
  timelineDurationSec: number;
};

export function useWorkspaceTimelinePlayback({
  onNotice,
  onResetExportRangeMode,
  projectFps,
  studioNotices,
  timelineCutPoints,
  timelineDurationSec,
}: UseWorkspaceTimelinePlaybackOptions) {
  const playbackFrameRef = useRef<number | null>(null);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [timelineInPointSec, setTimelineInPointSec] = useState<number | null>(null);
  const [timelineOutPointSec, setTimelineOutPointSec] = useState<number | null>(null);
  const timelineCutToleranceSec = 1 / Math.max(1, projectFps || 24) / 2;

  const stopTimelinePlayback = useCallback(() => {
    setIsTimelinePlaying(false);
  }, []);

  const handleToggleTimelinePlayback = useCallback(() => {
    if (timelineDurationSec <= 0) return;
    setIsTimelinePlaying((currentlyPlaying) => {
      if (!currentlyPlaying && playheadSec >= timelineDurationSec) {
        setPlayheadSec(0);
      }
      return !currentlyPlaying;
    });
  }, [playheadSec, timelineDurationSec]);

  const handleGoToTimelineCut = useCallback((direction: -1 | 1) => {
    const cutPointSec = direction > 0
      ? timelineCutPoints.find((candidateSec) => candidateSec > playheadSec + timelineCutToleranceSec)
      : [...timelineCutPoints].reverse().find((candidateSec) => candidateSec < playheadSec - timelineCutToleranceSec);
    if (cutPointSec === undefined) return;
    setIsTimelinePlaying(false);
    setPlayheadSec(cutPointSec);
  }, [playheadSec, timelineCutPoints, timelineCutToleranceSec]);

  const handleMarkTimelineIn = useCallback(() => {
    const nextInPointSec = Math.max(0, Math.min(playheadSec, timelineDurationSec));
    setTimelineInPointSec(nextInPointSec);
    onNotice(formatNotice(studioNotices.inPointSet, { timecode: formatWorkspaceTimecode(nextInPointSec, projectFps) }));
  }, [onNotice, playheadSec, projectFps, studioNotices.inPointSet, timelineDurationSec]);

  const handleMarkTimelineOut = useCallback(() => {
    const nextOutPointSec = Math.max(0, Math.min(playheadSec, timelineDurationSec));
    setTimelineOutPointSec(nextOutPointSec);
    onNotice(formatNotice(studioNotices.outPointSet, { timecode: formatWorkspaceTimecode(nextOutPointSec, projectFps) }));
  }, [onNotice, playheadSec, projectFps, studioNotices.outPointSet, timelineDurationSec]);

  const handleClearTimelineInOut = useCallback(() => {
    setTimelineInPointSec(null);
    setTimelineOutPointSec(null);
    onResetExportRangeMode();
    onNotice(studioNotices.inOutPointsCleared);
  }, [onNotice, onResetExportRangeMode, studioNotices.inOutPointsCleared]);

  useEffect(() => {
    if (playheadSec <= timelineDurationSec) return;
    setPlayheadSec(timelineDurationSec);
  }, [playheadSec, timelineDurationSec]);

  useEffect(() => {
    setTimelineInPointSec((current) => (current !== null && current > timelineDurationSec ? timelineDurationSec : current));
    setTimelineOutPointSec((current) => (current !== null && current > timelineDurationSec ? timelineDurationSec : current));
  }, [timelineDurationSec]);

  useEffect(() => {
    if (!isTimelinePlaying || timelineDurationSec <= 0 || typeof window === 'undefined') return undefined;
    let previousTimestamp = Date.now();

    const tick = () => {
      const timestamp = Date.now();
      const deltaSec = (timestamp - previousTimestamp) / 1000;
      previousTimestamp = timestamp;
      setPlayheadSec((current) => {
        const nextPlayheadSec = Math.min(timelineDurationSec, current + deltaSec);
        if (nextPlayheadSec >= timelineDurationSec) {
          setIsTimelinePlaying(false);
          return timelineDurationSec;
        }
        return nextPlayheadSec;
      });
    };

    playbackFrameRef.current = window.setInterval(tick, 50);
    return () => {
      if (playbackFrameRef.current !== null) {
        window.clearInterval(playbackFrameRef.current);
        playbackFrameRef.current = null;
      }
    };
  }, [isTimelinePlaying, timelineDurationSec]);

  return {
    handleClearTimelineInOut,
    handleGoToTimelineCut,
    handleMarkTimelineIn,
    handleMarkTimelineOut,
    handleToggleTimelinePlayback,
    isTimelinePlaying,
    playheadSec,
    setIsTimelinePlaying,
    setPlayheadSec,
    setTimelineInPointSec,
    setTimelineOutPointSec,
    stopTimelinePlayback,
    timelineCutToleranceSec,
    timelineInPointSec,
    timelineOutPointSec,
  };
}
