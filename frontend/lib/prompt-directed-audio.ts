import type { EngineCaps } from '@/types/engines';

/** An authored sound-direction input describes native audio, not a binary provider switch. */
export function hasPromptDirectedNativeAudio(engine: Pick<EngineCaps, 'audio' | 'inputSchema'>, mode: string): boolean {
  if (!engine.audio) return false;
  const fields = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])]
    .filter(field => !field.modes?.length || field.modes.some(value => value === mode));
  const hasSwitch = fields.some(field =>
    ['audio', 'generate_audio', 'audio_enabled', 'enable_audio'].includes(field.id)
    && (field.type === 'boolean' || (field.type === 'enum' && field.values?.length
      && field.values.every(value => value === 'true' || value === 'false'))));
  return !hasSwitch && fields.some(field => field.id === 'prompt_audio_direction');
}
