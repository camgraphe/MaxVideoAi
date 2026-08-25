import type { EngineCaps } from '@/types/engines';

import type {
  CanonicalGenerationReference,
  CanonicalGenerationRequest,
  CanonicalReferenceMediaKind,
} from './generation-types';
import type { ResolvedReference } from './reference-types';
import { normalizeControlledHttpsReferenceUrl } from './controlled-reference-url';

export type PaidVideoRequestBodyExecution = {
  quoteId: string;
  request: CanonicalGenerationRequest;
  resolvedReferences?: readonly ResolvedReference[];
  engine: EngineCaps;
  canonicalPricing: Record<string, unknown>;
};

type MaterializedReference = {
  kind: CanonicalReferenceMediaKind;
  role: CanonicalGenerationReference['role'];
  url: string;
  slot?: number;
};

function controlledHttpsUrl(value: unknown): string {
  try {
    return normalizeControlledHttpsReferenceUrl(value);
  } catch {
    throw new Error('A controlled HTTPS reference URL is required before provider submission.');
  }
}

function canonicalMediaKind(value: unknown): CanonicalReferenceMediaKind {
  if (value !== 'image' && value !== 'video' && value !== 'audio') {
    throw new Error('A verified reference media kind is required before provider submission.');
  }
  return value;
}

function resolvedKey(
  assetId: string,
  role: CanonicalGenerationReference['role'],
  slot: number | undefined,
): string {
  return `${assetId}\u0000${role}\u0000${slot ?? ''}`;
}

function materializeReferences(execution: PaidVideoRequestBodyExecution): MaterializedReference[] {
  const resolvedByKey = new Map<string, ResolvedReference>();
  for (const resolved of execution.resolvedReferences ?? []) {
    const key = resolvedKey(resolved.assetId, resolved.role, resolved.slot);
    if (resolvedByKey.has(key)) {
      throw new Error('Each private reference must resolve exactly once before provider submission.');
    }
    resolvedByKey.set(key, resolved);
  }

  const usedResolvedKeys = new Set<string>();
  const materialized = execution.request.references.map((reference): MaterializedReference => {
    if (reference.kind === 'https') {
      return {
        kind: canonicalMediaKind(reference.mediaKind),
        role: reference.role,
        url: controlledHttpsUrl(reference.url),
        ...(reference.slot === undefined ? {} : { slot: reference.slot }),
      };
    }
    const key = resolvedKey(reference.assetId, reference.role, reference.slot);
    const resolved = resolvedByKey.get(key);
    if (!resolved) {
      throw new Error('A verified resolved reference is required before provider submission.');
    }
    usedResolvedKeys.add(key);
    return {
      kind: canonicalMediaKind(resolved.mediaKind),
      role: reference.role,
      url: controlledHttpsUrl(resolved.storageUrl),
      ...(reference.slot === undefined ? {} : { slot: reference.slot }),
    };
  });

  if (usedResolvedKeys.size !== resolvedByKey.size) {
    throw new Error('Resolved reference material does not match the confirmed request.');
  }
  return materialized;
}

export function resolvePaidMembershipTier(
  pricing: Record<string, unknown>,
): 'member' | 'plus' | 'pro' {
  const value = pricing.membershipTier;
  if (value !== 'member' && value !== 'plus' && value !== 'pro') {
    throw new Error('Invalid paid generation membership tier.');
  }
  return value;
}

function input(kind: CanonicalReferenceMediaKind, slotId: string, url: string) {
  return { kind, slotId, url };
}

function supportsAspectRatio(execution: PaidVideoRequestBodyExecution): boolean {
  const fields = [
    ...(execution.engine.inputSchema?.required ?? []),
    ...(execution.engine.inputSchema?.optional ?? []),
  ];
  const field = fields.find((candidate) => candidate.id === 'aspect_ratio');
  return !field?.modes?.length || field.modes.includes(execution.request.mode);
}

function invalidModeReferences(): never {
  throw new Error('The confirmed references do not match the selected video mode.');
}

export function buildPaidVideoRequestBody(
  execution: PaidVideoRequestBodyExecution,
): Record<string, unknown> {
  if (execution.request.surface !== 'video') {
    throw new Error('A video request is required for video provider projection.');
  }
  const settings = { ...execution.request.settings };
  if (!supportsAspectRatio(execution)) delete settings.aspectRatio;
  const references = materializeReferences(execution);
  const body: Record<string, unknown> = {
    engineId: execution.request.engineId,
    mode: execution.request.mode,
    prompt: execution.request.prompt,
    jobId: execution.quoteId,
    payment: { mode: 'wallet' },
    membershipTier: resolvePaidMembershipTier(execution.canonicalPricing),
    ...settings,
    inputs: [],
  };

  if (execution.request.mode === 't2v') {
    if (references.length) invalidModeReferences();
    return body;
  }

  if (execution.request.mode === 'i2v') {
    const start = references.filter((reference) =>
      reference.kind === 'image'
      && (reference.role === 'source' || reference.role === 'first_frame'));
    const end = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'last_frame');
    if (start.length !== 1 || end.length > 1 || start.length + end.length !== references.length) {
      invalidModeReferences();
    }
    body.imageUrl = start[0]!.url;
    if (end[0]) body.endImageUrl = end[0].url;
    return body;
  }

  if (execution.request.mode === 'ref2v') {
    if (references.some((reference) => reference.role !== 'reference')) invalidModeReferences();
    const images = references.filter((reference) => reference.kind === 'image').map(({ url }) => url);
    const videos = references.filter((reference) => reference.kind === 'video').map(({ url }) => url);
    const audio = references.filter((reference) => reference.kind === 'audio').map(({ url }) => url);
    if (!images.length && !videos.length) invalidModeReferences();
    if (images.length) body.referenceImages = images;
    if (videos.length) body.referenceVideos = videos;
    if (audio.length) body.referenceAudio = audio;
    body.inputs = [
      ...videos.map((url) => input('video', 'video_urls', url)),
      ...audio.map((url) => input('audio', 'audio_urls', url)),
    ];
    return body;
  }

  if (execution.request.mode === 'v2v') {
    const source = references.filter((reference) =>
      reference.kind === 'video' && reference.role === 'source');
    const images = references.filter((reference) =>
      reference.kind === 'image' && reference.role === 'reference').map(({ url }) => url);
    const audio = references.filter((reference) =>
      reference.kind === 'audio' && reference.role === 'reference').map(({ url }) => url);
    if (source.length !== 1 || 1 + images.length + audio.length !== references.length) {
      invalidModeReferences();
    }
    body.videoUrl = source[0]!.url;
    if (images.length) body.referenceImages = images;
    if (audio.length) body.referenceAudio = audio;
    body.inputs = [
      input('video', 'video_url', source[0]!.url),
      ...audio.map((url) => input('audio', 'audio_urls', url)),
    ];
    return body;
  }

  if (execution.request.mode === 'extend') {
    const sources = references.filter((reference) =>
      reference.kind === 'video' && reference.role === 'source');
    if (sources.length < 1 || sources.length > 3 || sources.length !== references.length) {
      invalidModeReferences();
    }
    const urls = sources.map(({ url }) => url);
    body.extensionSourceVideos = urls;
    body.inputs = urls.map((url) => input('video', 'extension_source_videos', url));
    return body;
  }

  invalidModeReferences();
}
