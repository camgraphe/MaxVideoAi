import { KLING_V4_ENGINE, KLING_V4_MODES, KLING_V4_DURATIONS, KLING_V4_RESOLUTIONS } from '@/config/fal-engines/kling-v4';
import type { PricingContext } from '@/lib/pricing-context';

/** Shared qualified timing facts; publication and customer amounts belong to callers. */
export function klingV4TariffContexts(): Array<{ context: PricingContext; capabilityKey: string }> {
  return KLING_V4_MODES.flatMap(mode => KLING_V4_RESOLUTIONS.flatMap(resolution =>
    KLING_V4_DURATIONS.flatMap(duration => {
      const videoInputClasses = mode === 'ref2v' ? [false, true] : [mode === 'v2v'];
      return videoInputClasses.map(hasVideoInput => ({
        context: {
          engine: KLING_V4_ENGINE, mode, resolution, durationSec: Number(duration), hasVideoInput,
          ...(hasVideoInput ? { inputVideoDurationSec: 3 } : {}),
        },
        capabilityKey: `kling-v4:${mode}:${resolution}`,
      }));
    })));
}
