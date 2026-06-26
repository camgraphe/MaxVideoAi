'use client';

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import {
  AUDIO_LYRIA3_BPM_VALUES,
  AUDIO_LYRIA3_CLIP_DURATION_OPTIONS_SEC,
  AUDIO_LYRIA3_MODEL_VALUES,
  AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC,
  DEFAULT_AUDIO_LYRIA3_BPM,
  DEFAULT_AUDIO_LYRIA3_MODEL,
  formatAudioDurationLabel,
  type AudioLyria3Bpm,
  type AudioLyria3Model,
  type AudioPackId,
} from '@/lib/audio-generation';
import type { AudioWorkspaceCopy } from '../copy';

type AudioOption = {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
};

export function useAudioLyriaMusicControls({
  copy,
  manualDurationSec,
  setManualDurationSec,
}: {
  copy: AudioWorkspaceCopy;
  manualDurationSec: number;
  setManualDurationSec: Dispatch<SetStateAction<number>>;
}) {
  const [musicModel, setMusicModel] = useState<AudioLyria3Model>(DEFAULT_AUDIO_LYRIA3_MODEL);
  const [musicBpm, setMusicBpm] = useState<AudioLyria3Bpm>(DEFAULT_AUDIO_LYRIA3_BPM);

  const musicModelOptions = useMemo<AudioOption[]>(
    () =>
      AUDIO_LYRIA3_MODEL_VALUES.map((value) => ({
        value,
        label: copy.controls.musicModels[value],
      })),
    [copy]
  );
  const musicBpmOptions = useMemo<AudioOption[]>(
    () =>
      AUDIO_LYRIA3_BPM_VALUES.map((value) => ({
        value,
        label: copy.controls.musicBpmValues[value],
      })),
    [copy]
  );
  const durationOptions = useMemo<AudioOption[]>(() => {
    const values: number[] =
      musicModel === 'clip'
        ? [...AUDIO_LYRIA3_CLIP_DURATION_OPTIONS_SEC]
        : [...AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC];
    if (!values.includes(manualDurationSec)) {
      values.push(manualDurationSec);
      values.sort((a, b) => a - b);
    }
    return values.map((value) => ({
      value,
      label: formatAudioDurationLabel(value),
    }));
  }, [manualDurationSec, musicModel]);

  const handleMusicModelChange = useCallback((nextModel: AudioLyria3Model) => {
    setMusicModel(nextModel);
    if (nextModel === 'clip') {
      setManualDurationSec(AUDIO_LYRIA3_CLIP_DURATION_OPTIONS_SEC[0]);
    }
  }, [setManualDurationSec]);

  const resetMusicControlsForPack = useCallback((pack: AudioPackId) => {
    if (pack !== 'music_only') return;
    setMusicModel(DEFAULT_AUDIO_LYRIA3_MODEL);
    setManualDurationSec(AUDIO_LYRIA3_CLIP_DURATION_OPTIONS_SEC[0]);
  }, [setManualDurationSec]);

  return {
    durationOptions,
    handleMusicModelChange,
    musicBpm,
    musicBpmOptions,
    musicModel,
    musicModelOptions,
    resetMusicControlsForPack,
    setMusicBpm,
    setMusicModel,
  };
}
