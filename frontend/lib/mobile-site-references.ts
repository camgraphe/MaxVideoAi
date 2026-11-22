import { FEATURES } from '../content/feature-flags';
import { VIDEO_MEDIA_FIELD_CANDIDATES } from './video-media-field-candidates';
import { isKlingV4FalQueueEngineId } from '../src/lib/kling-v4-family';
import {
  supportsWorkspaceKlingV3Controls,
  workspaceKlingSubjectsActive,
} from '../src/lib/kling-subject-mode';
import { toCanonicalGenerationMode } from './generation-mode-aliases';
import { MAX_REFERENCE_IMAGES } from './generation-reference-limits';
import type { ModeControls, Surface } from './mobile-generation-contract';

export type SiteReferenceRole =
  | 'image'
  | 'video'
  | 'audio'
  | 'soundtrack'
  | 'first_frame'
  | 'last_frame'
  | 'middle_frame'
  | 'keyframes'
  | 'generation'
  | 'mask'
  | 'subject'
  | 'character'
  | 'file'
  | 'web'
  | 'source';
export interface MobileSiteReference {
  fieldId: string;
  role: SiteReferenceRole;
  /** Engine mode accepted by the website's workspace URL. */
  mode: string;
  min: number;
  max?: number;
  operation?: string;
}
type Field = {
  maxSizeMB?: number;
  minDurationSec?: number;
  maxDurationSec?: number;
  minDurationSecByMode?: Record<string, number | undefined>;
  acceptedMimeTypes?: readonly string[];
  acceptedFileExtensions?: readonly string[];
  id: string;
  type: string;
  modes?: readonly string[];
  requiredInModes?: readonly string[];
  minCount?: number;
  maxCount?: number;
};
type Schema = {
  constraints?: {
    supportedFormats?: readonly string[];
    minVideoPixelCount?: number;
    maxImageSizeMB?: number;
    maxVideoSizeMB?: number;
    maxAudioSizeMB?: number;
    maxCombinedVideoDurationSec?: number;
    maxCombinedAudioDurationSec?: number;
    combinedDurationModes?: unknown;
    atLeastOneReferenceField?: unknown;
  };
  required?: readonly Field[];
  optional?: readonly Field[];
  referenceBudget?: {
    modes?: readonly string[];
    fieldIds: readonly string[];
    maxTotal: number;
    maxByType?: Partial<Record<'image' | 'video' | 'audio', number>>;
  };
};
export type MobileReferenceEngine = {
  inputLimits?: import('./media-field-constraints').MediaConstraintEngine['inputLimits'];
  id: string;
  modes: readonly string[];
  inputSchema?: Schema;
  modeAvailability?: Record<string, { available: boolean }>;
  operationCaps?: Partial<
    Record<string, { operation: string; mode: string; inputSchema: Schema; defaultForMode?: boolean }>
  >;
};

function siteRole(field: Field, mode: string, keyframes: boolean): SiteReferenceRole | undefined {
  if (field.id === 'source_job_id') return 'generation';
  if (field.id === 'mask_url') return 'mask';
  if (field.id === 'file_url') return 'file';
  if (field.id === 'web_url') return 'web';
  if (field.type === 'video') {
    return (mode === 'v2v' || mode === 'extend') &&
      VIDEO_MEDIA_FIELD_CANDIDATES.sourceVideo.some((id) => id === field.id) &&
      (field.id !== 'video_urls' || mode === 'extend')
      ? 'source'
      : 'video';
  }
  if (field.type === 'audio') return field.id === 'target_audio_url' ? 'soundtrack' : 'audio';
  if (field.type !== 'image') return undefined;
  if (field.id.includes('keyframe') || (keyframes && field.id === 'reference_image_urls')) return 'keyframes';
  if (field.id === 'middle_image_url') return 'middle_frame';
  if (VIDEO_MEDIA_FIELD_CANDIDATES.lastFrame.some((id) => id === field.id)) return 'last_frame';
  if (mode !== 'v2v' && VIDEO_MEDIA_FIELD_CANDIDATES.firstFrame.some((id) => id === field.id))
    return 'first_frame';
  return 'image';
}

function fieldCapacity(schema: Schema, field: Field, mode: string) {
  const budget = schema.referenceBudget;
  if (!budget?.fieldIds.includes(field.id) || (budget.modes?.length && !budget.modes.includes(mode)))
    return field.maxCount ?? 1;
  const kind = field.type;
  const kindLimit =
    kind === 'image' || kind === 'video' || kind === 'audio' ? budget.maxByType?.[kind] : undefined;
  return Math.min(field.maxCount ?? 1, budget.maxTotal, kindLimit ?? Infinity);
}

function siteFields(
  schema: Schema,
  context: Pick<MobileSiteReference, 'mode' | 'operation'>,
  control?: ModeControls,
  nativeMediaFields?: ModeControls['mediaReferenceFields'],
): MobileSiteReference[] {
  const { mode } = context;
  const active = [...(schema.required ?? []), ...(schema.optional ?? [])].filter(
    (field) => !field.modes?.length || field.modes.includes(mode),
  );
  const keyframes = active.some((field) => field.id === 'keyframe_indexes');
  return active.flatMap((field): MobileSiteReference[] => {
    const role = siteRole(field, mode, keyframes);
    if (!role) return [];
    const max = fieldCapacity(schema, field, mode);
    if (
      nativeMediaFields?.some((item) => item.fieldId === field.id && item.kind === field.type) ||
      field.id === control?.optionalFirstFrame?.fieldId ||
      field.id === control?.referenceImageField ||
      field.id === control?.lastFrame?.fieldId ||
      field.id === control?.optionalLastFrame?.fieldId ||
      (field.id === control?.sourceVideo?.fieldId && max === 1)
    )
      return [];
    const required = field.requiredInModes
      ? field.requiredInModes.includes(mode)
      : !!schema.required?.includes(field);
    return [
      { ...context, fieldId: field.id, role, min: required ? Math.max(1, field.minCount ?? 1) : 0, max },
    ];
  });
}

/** Only declare a web handoff for an actual input in an available model workflow. */
export function projectMobileSiteReferences(
  engine: MobileReferenceEngine,
  surface: Surface,
  native: ModeControls[],
): MobileSiteReference[] {
  const result: MobileSiteReference[] = [];
  for (const mode of engine.modes) {
    const canonical = toCanonicalGenerationMode(engine.id, surface, mode);
    if (
      !canonical ||
      mode === 'reframe' ||
      mode === 'retake' ||
      engine.modeAvailability?.[mode]?.available === false
    )
      continue;
    const control = native.find((item) => item.mode === canonical);
    const operations = Object.values(engine.operationCaps ?? {}).filter((op) => op?.mode === mode);
    for (const operation of operations.length ? operations : [undefined]) {
      const schema = operation?.inputSchema ?? engine.inputSchema;
      if (!schema) continue;
      const context = { mode, ...(operation ? { operation: operation.operation } : {}) };
      for (const item of siteFields(schema, context, control, !operation || operation.defaultForMode ? control?.mediaReferenceFields : undefined)) {
        // The image workspace selects its edit mode automatically when a reference is added.
        if (
          surface === 'image' &&
          mode === 't2i' &&
          native.some((m) => m.referenceImageField === item.fieldId)
        )
          continue;
        result.push(item);
      }
      if (
        surface === 'video' &&
        workspaceKlingSubjectsActive({
          selectedEngineId: engine.id,
          submissionMode: mode,
          supportsKlingV3Controls: supportsWorkspaceKlingV3Controls(engine.id),
        })
      ) {
        result.push({
          ...context,
          fieldId: 'elements',
          role: 'subject',
          min: 0,
          ...(isKlingV4FalQueueEngineId(engine.id) ? { max: 7 } : mode === 'v2v' ? { max: 3 } : {}),
        });
      }
      if (
        surface === 'image' &&
        mode === 'i2i' &&
        FEATURES.workflows.toolsSection &&
        control?.referenceImageField
      ) {
        result.push({
          ...context,
          fieldId: 'characterReferences',
          role: 'character',
          min: 0,
          max: Math.min(MAX_REFERENCE_IMAGES, control.imageSeries?.max ?? 1),
        });
      }
    }
  }
  return result;
}
