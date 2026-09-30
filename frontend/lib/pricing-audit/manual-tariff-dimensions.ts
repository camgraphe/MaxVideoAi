import type { FalEngineEntry } from '@/config/falEngines';
import { isGptImage25EngineId } from '@/lib/image/gptImage2';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import { isMinimaxH3EngineId } from '@/lib/minimax-h3';
import type { Mode } from '@/types/engines';

function fields(entry: FalEngineEntry, mode: Mode) {
  const schema = entry.engine.inputSchema;
  return [...(schema?.required ?? []), ...(schema?.optional ?? [])]
    .filter(field => !field.modes || field.modes.includes(mode));
}

function boundedIntegers(min: number, max: number | undefined): number[] | null {
  if (!Number.isSafeInteger(min) || min < 0 || !Number.isSafeInteger(max) || max! < min || max! > 32) return null;
  return Array.from({ length: max! - min + 1 }, (_, index) => min + index);
}

/** Bounds describe the image-only slice; mixed reference media never become complete by enumeration. */
export function manualTariffReferenceCounts(entry: FalEngineEntry, mode: Mode): {
  values: Array<number | undefined>; complete: boolean;
} {
  const applicable = fields(entry, mode);
  const luma = isLumaAgentsImageEngineId(entry.id) && ['t2i', 'i2i'].includes(mode);
  const gpt = isGptImage25EngineId(entry.id) && mode === 'i2i';
  const h3 = isMinimaxH3EngineId(entry.id) && mode === 'ref2v';
  const referenceMode = mode === 'ref2v' || mode === 'r2v';
  if (!luma && !gpt && !referenceMode) return { values: [undefined], complete: true };
  const field = applicable.find(field => field.type === 'image'
    && ['image_urls', 'reference_image_urls', 'reference_images'].includes(field.id));
  const constraints = entry.engine.inputSchema?.constraints;
  const max = luma
    ? Number(constraints?.[mode === 'i2i' ? 'maxReferenceImagesEdit' : 'maxReferenceImagesTextToImage'])
    : field?.maxCount;
  const min = luma ? 0 : Math.max(1, field?.minCount ?? 1);
  const values = boundedIntegers(min, max);
  const imageOnly = field && (field.minCount ?? 0) >= 1
    && applicable.filter(field => ['image', 'video', 'audio'].includes(field.type)).length === 1;
  const complete = Boolean(values && (luma || gpt || imageOnly));
  // Enumerate the already-priced H3 image surcharge, retaining its mixed-media gap.
  return { values: values && (complete || h3) ? values : [referenceMode ? 1 : undefined], complete };
}

export function manualTariffImageOutputCounts(entry: FalEngineEntry, mode: Mode): number[] | null {
  const field = fields(entry, mode).find(field => field.id === 'num_images');
  return field ? boundedIntegers(field.min ?? 1, field.max) : null;
}

export function manualTariffLoopValues(entry: FalEngineEntry, mode: Mode): Array<boolean | undefined> {
  // Generation currently projects loop into pricing only for these legacy models.
  const supported = ['lumaRay2', 'lumaRay2_flash'].includes(entry.id)
    && fields(entry, mode).some(field => field.id === 'loop' && field.type === 'boolean');
  return supported ? [undefined, true] : [undefined];
}
