import type { GeneratePayload } from '@/lib/fal-types';

/** Dated Fal contracts reviewed 2026-10-24; normalize a fresh body, never saved settings. */
export function applyFalLegacyVideoContracts(
  payload: GeneratePayload,
  requestBody: Record<string, unknown>,
): void {
  const mode = payload.mode ?? 't2v';
  const kling26 = payload.engineId === 'kling-2-6-pro';
  const kling25Pro = payload.engineId === 'kling-2-5-turbo' && (mode === 't2v' || mode === 'i2v');
  if (kling26 || kling25Pro) {
    const duration = payload.durationOption ?? payload.durationSec ?? requestBody.duration;
    if (duration != null) requestBody.duration = String(duration);
    if (mode === 'i2v') {
      delete requestBody.aspect_ratio;
      if (kling26) {
        if (!requestBody.start_image_url && requestBody.image_url) {
          requestBody.start_image_url = requestBody.image_url;
        }
        delete requestBody.image_url;
        delete requestBody.cfg_scale;
      } else {
        if (requestBody.end_image_url) requestBody.tail_image_url = requestBody.end_image_url;
        delete requestBody.end_image_url;
      }
    }
    delete requestBody.seed;
    delete requestBody.resolution;
  }

  const unsupportedLtxGuidance =
    ((payload.engineId === 'ltx-2-3' || payload.engineId === 'ltx-2-3-fast') && mode === 'i2v')
    || ((payload.engineId === 'ltx-2-5-pro' || payload.engineId === 'ltx-2-5-fast') && mode === 'a2v');
  if (unsupportedLtxGuidance) delete requestBody.guidance_scale;
}
