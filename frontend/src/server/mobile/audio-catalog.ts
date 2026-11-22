import {
  isMobileAudioMode,
  type MobileAudioCatalog,
  type MobileAudioMode,
  type MobileAudioControl,
} from '@/lib/mobile-audio-contract';
import {
  listAudioCapabilities,
  projectAudioVariantSettings,
} from '@/server/agent-api/audio-capabilities';

export function readMobileAudioCatalog(capabilities = listAudioCapabilities(), withReferences = false): MobileAudioCatalog {
  const modes: MobileAudioMode[] = [];
  for (const entry of capabilities.modes) {
    if (!isMobileAudioMode(entry.mode) || (!withReferences && entry.references.sourceVideo === 'required')) continue;
    const { mode, engineId, label, available, prompt, narration, lyrics, duration } = entry;
    modes.push({
      mode,
      engineId,
      label,
      available,
      prompt,
      narration,
      lyrics,
      ...(withReferences ? { references: {
        sourceVideo: entry.references.sourceVideo as 'required' | 'optional' | 'unsupported',
        voiceSample: entry.references.voiceSample === 'optional_seed_only' ? 'optional_seed_only' as const : 'unsupported' as const,
      }} : {}),
      duration: !withReferences && mode === 'music_only' ? { ...duration, source: 'requested' } : duration,
      variants: entry.variants.map((variant) => {
        const settings: Record<string, string | boolean> = {};
        for (const [key, value] of Object.entries(variant.settings)) {
          if (value != null) settings[key] = value;
        }
        return {
          settings,
          available: variant.available,
          controls: projectAudioVariantSettings(mode, variant),
        };
      }),
    });
  }
  return { modes, options: capabilities.options };
}

export function acceptsMobileAudioSetting(
  control: MobileAudioControl | undefined,
  value: string | boolean | number | null,
) {
  if (!control || value === null) return false;
  if (control.values) return control.values.includes(value);
  if (control.type === 'text')
    return typeof value === 'string' && value.length <= (control.maxChars ?? Infinity);
  return (
    control.type === 'number' &&
    typeof value === 'number' &&
    (!control.integer || Number.isInteger(value)) &&
    value >= (control.min ?? -Infinity) &&
    value <= (control.max ?? Infinity)
  );
}
