'use client';

import { useMemo } from 'react';

import {
  AUDIO_INTENSITY_VALUES,
  AUDIO_MOOD_VALUES,
  AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES,
  AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES,
  AUDIO_SEED_AUDIO_VOICE_VALUES,
} from '@/lib/audio-generation';
import type { AudioWorkspaceCopy } from '../copy';

const SEED_AUDIO_SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const SEED_AUDIO_VOLUME_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const SEED_AUDIO_PITCH_OPTIONS = [-12, -6, -3, 0, 3, 6, 12] as const;

export function useAudioOptionLists(copy: AudioWorkspaceCopy) {
  const intensityOptions = useMemo(
    () =>
      AUDIO_INTENSITY_VALUES.map((value) => ({
        value,
        label: copy.controls.intensities[value],
      })),
    [copy]
  );
  const moodOptions = useMemo(
    () =>
      AUDIO_MOOD_VALUES.map((value) => ({
        value,
        label: copy.controls.moods[value],
      })),
    [copy]
  );
  const seedAudioVoiceOptions = useMemo(
    () =>
      AUDIO_SEED_AUDIO_VOICE_VALUES.map((value) => ({
        value,
        label: copy.controls.seedAudioVoices[value],
      })),
    [copy]
  );
  const seedAudioOutputFormatOptions = useMemo(
    () =>
      AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES.map((value) => ({
        value,
        label: copy.controls.seedAudioOutputFormats[value],
      })),
    [copy]
  );
  const seedAudioSampleRateOptions = useMemo(
    () =>
      AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES.map((value) => ({
        value,
        label: value >= 1000 ? `${value / 1000} kHz` : `${value} Hz`,
      })),
    []
  );
  const seedAudioSpeedOptions = useMemo(
    () =>
      SEED_AUDIO_SPEED_OPTIONS.map((value) => ({
        value,
        label: `${value}x`,
      })),
    []
  );
  const seedAudioVolumeOptions = useMemo(
    () =>
      SEED_AUDIO_VOLUME_OPTIONS.map((value) => ({
        value,
        label: `${Math.round(value * 100)}%`,
      })),
    []
  );
  const seedAudioPitchOptions = useMemo(
    () =>
      SEED_AUDIO_PITCH_OPTIONS.map((value) => ({
        value,
        label: value === 0 ? '0 st' : `${value > 0 ? '+' : ''}${value} st`,
      })),
    []
  );

  return {
    intensityOptions,
    moodOptions,
    seedAudioOutputFormatOptions,
    seedAudioPitchOptions,
    seedAudioSampleRateOptions,
    seedAudioSpeedOptions,
    seedAudioVoiceOptions,
    seedAudioVolumeOptions,
  };
}
