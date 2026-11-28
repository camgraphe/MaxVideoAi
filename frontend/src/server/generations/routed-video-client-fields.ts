import { getFalEngineById } from '@/config/falEngines';
import { getKnownGenerationFailureMessage } from '@/lib/generation-failure-messages';
import { getVideoFailureCodeFromSettingsSnapshot } from '@/lib/video-failure-codes';
import { normalizeVideoOperation } from '@/lib/video-operation';

type Fields = Record<string, unknown>;
function object(value: unknown): Fields | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : undefined;
}
function scalar(value: unknown) {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}
function fields(value: Fields, allowed: readonly string[]): Fields {
  return Object.fromEntries(
    allowed
      .filter((key) => Object.hasOwn(value, key))
      .flatMap((key) => {
        const item = value[key];
        return scalar(item) || (Array.isArray(item) && item.every(scalar)) ? [[key, item]] : [];
      }),
  );
}
function objects(value: unknown, allowed: readonly string[]) {
  return Array.isArray(value)
    ? value.flatMap((entry) => (object(entry) ? [fields(object(entry)!, allowed)] : []))
    : undefined;
}

const coreKeys = [
  'durationSec',
  'durationOption',
  'numFrames',
  'aspectRatio',
  'resolution',
  'fps',
  'iterationCount',
  'audio',
];
const advancedKeys = [
  'cfgScale',
  'loop',
  'shotType',
  'seed',
  'cameraFixed',
  'safetyChecker',
  'voiceIds',
  'voiceControl',
];
const refKeys = [
  'imageUrl',
  'imageUrls',
  'audioUrl',
  'audioUrls',
  'referenceImages',
  'referenceImageUrls',
  'videoUrl',
  'videoUrls',
  'firstFrameUrl',
  'lastFrameUrl',
  'endImageUrl',
];
const inputKeys = [
  'kind',
  'name',
  'type',
  'size',
  'slotId',
  'label',
  'url',
  'assetId',
  'width',
  'height',
  'durationSec',
];
const elementKeys = [
  'id',
  'voiceId',
  'frontalImageUrl',
  'frontalAssetId',
  'referenceImageUrls',
  'referenceAssetIds',
  'videoUrl',
  'videoAssetId',
];

/** Only customer-authored or customer-visible creative settings cross the browser boundary. */
export function projectRoutedVideoSettings(engineId: string, value: unknown): Fields | undefined {
  const source = object(value);
  if (!source) return undefined;
  const result = fields(source, [
    'schemaVersion',
    'surface',
    'mediaType',
    'engineId',
    'engineLabel',
    'inputMode',
    'mode',
    'operation',
    'prompt',
    'negativePrompt',
    'sourceJobId',
    'sourceOutputId',
    ...coreKeys,
    ...advancedKeys,
    ...refKeys,
  ]);
  const core = object(source.core),
    advanced = object(source.advanced),
    refs = object(source.refs);
  if (core) result.core = fields(core, coreKeys);
  if (advanced) {
    const clean = fields(advanced, advancedKeys);
    const multi = objects(advanced.multiPrompt, ['prompt', 'duration', 'durationSec']);
    if (multi) clean.multiPrompt = multi;
    const extras = object(advanced.extraInputValues);
    if (extras) {
      const engine = getFalEngineById(engineId)?.engine;
      let schema = engine?.inputSchema;
      if (engine && typeof source.inputMode === 'string' && source.operation) {
        try {
          const operation = normalizeVideoOperation(engineId, source.inputMode, source.operation);
          if (operation) schema = engine.operationCaps?.[operation]?.inputSchema ?? schema;
        } catch {
          /* A legacy operation can still restore its engine settings. */
        }
      }
      const ids = [...(schema?.required ?? []), ...(schema?.optional ?? [])].map((field) => field.id);
      const projected = fields(extras, ids);
      // Older publication recipes stored creative element media here, including on Wan videos.
      const elements = objects(extras.elements, [...elementKeys, 'frontal_image', 'frontal_image_url', 'reference_image_urls', 'video_url']);
      if (elements) projected.elements = elements;
      if (typeof extras.strength === 'number' && Number.isFinite(extras.strength))
        projected.strength = extras.strength;
      clean.extraInputValues = projected;
    }
    result.advanced = clean;
  }
  if (refs) {
    const clean = fields(refs, refKeys);
    if (Array.isArray(refs.inputs))
      clean.inputs = refs.inputs.flatMap((entry) => {
        const input = object(entry);
        if (!input) return [];
        const result = fields(input, inputKeys);
        const segment = object(input.segment);
        if (
          segment &&
          typeof segment.start === 'number' &&
          Number.isFinite(segment.start) &&
          typeof segment.end === 'number' &&
          Number.isFinite(segment.end)
        )
          result.segment = { start: segment.start, end: segment.end };
        return [result];
      });
    const elements = objects(refs.elements, elementKeys);
    if (elements) clean.elements = elements;
    result.refs = clean;
  }
  const meta = object(source.meta);
  if (meta) result.meta = fields(meta, ['memberTier', 'derived']);
  const workflow = object(source.seedanceWorkflow);
  if (workflow) result.seedanceWorkflow = fields(workflow, ['step', 'draftJobId']);
  const edit = object(source.seedanceEditSource);
  if (edit)
    result.seedanceEditSource = fields(edit, [
      'durationSec',
      'width',
      'height',
      'billedDurationSec',
      'pricingAspectRatio',
      'outputDuration',
      'outputAspectRatio',
    ]);
  const failureCode = getVideoFailureCodeFromSettingsSnapshot(value);
  if (failureCode && getKnownGenerationFailureMessage({ failureCode })) result.providerFailure = { failureCode };
  return result;
}

/** A private transport can put account, task and cost data in free-form status or error messages. */
export function routedVideoJobMessage(
  status: string | null | undefined,
  message: string | null | undefined,
  settings: unknown,
) {
  if (status === 'provider_polling_stalled')
    return 'This render is being reviewed. Check its status before retrying.';
  if (['failed', 'error', 'errored', 'rejected', 'aborted', 'timed_out', 'expired'].includes(status ?? '')) {
    return (
      getKnownGenerationFailureMessage({
        failureCode: getVideoFailureCodeFromSettingsSnapshot(settings),
        message,
      }) ??
      'MaxVideoAI could not complete this render. Contact support with your request ID if the problem continues.'
    );
  }
  if (!message) return undefined;
  if (status === 'pending' || status === 'queued') return 'Render queued.';
  if (status === 'processing' || status === 'running' || status === 'in_progress') return 'Render is in progress.';
  return undefined;
}
