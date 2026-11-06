import { AUDIO_VOICE_ESTIMATE_WORDS_PER_MINUTE } from './audio-generation';

export const RECAST_MIN_SECONDS = 2;
export const RECAST_MAX_SECONDS = 30;
export const RECAST_MAX_SOURCE_SECONDS = 15;
export const RECAST_DEFAULT_SECONDS = 6;

export function getRecastTiming(input: {
  sourceSeconds: number | null;
  audioSeconds: number | null;
  dialogue: string;
  manualSeconds: number | null;
}) {
  const words = input.dialogue.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  const speechSeconds = words ? Math.ceil((words * 60) / AUDIO_VOICE_ESTIMATE_WORDS_PER_MINUTE) : null;
  const measuredSource = input.sourceSeconds;
  const validSource =
    measuredSource === null ||
    (Number.isFinite(measuredSource) && measuredSource > 0 && measuredSource <= RECAST_MAX_SOURCE_SECONDS);
  const maximum = validSource ? Math.floor(RECAST_MAX_SECONDS - (measuredSource ?? 0)) : RECAST_MAX_SECONDS;
  const suggested = Math.max(
    RECAST_MIN_SECONDS,
    Math.ceil(measuredSource ?? input.audioSeconds ?? speechSeconds ?? RECAST_DEFAULT_SECONDS),
  );
  const seconds = input.manualSeconds ?? suggested;
  const valid =
    validSource && Number.isInteger(seconds) && seconds >= RECAST_MIN_SECONDS && seconds <= maximum;
  const speechTooLong = Math.max(speechSeconds ?? 0, input.audioSeconds ?? 0) > seconds;
  return { words, speechSeconds, suggested, seconds, maximum, valid, speechTooLong };
}
