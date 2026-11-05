import { KLING_V4_FLASH_ENGINE, KLING_V4_FLASH_DURATIONS } from '@/config/fal-engines/kling-v4-flash';
import { KLING_V4_ENGINE, KLING_V4_MODES, KLING_V4_DURATIONS, KLING_V4_RESOLUTIONS } from '@/config/fal-engines/kling-v4';
import type { PricingContext } from '@/lib/pricing-context';

/** Shared qualified timing facts; publication and customer amounts belong to callers. */
export function klingV4TariffContexts(engineId: 'kling-v4' | 'kling-v4-flash' = 'kling-v4'): Array<{ context: PricingContext; capabilityKey: string }> {
  const flash = engineId === 'kling-v4-flash';
  const modes = flash ? KLING_V4_FLASH_ENGINE.modes : [...KLING_V4_MODES];
  return modes.flatMap(mode => (flash ? ['720p'] : [...KLING_V4_RESOLUTIONS]).flatMap(resolution =>
    (flash ? KLING_V4_FLASH_DURATIONS : KLING_V4_DURATIONS).flatMap(duration => {
      const videoInputClasses = mode === 'ref2v' ? [false, true] : [mode === 'v2v'];
      return videoInputClasses.map(hasVideoInput => ({
        context: {
          engine: flash ? KLING_V4_FLASH_ENGINE : KLING_V4_ENGINE, mode, resolution, durationSec: Number(duration), hasVideoInput,
          ...(hasVideoInput ? { inputVideoDurationSec: 3 } : {}),
        },
        capabilityKey: `${engineId}:${mode}:${resolution}`,
      }));
    })));
}
