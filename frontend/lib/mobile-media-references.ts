import { resolveEngineMediaFieldConstraint } from './media-field-constraints';
import type { ModeControls, MobileMediaReferenceField } from './mobile-generation-contract';
import type { MobileReferenceEngine } from './mobile-site-references';
import { VIDEO_MEDIA_FIELD_CANDIDATES } from './video-media-field-candidates';

export function projectMobileMediaControls(
  engine: Pick<MobileReferenceEngine, 'inputSchema' | 'inputLimits'>,
  rawMode: string,
  control: ModeControls,
): ModeControls {
  const schema = engine.inputSchema;
  if (!schema) return control;
  const mode = control.mode;
  const generic = mode === 'ref2v' || mode === 'v2v';
  const soundtrack = mode === 't2v' || mode === 'i2v' || mode === 'i2v_standard';
  const ids: readonly string[] = mode === 'a2v' ? VIDEO_MEDIA_FIELD_CANDIDATES.sourceAudio : generic
    ? [...VIDEO_MEDIA_FIELD_CANDIDATES.referenceVideo, ...VIDEO_MEDIA_FIELD_CANDIDATES.referenceAudio]
    : mode === 'extend' ? VIDEO_MEDIA_FIELD_CANDIDATES.referenceAudio : soundtrack ? ['target_audio_url'] : [];
  const active = [...(schema.required ?? []), ...(schema.optional ?? [])]
    .filter(field => !field.modes?.length || field.modes.includes(rawMode));
  const candidates = active.filter(field => ids.includes(field.id) && field.id !== control.sourceVideo?.fieldId);
  const budget = schema.referenceBudget;
  const activeBudget = budget && (!budget.modes?.length || budget.modes.includes(rawMode)) ? budget : undefined;
  const constraints = schema.constraints;
  const combined = !Array.isArray(constraints?.combinedDurationModes) || constraints.combinedDurationModes.includes(rawMode);
  const fields: MobileMediaReferenceField[] = [];
  for (const field of candidates) {
    const kind = field.type;
    if ((kind !== 'audio' && kind !== 'video') || candidates.filter(f => f.type === kind).length !== 1) continue;
    const required = field.requiredInModes?.includes(rawMode) ?? schema.required?.includes(field);
    const min = required ? Math.max(1, field.minCount ?? 1) : 0;
    const withinBudget = activeBudget?.fieldIds.includes(field.id) ? activeBudget : undefined;
    const max = Math.min(field.maxCount ?? 1, withinBudget?.maxTotal ?? Infinity, withinBudget?.maxByType?.[kind] ?? Infinity);
    if (!Number.isSafeInteger(max) || max < Math.max(1, min)) continue;
    const file = resolveEngineMediaFieldConstraint({ engine, field });
    if (file.unmappedDeclaredFormats?.length) continue;
    const minSeconds = field.minDurationSecByMode?.[rawMode] ?? field.minDurationSec;
    const maxSeconds = field.maxDurationSec;
    const combinedMax = kind === 'video' ? constraints?.maxCombinedVideoDurationSec : constraints?.maxCombinedAudioDurationSec;
    fields.push({
      fieldId: field.id, kind, min, max,
      ...(minSeconds ? { minSeconds } : {}),
      ...(maxSeconds ? { maxSeconds } : {}),
      ...(combined && combinedMax ? { combinedMaxSeconds: combinedMax } : {}),
      limits: {
        maxSizeMB: file.maxSizeMB,
        acceptedMimeTypes: file.acceptedMimeTypes,
        acceptedFileExtensions: file.acceptedFileExtensions,
        ...(kind === 'video' && constraints?.minVideoPixelCount ? { minVideoPixels: constraints.minVideoPixelCount } : {}),
      },
    });
  }
  if (!fields.length) return control;
  const image = control.imageSeries && active.find(field => field.id === control.imageSeries?.fieldId);
  const required = constraints?.atLeastOneReferenceField;
  const allowedIds = new Set([image?.id, ...fields.map(f => f.fieldId)]);
  // The web ref2v reader accepts visual guides by default. Audio alone is
  // valid only when the active schema names the audio field as an alternative.
  const visualFields = [image?.id, ...fields.filter(f => f.kind === 'video').map(f => f.fieldId)]
    .filter((id): id is string => !!id);
  const alternatives = mode !== 'ref2v' ? [] : Array.isArray(required)
    ? required.filter((id): id is string => typeof id === 'string' && allowedIds.has(id))
    : visualFields;
  const imageRequired = image && (image.requiredInModes?.includes(rawMode) ?? schema.required?.includes(image));
  const sourceAudio = mode === 'a2v' && fields.find(f => f.fieldId === 'audio_url' && f.min === 1 && f.max === 1);
  const optionalImage = sourceAudio && active.find(f => f.id === 'image_url' && f.type === 'image' &&
    !(f.requiredInModes?.includes(rawMode) ?? schema.required?.includes(f)) && (f.maxCount ?? 1) === 1);
  return {
    ...control,
    ...(sourceAudio ? { sourceAudio: { fieldId: sourceAudio.fieldId, inheritsDuration: true } } : {}),
    ...(optionalImage ? { optionalFirstFrame: { fieldId: optionalImage.id, limits: resolveEngineMediaFieldConstraint({ engine, field: optionalImage }) } } : {}),
    mediaReferenceFields: fields,
    ...(alternatives.length ? { requiredReferenceFieldIds: alternatives } : {}),
    ...(control.imageSeries && !imageRequired && alternatives.some(id => id !== image?.id)
      ? { imageSeries: { ...control.imageSeries, min: 0 } } : {}),
    ...(activeBudget ? { referenceBudget: {
      fieldIds: [...activeBudget.fieldIds], maxTotal: activeBudget.maxTotal,
      ...(activeBudget.maxByType ? { maxByType: { ...activeBudget.maxByType } } : {}),
    } } : {}),
  };
}
