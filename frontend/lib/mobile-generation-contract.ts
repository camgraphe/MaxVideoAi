import { normalizeVideoDurationOption } from './video-duration-option';
import { validateMediaFileAgainstConstraint } from './media-file-constraint';
import type { LibraryMediaKind, LibraryMediaReference } from './media-library-organization';
import { VIDEO_MEDIA_FIELD_CANDIDATES } from './video-media-field-candidates';
import type { MobileSiteReference } from './mobile-site-references';
export type Surface = 'video' | 'image';
export type VideoWorkflow = 'create' | 'modify' | 'extend';
export type MobileMode = 'a2v' | 'ref2v' | 'fl2v' | 'v2v' | 'extend' | 't2v' | 'i2v' | 'i2v_standard' | 't2i' | 'i2i';
export type SettingValue = string | number | boolean;
export interface MobileModel {
  pickerRecommendations?: import('./workspace-model-picks').WorkspaceModelPicks;
  /** Some models accept a second frame within image-to-video itself. */
  supportsFramePair?: true;
  provider?: string;
  id: string;
  label: string;
  surface: Surface;
  modes: MobileMode[];
}
export interface MobileMediaReferenceField {
  fieldId: string;
  kind: 'audio' | 'video';
  min: number;
  max: number;
  minSeconds?: number;
  maxSeconds?: number;
  combinedMaxSeconds?: number;
  limits?: ModeControls['referenceLimits'];
}
export interface MobileSettingField {
  key: string;
  label: string;
  type: 'boolean' | 'enum' | 'number' | 'text';
  required: boolean;
  values?: SettingValue[];
  min?: number;
  max?: number;
  step?: number;
  default?: SettingValue;
}
export interface ModeControls {
  seedanceDraft?: 'native' | 'website';
  settingFields?: MobileSettingField[];
  durationLimits?: { key: 'resolution' | 'fps'; value: SettingValue; max: number }[];
  mediaReferenceFields?: MobileMediaReferenceField[];
  requiredReferenceFieldIds?: string[];
  referenceBudget?: {
    fieldIds: string[];
    maxTotal: number;
    maxByType?: Partial<Record<'image' | 'video' | 'audio', number>>;
  };
  mode: MobileMode;
  durations: number[];
  resolutions: string[];
  aspectRatios: string[];
  audio: 'optional' | 'always_generated' | 'unavailable';
  referenceRole: 'first_frame' | 'reference' | 'source' | null;
  referenceImageField?: string;
  imageSeries?: { fieldId: string; min: number; max: number };
  referenceLimits?: {
    maxSizeMB?: number;
    acceptedMimeTypes?: string[];
    acceptedFileExtensions?: string[];
    imageAspectRatio?: { min: number; max: number };
    minImageSidePx?: number;
    minVideoPixels?: number;
    exclusiveMaxSeconds?: number;
  };
  lastFrame?: { fieldId: string; limits?: ModeControls['referenceLimits'] };
  optionalLastFrame?: { fieldId: string; limits?: ModeControls['referenceLimits'] };
  sourceAudio?: { fieldId: string; inheritsDuration: true };
  optionalFirstFrame?: { fieldId: string; limits?: ModeControls['referenceLimits'] };
  sourceVideo?: {
    fieldId: string;
    canPrepareExcerpt?: true;
    inheritsDuration: boolean;
    minSeconds?: number;
    maxSeconds?: number;
  };
  defaults: Record<string, SettingValue>;
}
export interface ModelDetails extends Omit<MobileModel, 'modes'> {
  modes: ModeControls[];
  siteReferences?: MobileSiteReference[];
}
export interface GenerationDraft {
  seedanceWorkflow?: { step: 'draft' };
  surface: Surface;
  engineId: string;
  mode: MobileMode;
  prompt: string;
  settings: Record<string, SettingValue>;
  lastFrame?: { assetId: string; role: 'last_frame' };
  imageReferences?: string[];
  mediaReferences?: { fieldId: string; kind: 'audio' | 'video'; assetId: string }[];
  reference?: {
    assetId: string;
    role: NonNullable<ModeControls['referenceRole']>;
  } | null;
}
export interface GenerationQuote {
  seedanceWorkflowPrices?: {
    finalOptions: { resolution: import('./seedance-draft-setup').SeedanceFinalResolution;
      final: GenerationQuote['price'] | null; total: GenerationQuote['price'] | null }[];
  };
  quoteId: string;
  expiresAt: string;
  price: { amountCents: number; currency: string; formattedAmount?: string };
  balance: { beforeCents: number; afterCents: number };
  topupRequired: boolean;
  summary: {
    outputCount?: number;
    seedanceWorkflow?: { step: 'draft' } | { step: 'final'; draftJobId: string };
    orderedImageReferences?: boolean;
    orderedMediaReferences?: boolean;
    references?: { kind: string; role: string; assetId?: string; slot?: number; fieldId?: string; mediaKind?: string }[];
    engineId: string;
    mode: MobileMode;
    prompt: string;
    settings: Record<string, SettingValue>;
  };
}
export interface RestoredQuote {
  job: GenerationJob | null;
  canConfirm: boolean;
  terminal: boolean;
  quote: Pick<GenerationQuote, 'quoteId' | 'expiresAt' | 'price' | 'summary'>;
}
export interface GenerationJob {
  seedanceWorkflow?: {
    step: 'draft' | 'final';
    draftJobId: string;
    eligibility?: import('./seedance-draft-setup').SeedanceDraftEligibility;
    expiresAt?: string | null;
    finalJobId?: string | null;
    finalizationAvailable?: boolean;
  };
  jobId: string;
  surface: Surface | 'audio';
  status: 'accepted' | 'running' | 'completed' | 'failed';
  progress: number | null;
  message: string | null;
  prompt: string;
  engineLabel: string;
  engineId?: string;
  createdAt: string;
  url: string | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  mediaKind?: Surface | 'audio';
  audioUrl?: string | null;
  retryAfterSeconds: number | null;
}
export interface UploadImageInput {
  uri: string;
  name: string;
  mimeType: string;
  file?: Blob;
}
export type PhoneAudio = import('./media-upload-parts').MediaPartSource & { appendTo(form: FormData): void };
export interface PhoneVideo {
  width?: number;
  height?: number;
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  durationSec?: number;
  put: (signedUrl: string, headers: Record<string, string>) => Promise<void>;
}
export type AccountMediaSource = 'all' | 'upload' | 'generated';
export interface AccountMediaAsset {
  owner: string;
  key: string;
  name: string;
  kind: LibraryMediaKind;
  source: string;
  reference: LibraryMediaReference;
  grant?: {
    revision: string;
    expiresAt: string;
    reference: LibraryMediaReference;
  };
  originalUrl: string;
  createdAt?: string;
  uri: string;
  thumbnailUri?: string;
  durationSec?: number;
  size?: number;
  mimeType?: string;
  width?: number;
  height?: number;
}
export type AccountMediaSelection = Pick<AccountMediaAsset, 'owner' | 'key' | 'reference' | 'originalUrl'>;
export interface AccountMediaQuery {
  owner: string;
  kind?: LibraryMediaKind;
  source?: AccountMediaSource;
  search?: string;
  cursor?: string | null;
  signal?: AbortSignal;
}
export interface GenerationApi {
  prepareVideoExcerpt(input: {
    owner: string;
    assetId: string;
    engineId: string;
    mode: 'v2v' | 'extend';
    fieldId: string;
    range: import('./media-excerpt-timing').VideoExcerptRange;
  }): Promise<AccountMediaAsset>;
  browseMedia(query: AccountMediaQuery): Promise<{ items: AccountMediaAsset[]; nextCursor: string | null }>;
  validateMediaRevision(selection: AccountMediaSelection): Promise<void>;
  inspectMedia(asset: AccountMediaAsset): Promise<AccountMediaAsset>;
  resolveMedia(asset: AccountMediaAsset): Promise<{ assetId: string }>;
  models(surface: Surface): Promise<MobileModel[]>;
  details(id: string, signal?: AbortSignal): Promise<ModelDetails>;
  prepare(draft: GenerationDraft): Promise<GenerationQuote>;
  prepareSeedanceFinal(draftJobId: string, resolution: import('./seedance-draft-setup').SeedanceFinalResolution): Promise<GenerationQuote>;
  confirm(quoteId: string): Promise<GenerationJob>;
  restore(quoteId: string): Promise<RestoredQuote>;
  recover(quoteId: string): Promise<GenerationJob | null>;
  job(jobId: string, signal?: AbortSignal): Promise<GenerationJob>;
  latestResult(surface: Surface, signal?: AbortSignal): Promise<GenerationJob | null>;
  jobs(
    cursor?: string | null,
    surface?: GenerationJob['surface'] | null,
  ): Promise<{ items: GenerationJob[]; nextCursor: string | null }>;
  wallet(): Promise<{ balanceCents: number; currency: string }>;
  uploadAudio(file: PhoneAudio): Promise<{ assetId: string }>;
  uploadVideo(input: PhoneVideo): Promise<{ assetId: string }>;
  uploadImage(input: UploadImageInput): Promise<{ assetId: string }>;
}

/** Only known original facts can disqualify a reference before the owned server preflight. */
export function mobileReferenceIssue(
  mode: ModeControls | undefined,
  file: {
    name: string;
    originalUrl?: string;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
    durationSec?: number;
  } | null,
): 'size' | 'format' | 'dimensions' | 'duration' | null {
  if (!file || !mode?.referenceRole) return null;
  const limits = mode.referenceLimits;
  const duration = file.durationSec;
  if (
    typeof duration === 'number' &&
    duration > 0 &&
    mode.sourceVideo &&
    ((mode.sourceVideo.minSeconds != null && duration < mode.sourceVideo.minSeconds) ||
      (mode.sourceVideo.maxSeconds != null && duration > mode.sourceVideo.maxSeconds) ||
      (limits?.exclusiveMaxSeconds != null && duration >= limits.exclusiveMaxSeconds))
  )
    return 'duration';
  if (!limits) return null;
  const name = file.originalUrl ?? file.name;
  const mime = file.mimeType?.split(';', 1)[0].trim().toLowerCase();
  const knownMime = !!mime && mime !== 'application/octet-stream';
  const checked = validateMediaFileAgainstConstraint({
    name,
    mimeType: mime ?? '',
    sizeBytes: file.size ?? 0,
    constraint: {
      maxSizeMB: limits.maxSizeMB,
      acceptedMimeTypes: knownMime ? (limits.acceptedMimeTypes ?? []) : [],
      acceptedFileExtensions: /\.[a-z0-9]+$/i.test(name.split(/[?#]/, 1)[0])
        ? (limits.acceptedFileExtensions ?? [])
        : [],
    },
  });
  if (!checked.ok) return checked.reason;
  if (file.width && file.height) {
    const ratio = file.width / file.height;
    if (
      (limits.minImageSidePx && Math.min(file.width, file.height) < limits.minImageSidePx) ||
      (limits.minVideoPixels && file.width * file.height < limits.minVideoPixels) ||
      (limits.imageAspectRatio &&
        (ratio < limits.imageAspectRatio.min || ratio > limits.imageAspectRatio.max))
    )
      return 'dimensions';
  }
  return null;
}

export function isMobileMode(mode: string): mode is MobileMode {
  return (
    mode === 'a2v' ||
    mode === 'ref2v' ||
    mode === 'fl2v' ||
    isSourceVideoMode(mode) ||
    mode === 't2v' ||
    mode === 'i2v' ||
    mode === 'i2v_standard' ||
    mode === 't2i' ||
    mode === 'i2i'
  );
}

export function isSourceVideoMode(mode: string): mode is 'v2v' | 'extend' {
  return mode === 'v2v' || mode === 'extend';
}
type InputField = {
  id: string;
  type: string;
  modes?: readonly string[];
  requiredInModes?: readonly string[];
  minCount?: number;
  maxCount?: number;
};
export function phoneImageReferenceField(
  schema: { required?: readonly InputField[]; optional?: readonly InputField[] } | undefined,
  mode: string,
) {
  const accepts = (field: InputField) =>
    field.type === 'image' &&
    (!field.modes?.length || field.modes.includes(mode)) &&
    [
      'image_url',
      'image_urls',
      'first_frame_url',
      'start_image_url',
      'reference_images',
      'reference_image_urls',
    ].includes(field.id);
  const fields = [
    ...(schema?.required ?? []).map((field) => ({ field, required: true })),
    ...(schema?.optional ?? []).map((field) => ({ field, required: false })),
  ].filter(({ field }) => accepts(field));
  return (
    fields.find(({ field, required }) => field.requiredInModes?.includes(mode) ?? required) ?? fields[0]
  )?.field.id;
}
export function phoneImageSeries(
  schema:
    | {
        required?: readonly InputField[];
        optional?: readonly InputField[];
        referenceBudget?: {
          modes?: readonly string[];
          fieldIds: readonly string[];
          maxTotal: number;
          maxByType?: { image?: number };
        };
      }
    | undefined,
  mode: 'ref2v' | 'i2i',
) {
  const media = [
    ...(schema?.required ?? []).map((field) => ({ field, required: true })),
    ...(schema?.optional ?? []).map((field) => ({ field, required: false })),
  ].filter(
    ({ field }) =>
      ['image', 'video', 'audio'].includes(field.type) &&
      (!field.modes?.length || field.modes.includes(mode)),
  );
  const matches = media.filter(
    ({ field }) =>
      field.type === 'image' && ['image_urls', 'reference_image_urls', 'reference_images'].includes(field.id),
  );
  if (matches.length !== 1) return undefined;
  const { field } = matches[0];
  if (
    media.some(
      (item) => item.field !== field && (item.field.requiredInModes?.includes(mode) ?? item.required),
    )
  )
    return undefined;
  if (!Number.isInteger(field.maxCount) || Number(field.maxCount) < 1) return undefined;
  const min = Math.max(1, field.minCount ?? 1);
  const budget = schema?.referenceBudget;
  const constrained =
    budget && (!budget.modes?.length || budget.modes.includes(mode)) && budget.fieldIds.includes(field.id);
  const max = constrained
    ? Math.min(field.maxCount!, budget.maxTotal, budget.maxByType?.image ?? Infinity)
    : field.maxCount!;
  return max >= min ? { fieldId: field.id, min, max } : undefined;
}
export function phoneFrameFields(
  schema: { required?: readonly InputField[]; optional?: readonly InputField[] } | undefined,
) {
  const required = [
    ...(schema?.required ?? []).filter((f) => !f.requiredInModes || f.requiredInModes.includes('fl2v')),
    ...(schema?.optional ?? []).filter((f) => f.requiredInModes?.includes('fl2v')),
  ].filter(
    (f) => ['image', 'video', 'audio'].includes(f.type) && (!f.modes?.length || f.modes.includes('fl2v')),
  );
  const first = required.find(
    (f) => f.type === 'image' && VIDEO_MEDIA_FIELD_CANDIDATES.firstFrame.some(id => id === f.id),
  );
  const last = required.find((f) => f.type === 'image' && ['last_frame_url', 'end_image_url'].includes(f.id));
  const singleSlots = required.every(field => (field.minCount ?? 1) <= 1 && (field.maxCount ?? 1) >= 1);
  return required.length === 2 && singleSlots && first && last ? { first: first.id, last: last.id } : null;
}
export function phoneOptionalLastFrame(
  schema: Parameters<typeof phoneImageReferenceField>[0],
  engineMode: string,
) {
  const optional = [
    ...(schema?.optional ?? []).filter(f => !f.requiredInModes?.includes(engineMode)),
    ...(schema?.required ?? []).filter(f => f.requiredInModes && !f.requiredInModes.includes(engineMode)),
  ];
  return optional.find(f => f.type === 'image' && (!f.modes?.length || f.modes.includes(engineMode))
    && VIDEO_MEDIA_FIELD_CANDIDATES.lastFrame.some(id => id === f.id)
    && (f.minCount ?? 0) <= 1 && (f.maxCount ?? 1) >= 1)?.id;
}
export function visibleMobileMode(mode: MobileMode, params: URLSearchParams) {
  if (mode === 'a2v') return params.get('mediaReferences') === '1';
  if (mode === 'ref2v') return params.get('imageSeries') === '1';
  if (mode === 'fl2v') return params.get('framePair') === '1';
  return !isSourceVideoMode(mode) || params.get('sourceVideo') === '1';
}
export function phoneVideoSourceField(
  schema: { required?: readonly InputField[]; optional?: readonly InputField[] } | undefined,
  mode: 'v2v' | 'extend',
) {
  const needed = (fields: readonly InputField[] = [], required: boolean) =>
    fields.filter(
      (field) =>
        ['image', 'video', 'audio'].includes(field.type) &&
        (!field.modes?.length || field.modes.includes(mode)) &&
        (field.requiredInModes ? field.requiredInModes.includes(mode) : required),
    );
  const required = [...needed(schema?.required, true), ...needed(schema?.optional, false)];
  const field = required[0];
  return required.length === 1 &&
    field.type === 'video' &&
    (field.minCount ?? 1) <= 1 && (field.maxCount ?? 1) >= 1 &&
    ['video_url', 'video_urls', 'extension_source_videos'].includes(field.id)
    ? field.id
    : undefined;
}
export function workflowForMode(mode: MobileMode) {
  if (mode === 'v2v') return 'modify';
  if (mode === 'extend') return 'extend';
  return mode === 'i2i' ? 'edit' : 'create';
}
export function matchesInput(
  mode: MobileMode,
  workflow: VideoWorkflow,
  fromImage: boolean,
  framePair = false,
  imageSeries = false,
) {
  if (workflow === 'modify') return mode === 'v2v';
  if (workflow === 'extend') return mode === 'extend';
  if (mode === 'a2v') return false;
  if (imageSeries || mode === 'ref2v') return imageSeries && mode === 'ref2v';
  if (framePair || mode === 'fl2v') return framePair && mode === 'fl2v';
  return !isSourceVideoMode(mode) && needsReference(mode) === fromImage;
}

export function needsReference(mode: MobileMode) {
  return (
    mode === 'ref2v' ||
    mode === 'fl2v' ||
    isSourceVideoMode(mode) ||
    mode === 'i2v' ||
    mode === 'i2v_standard' ||
    mode === 'i2i'
  );
}

export function withControlDefaults(control: ModeControls, durationDefault?: number | string): ModeControls {
  const preferred = normalizeVideoDurationOption(durationDefault);
  const duration =
    typeof preferred === 'number' && control.durations.includes(preferred) ? preferred : control.durations[0];
  // Auto framing only applies when the selected model and mode actually offer it.
  const aspect = control.aspectRatios.includes('16:9') ? '16:9' : control.aspectRatios[0];
  return {
    ...control,
    defaults: {
      ...(duration === undefined ? {} : { durationSec: duration }),
      ...(control.resolutions[0] ? { resolution: control.resolutions[0] } : {}),
      ...(aspect ? { aspectRatio: aspect } : {}),
      ...(control.audio === 'optional' ? { audio: true } : {}),
      ...control.defaults,
    },
  };
}
