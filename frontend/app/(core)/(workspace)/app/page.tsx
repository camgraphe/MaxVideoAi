'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useEngines, useInfiniteJobs, runPreflight, runGenerate, getJobStatus } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import type { EngineCaps, EngineInputField, Mode, PreflightRequest, PreflightResponse } from '@/types/engines';
import { getEngineCaps, type EngineCaps as EngineCapabilityCaps } from '@/fixtures/engineCaps';
import { LOGIN_LAST_TARGET_KEY, LOGIN_SKIP_ONBOARDING_KEY } from '@/lib/auth-storage';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { SettingsControls } from '@/components/SettingsControls';
import { Composer, type ComposerAttachment, type AssetFieldConfig, type AssetFieldRole } from '@/components/Composer';
import type { QuadPreviewTile, QuadTileAction } from '@/components/QuadPreviewPanel';
import { GalleryRail } from '@/components/GalleryRail';
import type { GroupSummary, GroupMemberSummary } from '@/types/groups';
import { CompositePreviewDock } from '@/components/groups/CompositePreviewDock';
import dynamic from 'next/dynamic';
import { DEFAULT_PROCESSING_COPY } from '@/components/groups/ProcessingOverlay';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { getRenderEta } from '@/lib/render-eta';
import { ENV as CLIENT_ENV } from '@/lib/env';
import { adaptGroupSummaries, adaptGroupSummary } from '@/lib/video-group-adapter';
import type { VideoGroup, VideoItem, ResultProvider } from '@/types/video-groups';
import { useResultProvider } from '@/hooks/useResultProvider';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { normalizeGroupSummaries, normalizeGroupSummary } from '@/lib/normalize-group-summary';
import type { Job } from '@/types/jobs';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supportsAudioPricingToggle } from '@/lib/pricing-addons';
import { readLastKnownUserId } from '@/lib/last-known';
import {
  getLumaRay2DurationInfo,
  getLumaRay2ResolutionInfo,
  isLumaRay2AspectRatio,
  toLumaRay2DurationLabel,
  LUMA_RAY2_ERROR_UNSUPPORTED,
  type LumaRay2DurationLabel,
} from '@/lib/luma-ray2';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { isPlaceholderMediaUrl } from '@/lib/media';

function resolveRenderThumb(render: { thumbUrl?: string | null; aspectRatio?: string | null }): string {
  if (render.thumbUrl) return render.thumbUrl;
  switch (render.aspectRatio) {
    case '9:16':
      return '/assets/frames/thumb-9x16.svg';
    case '1:1':
      return '/assets/frames/thumb-1x1.svg';
    default:
      return '/assets/frames/thumb-16x9.svg';
  }
}

type SharedVideoPayload = {
  id: string;
  engineId: string;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  promptExcerpt?: string;
  thumbUrl?: string;
  videoUrl?: string;
  aspectRatio?: string;
  createdAt: string;
};

function toVideoAspect(value?: string | null): VideoItem['aspect'] {
  switch (value) {
    case '9:16':
      return '9:16';
    case '1:1':
      return '1:1';
    default:
      return '16:9';
  }
}

function mapSharedVideoToGroup(video: SharedVideoPayload, provider: ResultProvider): VideoGroup {
  const aspect = toVideoAspect(video.aspectRatio);
  const url = video.videoUrl ?? video.thumbUrl ?? '';
  const item: VideoItem = {
    id: video.id,
    url,
    aspect,
    thumb: video.thumbUrl ?? undefined,
    jobId: video.id,
    durationSec: video.durationSec,
    engineId: video.engineId,
    meta: {
      mediaType: video.videoUrl ? 'video' : 'image',
      prompt: video.prompt,
      engineLabel: video.engineLabel,
    },
  };

  return {
    id: `shared-${video.id}`,
    items: [item],
    layout: 'x1',
    createdAt: video.createdAt,
    provider,
    status: 'ready',
    heroItemId: item.id,
    meta: {
      source: 'gallery',
    },
  };
}

type ReferenceAsset = {
  id: string;
  fieldId: string;
  previewUrl: string;
  kind: 'image' | 'video';
  name: string;
  size: number;
  type: string;
  url?: string;
  width?: number | null;
  height?: number | null;
  assetId?: string;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
};

type UserAsset = {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  mime?: string | null;
  source?: string | null;
  createdAt?: string;
};

type AssetLibrarySource = 'all' | 'upload' | 'generated';

type AssetLibraryModalProps = {
  fieldLabel: string;
  assets: UserAsset[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (asset: UserAsset) => void;
  source: AssetLibrarySource;
  onSourceChange: (source: AssetLibrarySource) => void;
  onRefresh: (source?: AssetLibrarySource) => void;
  onDelete: (asset: UserAsset) => Promise<void> | void;
  deletingAssetId: string | null;
};

const DEFAULT_WORKSPACE_COPY = {
  errors: {
    loadEngines: 'Failed to load engines.',
    noEngines: 'No engines available.',
  },
  gallery: {
    empty: 'Launch a generation to populate your gallery. Variants for each run will appear here.',
  },
  wallet: {
    insufficient: 'Insufficient wallet balance. Please add funds to continue generating.',
    insufficientWithAmount: 'Insufficient wallet balance. Add at least {amount} to continue generating.',
  },
  topUp: {
    title: 'Add credits',
    presetsLabel: 'Add credits',
    otherAmountLabel: 'Other amount',
    minLabel: 'Min {amount}',
    close: 'Close',
    maybeLater: 'Maybe later',
    submit: 'Add funds',
    submitting: 'Starting top-up…',
  },
  assetLibrary: {
    title: 'Select reference image',
    refresh: 'Refresh',
    close: 'Close',
    fieldFallback: 'Reference image',
    empty: 'No saved images yet. Upload a reference image to see it here.',
    emptyUploads: 'No uploaded images yet. Upload a reference image to see it here.',
    emptyGenerated: 'No generated images saved yet. Save a generated image to see it here.',
    tabs: {
      all: 'All',
      upload: 'Uploaded',
      generated: 'Generated',
    },
  },
} as const;

function normalizeEngineToken(value?: string | null): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function matchesEngineToken(engine: EngineCaps, token: string): boolean {
  if (!token) return false;
  if (normalizeEngineToken(engine.id) === token) return true;
  if (normalizeEngineToken(engine.label) === token) return true;
  const slug = normalizeEngineToken(engine.providerMeta?.modelSlug);
  if (slug && slug === token) return true;
  return false;
}

function AssetLibraryModal({
  fieldLabel,
  assets,
  isLoading,
  error,
  onClose,
  onSelect,
  source,
  onSourceChange,
  onRefresh,
  onDelete,
  deletingAssetId,
}: AssetLibraryModalProps) {
  const { t } = useI18n();
  const copy = t('workspace.generate.assetLibrary', DEFAULT_WORKSPACE_COPY.assetLibrary) ?? DEFAULT_WORKSPACE_COPY.assetLibrary;
  const emptyLabel =
    source === 'generated'
      ? (copy as typeof DEFAULT_WORKSPACE_COPY.assetLibrary).emptyGenerated
      : source === 'upload'
        ? (copy as typeof DEFAULT_WORKSPACE_COPY.assetLibrary).emptyUploads
        : copy.empty;
  const formatSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return null;
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} B`;
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-4">
      <div className="absolute inset-0" role="presentation" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl rounded-[16px] border border-border bg-white p-6 shadow-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{copy.title}</h2>
            <p className="text-sm text-text-secondary">{fieldLabel}</p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              className="rounded-input border border-border px-3 py-1.5 text-sm text-text-secondary transition hover:border-accentSoft/60 hover:bg-accentSoft/10"
              onClick={() => onRefresh(source)}
            >
              {copy.refresh}
            </button>
            <button
              type="button"
              className="rounded-input border border-border px-3 py-1.5 text-sm text-text-secondary transition hover:border-accentSoft/60 hover:bg-accentSoft/10"
              onClick={onClose}
            >
              {copy.close}
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Library image filters"
          className="mt-4 flex w-full overflow-hidden rounded-full border border-border bg-white/70 text-xs font-semibold text-text-secondary"
        >
          <button
            type="button"
            role="tab"
            aria-selected={source === 'all'}
            onClick={() => onSourceChange('all')}
            className={`flex-1 px-4 py-2 transition ${source === 'all' ? 'bg-accent text-white' : 'hover:bg-white'}`}
          >
            {(copy as typeof DEFAULT_WORKSPACE_COPY.assetLibrary).tabs.all}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === 'upload'}
            onClick={() => onSourceChange('upload')}
            className={`flex-1 px-4 py-2 transition ${source === 'upload' ? 'bg-accent text-white' : 'hover:bg-white'}`}
          >
            {(copy as typeof DEFAULT_WORKSPACE_COPY.assetLibrary).tabs.upload}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === 'generated'}
            onClick={() => onSourceChange('generated')}
            className={`flex-1 px-4 py-2 transition ${source === 'generated' ? 'bg-accent text-white' : 'hover:bg-white'}`}
          >
            {(copy as typeof DEFAULT_WORKSPACE_COPY.assetLibrary).tabs.generated}
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {error ? (
            <div className="rounded-input border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`asset-skeleton-${index}`} className="h-40 rounded-card border border-border bg-neutral-100" aria-hidden>
                  <div className="skeleton h-full w-full" />
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-input border border-border bg-neutral-50 px-4 py-6 text-center text-sm text-text-secondary">
              {emptyLabel ?? copy.empty ?? 'No saved images yet. Upload a reference image to see it here.'}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {assets.map((asset) => {
                const dimensions = asset.width && asset.height ? `${asset.width}×${asset.height}` : null;
                const sizeLabel = formatSize(asset.size);
                const isDeleting = deletingAssetId === asset.id;
                return (
                  <div key={asset.id} className="overflow-hidden rounded-card border border-border/60 bg-white">
                    <div className="relative" style={{ aspectRatio: '16 / 9' }}>
                      <Image
                        src={asset.url}
                        alt="Reference"
                        fill
                        className="object-cover"
                        sizes="(min-width: 1024px) 400px, (min-width: 640px) 300px, 100vw"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border bg-white px-3 py-2 text-[12px] text-text-secondary">
                      <div className="flex flex-col gap-1">
                        {dimensions && <span>{dimensions}</span>}
                        {sizeLabel && <span>{sizeLabel}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={clsx(
                            'rounded-input border px-3 py-1 text-[12px] font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300',
                            isDeleting
                              ? 'border-rose-200 bg-rose-100 text-rose-500 opacity-70'
                              : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                          )}
                          onClick={() => {
                            const result = onDelete(asset);
                            if (result && typeof result.then === 'function') {
                              void result.catch(() => {
                                // errors handled upstream
                              });
                            }
                          }}
                          disabled={isDeleting}
                        >
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                        <button
                          type="button"
                          className={clsx(
                            'rounded-input border border-accent bg-accent/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-micro text-accent transition',
                            isDeleting ? 'opacity-60' : 'hover:bg-accent/20'
                          )}
                          onClick={() => onSelect(asset)}
                          disabled={isDeleting}
                        >
                          Use
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MODE_DISPLAY_LABEL: Record<Mode, string> = {
  t2v: 'Text → Video',
  i2v: 'Image → Video',
  r2v: 'Reference → Video',
  t2i: 'Text → Image',
  i2i: 'Image → Image',
};

type DurationOptionMeta = {
  raw: number | string;
  value: number;
  label: string;
};

function parseDurationOptionValue(option: number | string): DurationOptionMeta {
  if (typeof option === 'number') {
    return {
      raw: option,
      value: option,
      label: `${option}s`,
    };
  }
  const numeric = Number(option.replace(/[^\d.]/g, ''));
  return {
    raw: option,
    value: Number.isFinite(numeric) ? numeric : 0,
    label: option,
  };
}

function matchesDurationOption(meta: DurationOptionMeta, previousOption: number | string | null | undefined, previousSeconds: number | null | undefined): boolean {
  if (previousOption != null) {
    if (typeof previousOption === 'number') {
      return Math.abs(meta.value - previousOption) < 0.001;
    }
    if (typeof previousOption === 'string') {
      if (previousOption === meta.raw || previousOption === meta.label) return true;
      const previousNumeric = Number(previousOption.replace(/[^\d.]/g, ''));
      if (Number.isFinite(previousNumeric)) {
        return Math.abs(meta.value - previousNumeric) < 0.001;
      }
    }
  }
  if (previousSeconds != null) {
    return Math.abs(meta.value - previousSeconds) < 0.001;
  }
  return false;
}

function normalizeFieldId(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseBooleanInput(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(trimmed)) return true;
    if (['false', '0', 'no', 'off'].includes(trimmed)) return false;
  }
  return null;
}

function findGenerateAudioField(engine: EngineCaps, mode: Mode): EngineInputField | null {
  const schema = engine.inputSchema;
  if (!schema) return null;
  const fields = [...(schema.required ?? []), ...(schema.optional ?? [])];
  return (
    fields.find((field) => {
      const id = normalizeFieldId(field.id);
      if (id !== 'generateaudio') return false;
      return !field.modes || field.modes.includes(mode);
    }) ?? null
  );
}

function resolveAudioDefault(engine: EngineCaps, mode: Mode): boolean {
  const field = findGenerateAudioField(engine, mode);
  const parsed = parseBooleanInput(field?.default);
  return parsed ?? true;
}

function framesToSeconds(frames: number): number {
  if (!Number.isFinite(frames) || frames <= 0) return 1;
  return Math.max(1, Math.round(frames / 24));
}

function coerceFormState(engine: EngineCaps, mode: Mode, previous: FormState | null | undefined): FormState {
  const capability = getEngineCaps(engine.id, mode) as EngineCapabilityCaps | undefined;
  const isLumaRay2Engine = engine.id === 'lumaRay2';

  const durationResult = (() => {
    const prevOption = previous?.durationOption ?? null;
    const prevSeconds = previous?.durationSec ?? null;
    const prevFrames = previous?.numFrames ?? null;
    if (capability?.frames && capability.frames.length) {
      const framesList = capability.frames;
      let selectedFrames = prevFrames && framesList.includes(prevFrames) ? prevFrames : null;
      if (selectedFrames === null && prevSeconds != null) {
        const targetSeconds = Math.max(1, Math.round(prevSeconds));
        selectedFrames = framesList.reduce((best, candidate) => {
          const bestSeconds = framesToSeconds(best);
          const candidateSeconds = framesToSeconds(candidate);
          const bestDiff = Math.abs(bestSeconds - targetSeconds);
          const candidateDiff = Math.abs(candidateSeconds - targetSeconds);
          return candidateDiff < bestDiff ? candidate : best;
        }, framesList[0]);
      }
      if (selectedFrames === null) {
        selectedFrames = framesList[0];
      }
      const durationSec = framesToSeconds(selectedFrames);
      return {
        durationSec,
        durationOption: selectedFrames,
        numFrames: selectedFrames,
      };
    }
    if (capability?.duration) {
      if ('options' in capability.duration) {
        const parsedOptions = capability.duration.options.map(parseDurationOptionValue).filter((entry) => entry.value > 0);
        const defaultRaw = capability.duration.default ?? parsedOptions[0]?.raw ?? engine.maxDurationSec;
        const defaultMeta = parseDurationOptionValue(defaultRaw as number | string);
        const closestBySeconds =
          prevSeconds != null
            ? parsedOptions.reduce((best, candidate) => {
                const bestDiff = Math.abs(best.value - prevSeconds);
                const candidateDiff = Math.abs(candidate.value - prevSeconds);
                return candidateDiff < bestDiff ? candidate : best;
              }, parsedOptions[0])
            : null;
        const selected = parsedOptions.find((meta) => matchesDurationOption(meta, prevOption, prevSeconds))
          ?? closestBySeconds
          ?? parsedOptions.find((meta) => matchesDurationOption(meta, defaultRaw as number | string, defaultMeta.value))
          ?? parsedOptions[0]
          ?? defaultMeta;
        const clampedSeconds = Math.max(1, Math.min(engine.maxDurationSec, Math.round(selected.value)));
        return {
          durationSec: clampedSeconds,
          durationOption: selected.raw,
          numFrames: null,
        };
      }
      const min = capability.duration.min;
      const defaultValue = typeof capability.duration.default === 'number' ? capability.duration.default : min;
      const candidate = prevSeconds != null ? Math.max(min, prevSeconds) : defaultValue;
      const clampedSeconds = Math.max(min, Math.min(engine.maxDurationSec, Math.round(candidate)));
      return {
        durationSec: clampedSeconds,
        durationOption: clampedSeconds,
        numFrames: null,
      };
    }
    const fallback = prevSeconds != null ? prevSeconds : Math.min(engine.maxDurationSec, 8);
    return {
      durationSec: Math.max(1, Math.round(fallback)),
      durationOption: fallback,
      numFrames: null,
    };
  })();

  const resolutionOptions = capability?.resolution && capability.resolution.length ? capability.resolution : engine.resolutions;
  const aspectOptions = capability
    ? capability.aspectRatio && capability.aspectRatio.length
      ? capability.aspectRatio
      : []
    : engine.aspectRatios;

  const resolution = (() => {
    if (resolutionOptions.length === 0) {
      return previous?.resolution ?? engine.resolutions[0] ?? '1080p';
    }
    const previousResolution = previous?.resolution;
    if (previousResolution && resolutionOptions.includes(previousResolution)) {
      return previousResolution;
    }
    return resolutionOptions[0];
  })();

  const aspectRatio = (() => {
    if (aspectOptions.length === 0) {
      return previous?.aspectRatio ?? 'source';
    }
    const previousAspect = previous?.aspectRatio;
    if (previousAspect && aspectOptions.includes(previousAspect)) {
      return previousAspect;
    }
    return aspectOptions[0];
  })();

  const fpsOptions = engine.fps && engine.fps.length ? engine.fps : [24];
  const fps = (() => {
    if (previous?.fps && fpsOptions.includes(previous.fps)) {
      return previous.fps;
    }
    return fpsOptions[0];
  })();

  const iterations = previous?.iterations ? Math.max(1, Math.min(4, previous.iterations)) : 1;
  const loop = isLumaRay2Engine ? Boolean(previous?.loop) : undefined;
  const audio = (() => {
    const previousAudio = typeof previous?.audio === 'boolean' ? previous.audio : null;
    if (previousAudio !== null) return previousAudio;
    return resolveAudioDefault(engine, mode);
  })();

  return {
    engineId: engine.id,
    mode,
    durationSec: durationResult.durationSec,
    durationOption: durationResult.durationOption,
    numFrames: durationResult.numFrames ?? undefined,
    resolution,
    aspectRatio,
    fps,
    iterations,
    seedLocked: previous?.seedLocked ?? false,
    loop,
    audio,
  };
}

type GenerateClientError = Error & {
  code?: string;
  originalMessage?: string | null;
  providerMessage?: string | null;
  field?: string;
  allowed?: Array<string | number>;
  value?: unknown;
  details?: {
    requiredCents?: number;
    balanceCents?: number;
    [key: string]: unknown;
  };
};

function isInsufficientFundsError(error: unknown): error is GenerateClientError & { code: 'INSUFFICIENT_WALLET_FUNDS' } {
  if (!(error instanceof Error)) return false;
  const code = (error as GenerateClientError).code;
  return code === 'INSUFFICIENT_WALLET_FUNDS' || code === 'INSUFFICIENT_FUNDS';
}

function emitClientMetric(event: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('mvai:analytics', { detail: { event, payload } }));
  } catch {
    // swallow errors if analytics transport is unavailable
  }
}

interface FormState {
  engineId: string;
  mode: Mode;
  durationSec: number;
  durationOption?: number | string | null;
  numFrames?: number | null;
  resolution: string;
  aspectRatio: string;
  fps: number;
  iterations: number;
  seedLocked?: boolean;
  loop?: boolean;
  audio: boolean;
}

const DEFAULT_PROMPT = 'A quiet cinematic shot of neon-lit Tokyo streets in the rain';
const STORAGE_KEYS = {
  prompt: 'maxvideoai.generate.prompt.v1',
  negativePrompt: 'maxvideoai.generate.negativePrompt.v1',
  form: 'maxvideoai.generate.form.v1',
  memberTier: 'maxvideoai.generate.memberTier.v1',
  pendingRenders: 'maxvideoai.generate.pendingRenders.v1',
  previewJobId: 'maxvideoai.generate.previewJobId.v1',
} as const;

type StoredFormState = Partial<FormState> & { engineId: string; mode: Mode; updatedAt?: number };

function parseStoredForm(value: string): StoredFormState | null {
  try {
    const raw = JSON.parse(value) as StoredFormState | null;
    if (!raw || typeof raw !== 'object') return null;

    const {
      engineId,
      mode,
      durationSec,
      durationOption,
      numFrames,
      resolution,
      aspectRatio,
      fps,
      iterations,
      seedLocked,
      loop,
      audio,
      updatedAt,
    } = raw;

    if (typeof engineId !== 'string' || typeof mode !== 'string') return null;

    return {
      engineId,
      mode: mode as Mode,
      durationSec: typeof durationSec === 'number' && Number.isFinite(durationSec) ? durationSec : undefined,
      durationOption:
        typeof durationOption === 'number' || typeof durationOption === 'string'
          ? durationOption
          : undefined,
      numFrames:
        typeof numFrames === 'number' && Number.isFinite(numFrames) && numFrames > 0
          ? Math.round(numFrames)
          : undefined,
      resolution: typeof resolution === 'string' ? resolution : undefined,
      aspectRatio: typeof aspectRatio === 'string' ? aspectRatio : undefined,
      fps: typeof fps === 'number' && Number.isFinite(fps) ? fps : undefined,
      iterations: typeof iterations === 'number' && iterations > 0 ? iterations : undefined,
      seedLocked: typeof seedLocked === 'boolean' ? seedLocked : undefined,
      loop: typeof loop === 'boolean' ? loop : undefined,
      audio: typeof audio === 'boolean' ? audio : undefined,
      updatedAt: typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

type LocalRender = {
  localKey: string;
  batchId: string;
  iterationIndex: number;
  iterationCount: number;
  id: string;
  jobId?: string;
  engineId: string;
  engineLabel: string;
  createdAt: string;
  aspectRatio: string;
  durationSec: number;
  prompt: string;
  progress: number; // 0-100
  message: string;
  status: 'pending' | 'completed' | 'failed';
  videoUrl?: string;
  readyVideoUrl?: string;
  thumbUrl?: string;
  hasAudio?: boolean;
  priceCents?: number;
  currency?: string;
  pricingSnapshot?: PreflightResponse['pricing'];
  paymentStatus?: string;
  etaSeconds?: number;
  etaLabel?: string;
  startedAt: number;
  minReadyAt: number;
  groupId?: string | null;
  renderIds?: string[];
  heroRenderId?: string | null;
};

type LocalRenderGroup = {
  id: string;
  items: LocalRender[];
  iterationCount: number;
  readyCount: number;
  totalPriceCents: number | null;
  currency?: string;
  groupId?: string | null;
};

const PERSISTED_RENDER_VERSION = 1;
const MAX_PERSISTED_RENDERS = 24;

type PersistedRender = {
  version: number;
  localKey: string;
  batchId: string;
  iterationIndex: number;
  iterationCount: number;
  id: string;
  jobId?: string;
  engineId: string;
  engineLabel: string;
  createdAt: string;
  aspectRatio: string;
  durationSec: number;
  prompt: string;
  progress: number;
  message: string;
  status: 'pending' | 'completed' | 'failed';
  videoUrl?: string | null;
  readyVideoUrl?: string | null;
  thumbUrl?: string | null;
  hasAudio?: boolean;
  priceCents?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
  startedAt: number;
  minReadyAt: number;
  groupId?: string | null;
  renderIds?: string[];
  heroRenderId?: string | null;
};

function coercePersistedRender(entry: PersistedRender): LocalRender | null {
  const localKey = typeof entry.localKey === 'string' && entry.localKey.length ? entry.localKey : null;
  const engineId = typeof entry.engineId === 'string' && entry.engineId.length ? entry.engineId : null;
  const engineLabel = typeof entry.engineLabel === 'string' && entry.engineLabel.length ? entry.engineLabel : null;
  if (!localKey || !engineId || !engineLabel) {
    return null;
  }

  const createdAt =
    typeof entry.createdAt === 'string' && entry.createdAt.length ? entry.createdAt : new Date().toISOString();
  const iterationIndex =
    Number.isFinite(entry.iterationIndex) && entry.iterationIndex >= 0 ? Math.trunc(entry.iterationIndex) : 0;
  const iterationCount =
    Number.isFinite(entry.iterationCount) && entry.iterationCount > 0 ? Math.trunc(entry.iterationCount) : 1;
  const durationSec =
    Number.isFinite(entry.durationSec) && entry.durationSec >= 0 ? Math.round(entry.durationSec) : 0;
  const progress =
    Number.isFinite(entry.progress) && entry.progress >= 0
      ? Math.max(0, Math.min(100, Math.round(entry.progress)))
      : 0;
  const status: 'pending' | 'completed' | 'failed' =
    entry.status === 'completed' || entry.status === 'failed' ? entry.status : 'pending';
  const startedAt =
    Number.isFinite(entry.startedAt) && entry.startedAt > 0 ? Math.trunc(entry.startedAt) : Date.now();
  const minReadyAt =
    Number.isFinite(entry.minReadyAt) && entry.minReadyAt > 0 ? Math.trunc(entry.minReadyAt) : startedAt;

  return {
    localKey,
    batchId: typeof entry.batchId === 'string' && entry.batchId.length ? entry.batchId : localKey,
    iterationIndex,
    iterationCount,
    id: typeof entry.id === 'string' && entry.id.length ? entry.id : localKey,
    jobId: typeof entry.jobId === 'string' && entry.jobId.length ? entry.jobId : undefined,
    engineId,
    engineLabel,
    createdAt,
    aspectRatio: typeof entry.aspectRatio === 'string' && entry.aspectRatio.length ? entry.aspectRatio : '16:9',
    durationSec,
    prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
    progress,
    message: typeof entry.message === 'string' && entry.message.length ? entry.message : '',
    status,
    videoUrl: typeof entry.videoUrl === 'string' && entry.videoUrl.length ? entry.videoUrl : undefined,
    readyVideoUrl:
      typeof entry.readyVideoUrl === 'string' && entry.readyVideoUrl.length ? entry.readyVideoUrl : undefined,
    thumbUrl: typeof entry.thumbUrl === 'string' && entry.thumbUrl.length ? entry.thumbUrl : undefined,
    hasAudio: typeof entry.hasAudio === 'boolean' ? entry.hasAudio : undefined,
    priceCents: typeof entry.priceCents === 'number' ? entry.priceCents : undefined,
    currency: typeof entry.currency === 'string' && entry.currency.length ? entry.currency : undefined,
    pricingSnapshot: undefined,
    paymentStatus: typeof entry.paymentStatus === 'string' && entry.paymentStatus.length ? entry.paymentStatus : undefined,
    etaSeconds: typeof entry.etaSeconds === 'number' ? entry.etaSeconds : undefined,
    etaLabel: typeof entry.etaLabel === 'string' && entry.etaLabel.length ? entry.etaLabel : undefined,
    startedAt,
    minReadyAt,
    groupId:
      typeof entry.groupId === 'string'
        ? entry.groupId
        : entry.groupId === null
          ? null
          : undefined,
    renderIds: Array.isArray(entry.renderIds)
      ? entry.renderIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : undefined,
    heroRenderId: typeof entry.heroRenderId === 'string' ? entry.heroRenderId : null,
  };
}

function deserializePendingRenders(value: string | null): LocalRender[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as Array<Partial<PersistedRender>> | null;
    if (!Array.isArray(parsed)) return [];
    const items: LocalRender[] = [];
    parsed.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      if (entry.version !== PERSISTED_RENDER_VERSION) return;
      const normalized = coercePersistedRender(entry as PersistedRender);
      if (normalized && normalized.status === 'pending' && typeof normalized.jobId === 'string' && normalized.jobId.length > 0) {
        items.push(normalized);
      }
    });
    items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return items;
  } catch {
    return [];
  }
}

function serializePendingRenders(renders: LocalRender[]): string | null {
  const pending = renders
    .filter((render) => render.status === 'pending' && typeof render.jobId === 'string' && render.jobId.length > 0)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_PERSISTED_RENDERS)
    .map((render) => ({
      version: PERSISTED_RENDER_VERSION,
      localKey: render.localKey,
      batchId: render.batchId,
      iterationIndex: render.iterationIndex,
      iterationCount: render.iterationCount,
      id: render.id,
      jobId: render.jobId,
      engineId: render.engineId,
      engineLabel: render.engineLabel,
      createdAt: render.createdAt,
      aspectRatio: render.aspectRatio,
      durationSec: render.durationSec,
      prompt: render.prompt,
      progress: render.progress,
      message: render.message,
      status: render.status,
      videoUrl: render.videoUrl,
      readyVideoUrl: render.readyVideoUrl,
      thumbUrl: render.thumbUrl,
      hasAudio: render.hasAudio,
      priceCents: render.priceCents,
      currency: render.currency,
      paymentStatus: render.paymentStatus,
      etaSeconds: render.etaSeconds,
      etaLabel: render.etaLabel,
      startedAt: render.startedAt,
      minReadyAt: render.minReadyAt,
      groupId: render.groupId ?? null,
      renderIds: render.renderIds,
      heroRenderId: render.heroRenderId ?? null,
    }));
  if (!pending.length) return null;
  try {
    return JSON.stringify(pending);
  } catch {
    return null;
  }
}

const DEBOUNCE_MS = 200;

export default function Page() {
  const { data, error: enginesError, isLoading } = useEngines();
  const engines = useMemo(() => data?.engines ?? [], [data]);
  const { data: latestJobsPages, mutate: mutateLatestJobs } = useInfiniteJobs(24, { type: 'video' });
  const { user, loading: authLoading, authStatus } = useRequireAuth();
  const engineIdByLabel = useMemo(() => {
    const map = new Map<string, string>();
    engines.forEach((engine) => {
      map.set(engine.label.toLowerCase(), engine.id);
    });
    return map;
  }, [engines]);
  const recentJobs = useMemo(
    () => latestJobsPages?.flatMap((page) => page.jobs ?? []) ?? [],
    [latestJobsPages]
  );
  const provider = useResultProvider();
  const showCenterGallery = CLIENT_ENV.WORKSPACE_CENTER_GALLERY === 'true';
  const { t } = useI18n();
  const workspaceCopy = t('workspace.generate', DEFAULT_WORKSPACE_COPY) ?? DEFAULT_WORKSPACE_COPY;
  const processingCopy = (t('workspace.generate.processing', DEFAULT_PROCESSING_COPY) ??
    DEFAULT_PROCESSING_COPY) as typeof DEFAULT_PROCESSING_COPY;
  const formatTakeLabel = useCallback(
    (current: number, total: number) => {
      if (total <= 1) return '';
      const template = processingCopy.takeLabel ?? DEFAULT_PROCESSING_COPY.takeLabel;
      if (!template) return '';
      return template.replace('{current}', `${current}`).replace('{total}', `${total}`);
    },
    [processingCopy.takeLabel]
  );

  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hydratedForScope, setHydratedForScope] = useState<string | null>(null);
  const { data: userPreferences } = useUserPreferences(Boolean(userId));
  const defaultAllowIndex = userPreferences?.defaultAllowIndex ?? true;

  const [form, setForm] = useState<FormState | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [cfgScale, setCfgScale] = useState<number | null>(null);
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [preflightError, setPreflightError] = useState<string | undefined>();
  const [isPricing, setPricing] = useState(false);
  const [memberTier, setMemberTier] = useState<'Member' | 'Plus' | 'Pro'>('Member');
  const [notice, setNotice] = useState<string | null>(null);
  const [topUpModal, setTopUpModal] = useState<{
    message: string;
    amountLabel?: string;
    shortfallCents?: number;
  } | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  const storageScope = useMemo(() => userId ?? 'anon', [userId]);
  const storageKey = useCallback(
    (base: string, scope: string = storageScope) => `${base}:${scope}`,
    [storageScope]
  );
  const readScopedStorage = useCallback(
    (base: string): string | null => {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(storageKey(base));
    },
    [storageKey]
  );
  const readStorage = useCallback(
    (base: string): string | null => {
      if (typeof window === 'undefined') return null;
      // Prefer the unscoped "last state" to survive auth transitions and hard refreshes.
      if (storageScope === 'anon') {
        const baseValue = window.localStorage.getItem(base);
        if (baseValue !== null) return baseValue;
        return window.localStorage.getItem(storageKey(base));
      }

      const scopedValue = window.localStorage.getItem(storageKey(base));
      if (scopedValue !== null) return scopedValue;

      const baseValue = window.localStorage.getItem(base);
      if (baseValue !== null) return baseValue;

      const anonValue = window.localStorage.getItem(storageKey(base, 'anon'));
      if (anonValue !== null) return anonValue;

      return null;
    },
    [storageKey, storageScope]
  );
  const writeScopedStorage = useCallback(
    (base: string, value: string | null) => {
      if (typeof window === 'undefined') return;
      const key = storageKey(base);
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
      window.localStorage.removeItem(base);
    },
    [storageKey]
  );
  const writeStorage = useCallback(
    (base: string, value: string | null) => {
      if (typeof window === 'undefined') return;
      const key = storageKey(base);
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
      // Always keep an unscoped fallback so the last state survives auth transitions/navigation.
      if (value === null) {
        window.localStorage.removeItem(base);
      } else {
        window.localStorage.setItem(base, value);
      }
    },
    [storageKey]
  );
const fromVideoId = useMemo(() => searchParams?.get('from') ?? null, [searchParams]);
const requestedJobId = useMemo(() => {
  const value = searchParams?.get('job');
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}, [searchParams]);
const requestedEngineId = useMemo(() => {
  const value = searchParams?.get('engine');
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}, [searchParams]);
const resolvedRequestedEngineId = useMemo(() => {
  if (!requestedEngineId) return null;
  const normalized = requestedEngineId.trim().toLowerCase();
  if (normalized === 'pika-image-to-video') {
    return 'pika-text-to-video';
  }
  return requestedEngineId;
}, [requestedEngineId]);
const requestedEngineToken = useMemo(
  () => normalizeEngineToken(resolvedRequestedEngineId),
  [resolvedRequestedEngineId]
);
if (typeof window !== 'undefined') {
  console.log('[generate] requested engine params', {
    raw: requestedEngineId,
    resolved: resolvedRequestedEngineId,
    token: requestedEngineToken,
    search: searchParams?.toString() ?? '',
  });
}
const searchString = useMemo(() => searchParams?.toString() ?? '', [searchParams]);
const skipOnboardingRef = useRef<boolean>(false);
const hydratedJobRef = useRef<string | null>(null);

useEffect(() => {
  if (typeof window === 'undefined') return;
  let skipFlag = window.sessionStorage.getItem(LOGIN_SKIP_ONBOARDING_KEY);
  if (!skipFlag) {
    skipFlag = window.localStorage.getItem(LOGIN_SKIP_ONBOARDING_KEY);
    if (skipFlag) {
      window.localStorage.removeItem(LOGIN_SKIP_ONBOARDING_KEY);
      window.sessionStorage.setItem(LOGIN_SKIP_ONBOARDING_KEY, skipFlag);
    }
  }
  if (skipFlag === 'true') {
    skipOnboardingRef.current = true;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[app] skip onboarding via flag');
    }
    window.sessionStorage.removeItem(LOGIN_SKIP_ONBOARDING_KEY);
    window.localStorage.removeItem(LOGIN_SKIP_ONBOARDING_KEY);
  }
  let lastTarget =
    window.sessionStorage.getItem(LOGIN_LAST_TARGET_KEY) ??
    null;
  if (!lastTarget) {
    lastTarget = window.localStorage.getItem(LOGIN_LAST_TARGET_KEY);
    if (lastTarget) {
      window.localStorage.removeItem(LOGIN_LAST_TARGET_KEY);
      window.sessionStorage.setItem(LOGIN_LAST_TARGET_KEY, lastTarget);
    }
  }
  if (lastTarget) {
    const normalized = lastTarget.trim();
    const shouldSkip =
      normalized.startsWith('/generate') ||
      normalized.startsWith('/app') ||
      normalized.includes('from=') ||
      normalized.includes('engine=');
    if (shouldSkip) {
      skipOnboardingRef.current = true;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[app] read last target', { lastTarget, shouldSkip });
    }
    window.sessionStorage.removeItem(LOGIN_LAST_TARGET_KEY);
    window.localStorage.removeItem(LOGIN_LAST_TARGET_KEY);
  }
}, []);

useEffect(() => {
  if (fromVideoId) {
    skipOnboardingRef.current = true;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[app] skip onboarding due to fromVideoId', { fromVideoId });
    }
  }
}, [fromVideoId]);
  const [renders, setRenders] = useState<LocalRender[]>([]);
  const [sharedPrompt, setSharedPrompt] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<{
    localKey?: string;
    batchId?: string;
    iterationIndex?: number;
    iterationCount?: number;
    id?: string;
    videoUrl?: string;
    aspectRatio?: string;
    thumbUrl?: string;
    progress?: number;
    status?: 'pending' | 'completed' | 'failed';
    message?: string;
    priceCents?: number;
    currency?: string;
    etaSeconds?: number;
    etaLabel?: string;
    prompt?: string;
  } | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchHeroes, setBatchHeroes] = useState<Record<string, string>>({});
  const [viewerTarget, setViewerTarget] = useState<{ kind: 'pending'; id: string } | { kind: 'summary'; summary: GroupSummary } | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 1280px)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktopLayout(event.matches);
    };
    handleChange(mediaQuery);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const rendersRef = useRef<LocalRender[]>([]);
  const persistedRendersRef = useRef<string | null>(null);
  const pendingPollRef = useRef<number | null>(null);
  const statusErrorCountsRef = useRef<Map<string, { unauthorized: number }>>(new Map());
  const convertJobToLocalRender = useCallback(
    (job: Job): LocalRender => {
      const baseLocalKey = job.localKey ?? job.jobId;
      const localKey = baseLocalKey ?? `job_${job.jobId}`;
      const batchId = job.batchId ?? job.groupId ?? localKey;
      const renderIds = Array.isArray(job.renderIds)
        ? job.renderIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
        : undefined;
      const normalizedStatus = (() => {
        const raw = (job.status ?? '').toLowerCase();
        if (raw === 'failed') return 'failed' as const;
        if (raw === 'completed') return 'completed' as const;
        if (job.videoUrl) return 'completed' as const;
        return 'pending' as const;
      })();
      const normalizedProgress = (() => {
        if (typeof job.progress === 'number' && Number.isFinite(job.progress)) {
          return Math.max(0, Math.min(100, Math.round(job.progress)));
        }
        if (normalizedStatus === 'completed' || job.videoUrl) return 100;
        if (normalizedStatus === 'failed') return 100;
        return 0;
      })();
      const createdAt = typeof job.createdAt === 'string' && job.createdAt.length ? job.createdAt : new Date().toISOString();
      const parsedCreated = Number.isFinite(Date.parse(createdAt)) ? Date.parse(createdAt) : Date.now();
      const priceCents = typeof job.finalPriceCents === 'number' ? job.finalPriceCents : job.pricingSnapshot?.totalCents;
      const currency = job.currency ?? job.pricingSnapshot?.currency ?? undefined;
      const engineId =
        job.engineId ?? (job.engineLabel ? engineIdByLabel.get(job.engineLabel.toLowerCase()) ?? undefined : undefined) ?? 'unknown-engine';
      const pendingMessage = (() => {
        if (engineId.startsWith('sora-2')) {
          return 'Sora 2 renders take a little longer—hang tight while we finish up the magic.';
        }
        return 'Render pending.';
      })();

      const message =
        job.message ??
        (normalizedStatus === 'completed'
          ? 'Render completed.'
          : normalizedStatus === 'failed'
            ? 'The service reported a failure without details. Try again. If it fails repeatedly, contact support with your request ID.'
            : pendingMessage);
      const jobThumb = job.thumbUrl && !isPlaceholderMediaUrl(job.thumbUrl) ? job.thumbUrl : null;
      const thumbUrl =
        jobThumb ??
        job.previewFrame ??
        resolveRenderThumb({ thumbUrl: job.thumbUrl, aspectRatio: job.aspectRatio ?? null });

      return {
        localKey,
        batchId,
        iterationIndex:
          typeof job.iterationIndex === 'number' && Number.isFinite(job.iterationIndex)
            ? Math.max(0, Math.trunc(job.iterationIndex))
            : 0,
        iterationCount: Math.max(
          1,
          typeof job.iterationCount === 'number' && Number.isFinite(job.iterationCount)
            ? Math.trunc(job.iterationCount)
            : renderIds?.length ?? 1
        ),
        id: job.jobId,
        jobId: job.jobId,
        engineId,
        engineLabel: job.engineLabel ?? 'Unknown engine',
        createdAt,
        aspectRatio: job.aspectRatio ?? '16:9',
        durationSec: job.durationSec,
        prompt: job.prompt ?? '',
        progress: normalizedProgress,
        message,
      status: normalizedStatus,
      videoUrl: job.videoUrl ?? undefined,
      readyVideoUrl: job.videoUrl ?? undefined,
      thumbUrl,
      hasAudio: typeof job.hasAudio === 'boolean' ? job.hasAudio : undefined,
      priceCents: priceCents ?? undefined,
        currency,
        pricingSnapshot: job.pricingSnapshot,
        paymentStatus: job.paymentStatus ?? 'platform',
        etaSeconds: job.etaSeconds ?? undefined,
        etaLabel: job.etaLabel ?? undefined,
        startedAt: parsedCreated,
        minReadyAt: parsedCreated,
        groupId: job.groupId ?? job.batchId ?? null,
        renderIds,
        heroRenderId: job.heroRenderId ?? null,
      };
    },
    [engineIdByLabel]
  );
  const hydratedScopeRef = useRef<string | null>(null);
  const hasStoredFormRef = useRef<boolean>(false);

  useEffect(() => {
    if (authLoading) return;
    if (user?.id) {
      setUserId(user.id);
      setAuthChecked(true);
      return;
    }
    if (authStatus === 'refreshing' || authStatus === 'unknown') {
      const lastKnownUserId = readLastKnownUserId();
      if (lastKnownUserId) {
        setUserId(lastKnownUserId);
        setAuthChecked(true);
      }
      return;
    }
    setUserId(null);
    setAuthChecked(true);
  }, [authLoading, authStatus, user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!engines.length) return;
    if (requestedJobId) return;
    if (hydratedScopeRef.current === storageScope) return;
    hydratedScopeRef.current = storageScope;
    setHydratedForScope(null);

    setRenders([]);
    setBatchHeroes({});
    setActiveBatchId(null);
    setActiveGroupId(null);

    try {
      const promptValue = readStorage(STORAGE_KEYS.prompt);
      setPrompt(promptValue ?? DEFAULT_PROMPT);

      const negativeValue = readStorage(STORAGE_KEYS.negativePrompt);
      setNegativePrompt(negativeValue ?? '');

      const formValue = readStorage(STORAGE_KEYS.form);
      const storedFormRaw = (() => {
        try {
          const scoped = window.localStorage.getItem(storageKey(STORAGE_KEYS.form));
          const base = window.localStorage.getItem(STORAGE_KEYS.form);
          const scopedParsed = scoped ? parseStoredForm(scoped) : null;
          const baseParsed = base ? parseStoredForm(base) : null;
          if (storageScope === 'anon') {
            return baseParsed ?? scopedParsed ?? (formValue ? parseStoredForm(formValue) : null);
          }
          if (scopedParsed && baseParsed) {
            const scopedAt = typeof scopedParsed.updatedAt === 'number' ? scopedParsed.updatedAt : 0;
            const baseAt = typeof baseParsed.updatedAt === 'number' ? baseParsed.updatedAt : 0;
            return baseAt > scopedAt ? baseParsed : scopedParsed;
          }
          return scopedParsed ?? baseParsed ?? (formValue ? parseStoredForm(formValue) : null);
        } catch {
          return formValue ? parseStoredForm(formValue) : null;
        }
      })();
      let nextForm: FormState | null = null;

      if (storedFormRaw) {
        const storedToken = normalizeEngineToken(storedFormRaw.engineId);
        const engine =
          engines.find((entry) => entry.id === storedFormRaw.engineId) ??
          (storedToken ? engines.find((entry) => matchesEngineToken(entry, storedToken)) : null) ??
          engines[0] ??
          null;
        if (engine) {
          const mode = engine.modes.includes(storedFormRaw.mode) ? storedFormRaw.mode : (engine.modes[0] ?? 't2v');
          const base = coerceFormState(engine, mode, null);
          const candidate: FormState = {
            ...base,
            engineId: engine.id,
            mode,
            durationSec:
              typeof storedFormRaw.durationSec === 'number' && Number.isFinite(storedFormRaw.durationSec)
                ? storedFormRaw.durationSec
                : base.durationSec,
            durationOption:
              typeof storedFormRaw.durationOption === 'number' || typeof storedFormRaw.durationOption === 'string'
                ? storedFormRaw.durationOption
                : base.durationOption,
            numFrames:
              typeof storedFormRaw.numFrames === 'number' && Number.isFinite(storedFormRaw.numFrames)
                ? storedFormRaw.numFrames
                : base.numFrames,
            resolution: typeof storedFormRaw.resolution === 'string' ? storedFormRaw.resolution : base.resolution,
            aspectRatio: typeof storedFormRaw.aspectRatio === 'string' ? storedFormRaw.aspectRatio : base.aspectRatio,
            fps: typeof storedFormRaw.fps === 'number' && Number.isFinite(storedFormRaw.fps) ? storedFormRaw.fps : base.fps,
            iterations:
              typeof storedFormRaw.iterations === 'number' && Number.isFinite(storedFormRaw.iterations)
                ? storedFormRaw.iterations
                : base.iterations,
            seedLocked: typeof storedFormRaw.seedLocked === 'boolean' ? storedFormRaw.seedLocked : base.seedLocked,
            loop: typeof storedFormRaw.loop === 'boolean' ? storedFormRaw.loop : base.loop,
            audio: typeof storedFormRaw.audio === 'boolean' ? storedFormRaw.audio : base.audio,
          };
          nextForm = coerceFormState(engine, mode, candidate);
        }
      }
      hasStoredFormRef.current = Boolean(nextForm);

      if (resolvedRequestedEngineId) {
        if (!storedFormRaw) {
          const base: FormState = {
            engineId: resolvedRequestedEngineId,
            mode: 't2v' as Mode,
            durationSec: 4,
            durationOption: 4,
            numFrames: undefined,
            resolution: '720p',
            aspectRatio: '16:9',
            fps: 24,
            iterations: 1,
            seedLocked: false,
            audio: true,
          };
          nextForm = base;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[generate] engine override from storage hydrate', {
              from: null,
              to: nextForm.engineId,
            });
          }
          queueMicrotask(() => {
            try {
              writeStorage(STORAGE_KEYS.form, JSON.stringify(nextForm));
            } catch {
              // noop
            }
          });
        }
      }
      if (!nextForm) {
        const engine = engines[0];
        nextForm = coerceFormState(engine, engine.modes[0] ?? 't2v', null);
      }
      setForm(nextForm);

      const storedTier = readStorage(STORAGE_KEYS.memberTier);
      if (storedTier === 'Member' || storedTier === 'Plus' || storedTier === 'Pro') {
        setMemberTier(storedTier);
      }

      const pendingValue = readScopedStorage(STORAGE_KEYS.pendingRenders);
      const pendingRenders = deserializePendingRenders(pendingValue);
      if (pendingRenders.length) {
        setRenders(pendingRenders);
        setBatchHeroes(() => {
          const next: Record<string, string> = {};
          pendingRenders.forEach((render) => {
            if (render.batchId && render.localKey && !next[render.batchId]) {
              next[render.batchId] = render.localKey;
            }
          });
          return next;
        });
        const first = pendingRenders[0];
        const batchId = first.batchId ?? first.groupId ?? first.localKey ?? null;
        setActiveBatchId(batchId);
        setActiveGroupId(first.groupId ?? batchId);
      }
      persistedRendersRef.current = serializePendingRenders(pendingRenders);
    } catch {
      setRenders([]);
      setBatchHeroes({});
      setActiveBatchId(null);
      setActiveGroupId(null);
    } finally {
      setHydratedForScope(storageScope);
    }
  }, [
    engines,
    readScopedStorage,
    readStorage,
    storageKey,
    writeStorage,
    setMemberTier,
    storageScope,
    resolvedRequestedEngineId,
    requestedJobId,
  ]);

  useEffect(() => {
    rendersRef.current = renders;
  }, [renders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedScopeRef.current !== storageScope) return;
    const serialized = serializePendingRenders(renders);
    if (serialized === persistedRendersRef.current) return;
    persistedRendersRef.current = serialized;
    writeScopedStorage(STORAGE_KEYS.pendingRenders, serialized);
  }, [renders, storageScope, writeScopedStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const jobsNeedingRefresh = renders.filter((render) => {
      if (typeof render.jobId !== 'string' || render.jobId.length === 0) return false;
      if (render.status === 'failed') return false;
      const hasVideo = Boolean(render.videoUrl);
      const hasThumb = Boolean(render.thumbUrl && !isPlaceholderMediaUrl(render.thumbUrl));
      if ((render.status ?? 'pending') !== 'completed') return true;
      return !hasVideo || !hasThumb;
    });
    if (!jobsNeedingRefresh.length) {
      if (pendingPollRef.current !== null) {
        window.clearInterval(pendingPollRef.current);
        pendingPollRef.current = null;
      }
      return;
    }
    let cancelled = false;

    const poll = async () => {
      await Promise.all(
        jobsNeedingRefresh.map(async (render) => {
          if (!render.jobId) return;
          try {
            const status = await getJobStatus(render.jobId);
            statusErrorCountsRef.current.delete(render.jobId);
            if (cancelled) return;
            setRenders((prev) =>
              prev.map((item) =>
                item.jobId === render.jobId
                  ? {
                      ...item,
                      status: status.status ?? item.status,
                      progress: status.progress ?? item.progress,
                      readyVideoUrl: status.videoUrl ?? item.readyVideoUrl,
                      videoUrl: status.videoUrl ?? item.videoUrl ?? item.readyVideoUrl,
                      thumbUrl: status.thumbUrl ?? item.thumbUrl,
                      aspectRatio: status.aspectRatio ?? item.aspectRatio,
                      priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? item.priceCents,
                      currency: status.currency ?? status.pricing?.currency ?? item.currency,
                      pricingSnapshot: status.pricing ?? item.pricingSnapshot,
                      paymentStatus: status.paymentStatus ?? item.paymentStatus,
                      message: status.message ?? item.message,
                    }
                  : item
              )
            );
            setSelectedPreview((cur) =>
              cur && (cur.id === render.jobId || cur.localKey === render.localKey)
                ? {
                    ...cur,
                    id: render.jobId,
                    localKey: render.localKey,
                    status: status.status ?? cur.status,
                    progress: status.progress ?? cur.progress,
                    videoUrl: status.videoUrl ?? cur.videoUrl,
                    thumbUrl: status.thumbUrl ?? cur.thumbUrl,
                    aspectRatio: status.aspectRatio ?? cur.aspectRatio,
                    priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? cur.priceCents,
                    currency: status.currency ?? status.pricing?.currency ?? cur.currency,
                    message: status.message ?? cur.message,
                  }
                : cur
            );
          } catch (error) {
            const statusCode = typeof error === 'object' && error ? (error as { status?: unknown }).status : undefined;
            if (statusCode === 404) {
              statusErrorCountsRef.current.delete(render.jobId);
              if (cancelled) return;
              setRenders((prev) => prev.filter((item) => item.jobId !== render.jobId));
              setSelectedPreview((cur) => (cur && cur.id === render.jobId ? null : cur));
              return;
            }

            if (statusCode === 401) {
              const meta = statusErrorCountsRef.current.get(render.jobId) ?? { unauthorized: 0 };
              meta.unauthorized += 1;
              statusErrorCountsRef.current.set(render.jobId, meta);
              if (meta.unauthorized >= 3) {
                statusErrorCountsRef.current.delete(render.jobId);
                if (cancelled) return;
                setRenders((prev) => prev.filter((item) => item.jobId !== render.jobId));
                setSelectedPreview((cur) => (cur && cur.id === render.jobId ? null : cur));
              }
              return;
            }

            // ignore other transient errors and retry on next tick
          }
        })
      );
    };

    void poll();
    if (pendingPollRef.current !== null) {
      window.clearInterval(pendingPollRef.current);
    }
    pendingPollRef.current = window.setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      cancelled = true;
      if (pendingPollRef.current !== null) {
        window.clearInterval(pendingPollRef.current);
        pendingPollRef.current = null;
      }
    };
  }, [renders, setSelectedPreview]);

  useEffect(() => {
    if (!recentJobs.length) return;
    const heroCandidates: Array<{ batchId: string | null; localKey: string }> = [];

    setRenders((previous) => {
      if (!recentJobs.length) return previous;

      const next = [...previous];
      const byLocalKey = new Map<string, number>();
      const byJobId = new Map<string, number>();
      previous.forEach((render, index) => {
        if (render.localKey) {
          byLocalKey.set(render.localKey, index);
        }
        if (render.jobId) {
          byJobId.set(render.jobId, index);
        }
      });

      let changed = false;

      recentJobs.forEach((job) => {
        if (!job.jobId) return;
        const converted = convertJobToLocalRender(job);
        const jobIdIndex = converted.jobId ? byJobId.get(converted.jobId) : undefined;
        const localKeyIndex = byLocalKey.get(converted.localKey);
        const targetIndex = jobIdIndex ?? localKeyIndex;

        if (targetIndex !== undefined) {
          const existing = next[targetIndex];
          const merged: LocalRender = {
            ...converted,
            localKey: existing.localKey ?? converted.localKey,
            batchId: existing.batchId ?? converted.batchId,
          };
          next[targetIndex] = merged;
          if (merged.localKey) {
            byLocalKey.set(merged.localKey, targetIndex);
          }
          if (merged.jobId) {
            byJobId.set(merged.jobId, targetIndex);
          }
          heroCandidates.push({ batchId: merged.batchId ?? null, localKey: merged.localKey });
          changed = true;
        } else {
          const merged: LocalRender = converted;
          next.push(merged);
          if (merged.localKey) {
            byLocalKey.set(merged.localKey, next.length - 1);
          }
          if (merged.jobId) {
            byJobId.set(merged.jobId, next.length - 1);
          }
          heroCandidates.push({ batchId: merged.batchId ?? null, localKey: merged.localKey });
          changed = true;
        }
      });

      if (!changed) return previous;

      next.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      return next;
    });

    if (heroCandidates.length) {
      setBatchHeroes((previous) => {
        const next = { ...previous };
        let modified = false;
        heroCandidates.forEach(({ batchId, localKey }) => {
          if (!batchId || !localKey) return;
          if (!next[batchId]) {
            next[batchId] = localKey;
            modified = true;
          }
        });
        return modified ? next : previous;
      });
    }
  }, [convertJobToLocalRender, recentJobs]);

  useEffect(() => {
    if (!renders.length || !recentJobs.length) return;
    const recentJobIds = new Set<string>();
    recentJobs.forEach((job) => {
      if (typeof job.jobId === 'string' && job.jobId.length > 0) {
        recentJobIds.add(job.jobId);
      }
    });
    if (!recentJobIds.size) return;
    const removedLocalKeys: string[] = [];
    const removedGroupIds = new Set<string>();
    setRenders((prev) => {
      let changed = false;
      const next = prev.filter((render) => {
        if (!render.jobId || !recentJobIds.has(render.jobId)) {
          return true;
        }
        if (render.status !== 'completed') {
          return true;
        }
        const hasVideo = Boolean(render.videoUrl ?? render.readyVideoUrl);
        const hasThumb = Boolean(render.thumbUrl && !isPlaceholderMediaUrl(render.thumbUrl));
        if (!hasVideo || !hasThumb) {
          return true;
        }
        changed = true;
        if (render.localKey) {
          removedLocalKeys.push(render.localKey);
        }
        if (render.batchId) {
          removedGroupIds.add(render.batchId);
        }
        if (render.groupId) {
          removedGroupIds.add(render.groupId);
        }
        return false;
      });
      return changed ? next : prev;
    });
    if (!removedLocalKeys.length && !removedGroupIds.size) {
      return;
    }
    setBatchHeroes((prev) => {
      let changed = false;
      const next = { ...prev };
      removedGroupIds.forEach((groupId) => {
        if (groupId && next[groupId]) {
          delete next[groupId];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setActiveBatchId((current) => (current && removedGroupIds.has(current) ? null : current));
    setActiveGroupId((current) => (current && removedGroupIds.has(current) ? null : current));
    setSelectedPreview((current) => {
      if (!current) return current;
      if (current.localKey && removedLocalKeys.includes(current.localKey)) {
        return null;
      }
      if (current.batchId && removedGroupIds.has(current.batchId)) {
        return null;
      }
      return current;
    });
  }, [recentJobs, renders.length]);

  const renderGroups = useMemo<Map<string, LocalRenderGroup>>(() => {
    const map = new Map<string, LocalRenderGroup>();
    renders.forEach((item) => {
      const key = item.groupId ?? item.batchId ?? item.localKey;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
        existing.readyCount += item.videoUrl ? 1 : 0;
        if (typeof item.priceCents === 'number') {
          existing.totalPriceCents = (existing.totalPriceCents ?? 0) + item.priceCents;
        }
        if (!existing.currency && item.currency) {
          existing.currency = item.currency;
        }
        if (!existing.groupId && item.groupId) {
          existing.groupId = item.groupId;
        }
      } else {
        map.set(key, {
          id: key,
          items: [item],
          iterationCount: item.iterationCount || 1,
          readyCount: item.videoUrl ? 1 : 0,
          totalPriceCents: typeof item.priceCents === 'number' ? item.priceCents : null,
          currency: item.currency,
          groupId: item.groupId ?? item.batchId ?? null,
        });
      }
    });
    map.forEach((group) => {
      group.items.sort((a, b) => a.iterationIndex - b.iterationIndex);
      if (!group.items.length) {
        group.iterationCount = 1;
        group.totalPriceCents = null;
        return;
      }
      const observedCount = Math.max(group.iterationCount, group.items.length);
      group.iterationCount = Math.max(1, Math.min(4, observedCount));
      if (group.totalPriceCents != null && group.iterationCount > group.items.length) {
        // scale total if some iterations missing price yet
        const average = group.totalPriceCents / group.items.length;
        group.totalPriceCents = Math.round(average * group.iterationCount);
      }
    });
    return map;
  }, [renders]);
  const effectiveBatchId = useMemo(() => activeBatchId ?? selectedPreview?.batchId ?? null, [activeBatchId, selectedPreview?.batchId]);
  useEffect(() => {
    if (!effectiveBatchId) return;
    if (batchHeroes[effectiveBatchId]) return;
    const group = renderGroups.get(effectiveBatchId);
    if (!group || !group.items.length) return;
    setBatchHeroes((prev) => {
      if (prev[effectiveBatchId]) return prev;
      return { ...prev, [effectiveBatchId]: group.items[0].localKey };
    });
  }, [effectiveBatchId, renderGroups, batchHeroes]);
  useEffect(() => {
    const currentIterations = form?.iterations ?? 1;
    if (currentIterations <= 1 && viewMode !== 'single') {
      setViewMode('single');
    }
  }, [form?.iterations, viewMode]);
  const pendingGroups = useMemo<GroupSummary[]>(() => {
    const summaries: GroupSummary[] = [];
    renderGroups.forEach((group, id) => {

      const now = Date.now();
      const members: GroupMemberSummary[] = group.items.map((item) => {
        const thumb = item.thumbUrl ?? resolveRenderThumb(item);
        const gatingActive = now < item.minReadyAt && item.status !== 'failed';
        const memberVideoUrl = gatingActive ? null : item.videoUrl ?? item.readyVideoUrl ?? null;
        const memberStatus: GroupMemberSummary['status'] = (() => {
          if (item.status === 'failed') return 'failed';
          if (gatingActive) return 'pending';
          if (item.status === 'completed' || memberVideoUrl) return 'completed';
          return 'pending';
        })();
        const memberProgress = typeof item.progress === 'number'
          ? gatingActive
            ? Math.min(Math.max(item.progress, 5), 95)
            : item.progress
          : memberStatus === 'completed'
            ? 100
            : item.progress;
        const member: GroupMemberSummary = {
          id: item.id,
          jobId: item.id,
          localKey: item.localKey,
          batchId: item.batchId,
          iterationIndex: item.iterationIndex,
          iterationCount: group.iterationCount,
          engineId: item.engineId,
          engineLabel: item.engineLabel,
          durationSec: item.durationSec,
          priceCents: item.priceCents ?? null,
          currency: item.currency ?? group.currency ?? null,
          thumbUrl: thumb,
          videoUrl: memberVideoUrl,
          aspectRatio: item.aspectRatio ?? null,
          prompt: item.prompt,
          status: memberStatus,
          progress: memberProgress,
          message: item.message,
          etaLabel: item.etaLabel ?? null,
          etaSeconds: item.etaSeconds ?? null,
          createdAt: item.createdAt,
          source: 'render',
        };
        return member;
      });

      if (members.length === 0) return;

      const preferredHeroKey = batchHeroes[id] ?? group.items.find((item) => item.videoUrl)?.localKey ?? group.items[0]?.localKey;
      const hero = preferredHeroKey
        ? members.find((member) => member.localKey === preferredHeroKey) ?? members[0]
        : members[0];
      const observedCount = Math.max(group.iterationCount, members.length);
      const displayCount = Math.max(1, Math.min(4, observedCount));

      const previews = members
        .slice(0, displayCount)
        .map((member) => ({
          id: member.id,
          thumbUrl: member.thumbUrl,
          videoUrl: member.videoUrl,
          aspectRatio: member.aspectRatio,
        }));
      const batchKey = group.groupId ?? group.items[0]?.batchId ?? id;

      summaries.push({
        id,
        source: 'active',
        splitMode: displayCount > 1 ? 'quad' : 'single',
        batchId: batchKey,
        count: displayCount,
        totalPriceCents: group.totalPriceCents,
        currency: group.currency ?? hero.currency ?? null,
        createdAt: hero.createdAt,
        hero,
        previews,
        members,
      });
    });

    return summaries.sort((a, b) => {
      const timeA = Date.parse(a.createdAt);
      const timeB = Date.parse(b.createdAt);
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
  }, [renderGroups, batchHeroes]);
  const normalizedPendingGroups = useMemo(() => normalizeGroupSummaries(pendingGroups), [pendingGroups]);
  const pendingSummaryMap = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    pendingGroups.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [pendingGroups]);
  const activeVideoGroups = useMemo(() => adaptGroupSummaries(pendingGroups, provider), [pendingGroups, provider]);
  const [compositeOverride, setCompositeOverride] = useState<VideoGroup | null>(null);
  const [compositeOverrideSummary, setCompositeOverrideSummary] = useState<GroupSummary | null>(null);
  const restoredPreviewJobRef = useRef<string | null>(null);
  const applyVideoSettingsSnapshotRef = useRef<(snapshot: unknown) => void>(() => undefined);
  const activeVideoGroup = useMemo<VideoGroup | null>(() => {
    if (compositeOverride) return null;
    if (!activeVideoGroups.length) return null;
    if (!activeGroupId) return activeVideoGroups[0] ?? null;
    return activeVideoGroups.find((group) => group.id === activeGroupId) ?? activeVideoGroups[0] ?? null;
  }, [activeVideoGroups, activeGroupId, compositeOverride]);
  const compositeGroup = compositeOverride ?? activeVideoGroup ?? null;

  useEffect(() => {
    if (compositeOverrideSummary) {
      return;
    }
    if (!pendingGroups.length) {
      if (activeGroupId !== null) {
        setActiveGroupId(null);
      }
      return;
    }
    if (!activeGroupId || !pendingGroups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(pendingGroups[0].id);
    }
  }, [pendingGroups, activeGroupId, compositeOverrideSummary]);

  const isGenerationLoading = useMemo(() => pendingGroups.some((group) => group.members.some((member) => member.status !== 'completed')), [pendingGroups]);
  const generationSkeletonCount = useMemo(() => {
    const count = renders.length > 0 ? renders.length : form?.iterations ?? 1;
    return Math.max(1, Math.min(4, count || 1));
  }, [renders, form?.iterations]);
  const viewerGroup = useMemo<VideoGroup | null>(() => {
    if (!viewerTarget) return null;
    if (viewerTarget.kind === 'pending') {
      const summary = pendingSummaryMap.get(viewerTarget.id);
      if (!summary) return null;
      return adaptGroupSummary(normalizeGroupSummary(summary), provider);
    }
    return adaptGroupSummary(normalizeGroupSummary(viewerTarget.summary), provider);
  }, [viewerTarget, pendingSummaryMap, provider]);
  useEffect(() => {
    if (!activeGroupId) return;
    if (renderGroups.has(activeGroupId)) {
      setCompositeOverride(null);
      setCompositeOverrideSummary(null);
      setSharedPrompt(null);
    }
  }, [activeGroupId, renderGroups]);
  const buildQuadTileFromRender = useCallback(
    (render: LocalRender, group: LocalRenderGroup): QuadPreviewTile => {
      const gatingActive = render.status !== 'failed' && Date.now() < render.minReadyAt;
      const videoUrl = gatingActive ? undefined : render.videoUrl ?? render.readyVideoUrl;
      const progress = gatingActive
        ? Math.min(Math.max(render.progress ?? 5, 95), 95)
        : videoUrl
          ? 100
          : render.progress;
      const status: QuadPreviewTile['status'] =
        render.status === 'failed'
          ? 'failed'
          : gatingActive
            ? 'pending'
            : videoUrl
              ? 'completed'
              : render.status ?? 'pending';

      return {
        localKey: render.localKey,
        batchId: render.batchId,
        id: render.id,
        jobId: render.jobId,
        iterationIndex: render.iterationIndex,
        iterationCount: group.iterationCount,
        videoUrl,
        thumbUrl: render.thumbUrl,
        aspectRatio: render.aspectRatio,
        progress,
        message: render.message,
        priceCents: render.priceCents,
        currency: render.currency ?? group.currency ?? preflight?.currency ?? 'USD',
        durationSec: render.durationSec,
        engineLabel: render.engineLabel,
        engineId: render.engineId,
        etaLabel: render.etaLabel,
        prompt: render.prompt,
        status,
        hasAudio: typeof render.hasAudio === 'boolean' ? render.hasAudio : undefined,
      };
    },
    [preflight?.currency]
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (!form) return;
    try {
      writeStorage(STORAGE_KEYS.form, JSON.stringify({ ...form, updatedAt: Date.now() }));
    } catch {
      // noop
    }
  }, [form, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    try {
      writeStorage(STORAGE_KEYS.prompt, prompt);
    } catch {
      // noop
    }
  }, [prompt, hydratedForScope, storageScope, writeStorage]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    try {
      writeStorage(STORAGE_KEYS.negativePrompt, negativePrompt);
    } catch {
      // noop
    }
  }, [negativePrompt, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    try {
      writeStorage(STORAGE_KEYS.memberTier, memberTier);
    } catch {
      // noop
    }
  }, [memberTier, hydratedForScope, storageScope, writeStorage]);

  const durationRef = useRef<HTMLElement | null>(null);
  const resolutionRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const [inputAssets, setInputAssets] = useState<Record<string, (ReferenceAsset | null)[]>>({});
  const [assetPickerTarget, setAssetPickerTarget] = useState<{ field: EngineInputField; slotIndex?: number } | null>(null);
  const [assetLibrary, setAssetLibrary] = useState<UserAsset[]>([]);
  const [isAssetLibraryLoading, setIsAssetLibraryLoading] = useState(false);
  const [assetLibraryError, setAssetLibraryError] = useState<string | null>(null);
  const [assetLibraryLoaded, setAssetLibraryLoaded] = useState(false);
  const [assetLibrarySource, setAssetLibrarySource] = useState<AssetLibrarySource>('all');
  const [assetLibraryLoadedSource, setAssetLibraryLoadedSource] = useState<AssetLibrarySource | null>(null);
  const [assetDeletePendingId, setAssetDeletePendingId] = useState<string | null>(null);

  const assetsRef = useRef<Record<string, (ReferenceAsset | null)[]>>({});

const revokeAssetPreview = (asset: ReferenceAsset | null | undefined) => {
  if (!asset) return;
  if (asset.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(asset.previewUrl);
  }
};

useEffect(() => {
  assetsRef.current = inputAssets;
}, [inputAssets]);

useEffect(() => {
  return () => {
    Object.values(assetsRef.current).forEach((entries) => {
      entries.forEach((asset) => {
        revokeAssetPreview(asset);
      });
    });
  };
}, []);

const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimeoutRef.current = null;
    }, 6000);
  }, []);

  const fetchAssetLibrary = useCallback(async (sourceOverride?: AssetLibrarySource) => {
    const source = sourceOverride ?? assetLibrarySource;
    setIsAssetLibraryLoading(true);
    setAssetLibraryError(null);
    try {
      const url =
        source === 'all'
          ? '/api/user-assets?limit=60'
          : `/api/user-assets?limit=60&source=${encodeURIComponent(source)}`;
      const response = await authFetch(url);
      if (response.status === 401) {
        setAssetLibrary([]);
        setAssetLibraryError('Sign in to access your image library.');
        return;
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load images';
        throw new Error(message);
      }
      const assets = Array.isArray(payload.assets)
        ? (payload.assets as UserAsset[]).map((asset) => ({
            id: asset.id,
            url: asset.url,
            width: asset.width ?? null,
            height: asset.height ?? null,
            size: asset.size ?? null,
            mime: asset.mime ?? null,
            createdAt: asset.createdAt,
          }))
        : [];
      const filtered = assets.filter((asset) => !asset.mime || asset.mime.startsWith('image/'));
      setAssetLibrary(filtered);
      setAssetLibraryLoaded(true);
      setAssetLibraryLoadedSource(source);
    } catch (error) {
      console.error('[assets] failed to load library', error);
      setAssetLibraryError(error instanceof Error ? error.message : 'Failed to load images');
    } finally {
      setIsAssetLibraryLoading(false);
    }
  }, [assetLibrarySource]);

  const handleDeleteLibraryAsset = useCallback(
    async (asset: UserAsset) => {
      if (!asset?.id) return;
      setAssetDeletePendingId(asset.id);
      try {
        const response = await authFetch('/api/user-assets', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: asset.id }),
        });
        const payload = await response.json().catch(() => null);
        const success = response.ok && Boolean(payload?.ok);
        const notFound = response.status === 404 || payload?.error === 'NOT_FOUND';
        if (!success && !notFound) {
          const message = typeof payload?.error === 'string' ? payload.error : 'Failed to delete image';
          throw new Error(message);
        }

        setAssetLibrary((previous) => previous.filter((entry) => entry.id !== asset.id));
        setInputAssets((previous) => {
          let changed = false;
          const next: typeof previous = {};
          for (const [fieldId, entries] of Object.entries(previous)) {
            let fieldChanged = false;
            const updated = entries.map((entry) => {
              if (entry && entry.assetId === asset.id) {
                fieldChanged = true;
                changed = true;
                if (entry.previewUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(entry.previewUrl);
                }
                return null;
              }
              return entry;
            });
            next[fieldId] = fieldChanged ? updated : entries;
          }
          return changed ? next : previous;
        });
      } catch (error) {
        console.error('[assets] failed to delete asset', error);
        showNotice(error instanceof Error ? error.message : 'Failed to delete image');
        throw error;
      } finally {
        setAssetDeletePendingId(null);
      }
    },
    [showNotice]
  );

const handleRefreshJob = useCallback(async (jobId: string) => {
    try {
      const status = await getJobStatus(jobId);
      if (status.status === 'failed') {
        throw new Error(status.message ?? 'Provider reported this render as failed.');
      }
      if (status.status !== 'completed' && !status.videoUrl) {
        throw new Error('The provider is still processing this render.');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unable to refresh render status.');
    }
}, []);

  const closeTopUpModal = useCallback(() => {
    setTopUpModal(null);
    setTopUpAmount(1000);
    setTopUpError(null);
  }, []);

  const handleOpenAssetLibrary = useCallback(
    (field: EngineInputField, slotIndex?: number) => {
      setAssetPickerTarget({ field, slotIndex });
      if (!isAssetLibraryLoading && (!assetLibraryLoaded || assetLibraryLoadedSource !== assetLibrarySource)) {
        void fetchAssetLibrary(assetLibrarySource);
      }
    },
    [assetLibraryLoaded, assetLibraryLoadedSource, assetLibrarySource, fetchAssetLibrary, isAssetLibraryLoading]
  );

  const handleSelectLibraryAsset = useCallback(
    (field: EngineInputField, asset: UserAsset, slotIndex?: number) => {
      const newAsset: ReferenceAsset = {
        id: asset.id || `library_${Date.now().toString(36)}`,
        fieldId: field.id,
        previewUrl: asset.url,
        kind: 'image',
        name: asset.url.split('/').pop() ?? 'Image',
        size: asset.size ?? 0,
        type: asset.mime ?? 'image/*',
        url: asset.url,
        width: asset.width ?? null,
        height: asset.height ?? null,
        assetId: asset.id,
        status: 'ready' as const,
      };

      setInputAssets((previous) => {
        const maxCount = field.maxCount ?? 0;
        const current = previous[field.id] ? [...previous[field.id]] : [];

        if (maxCount > 0 && current.length < maxCount) {
          while (current.length < maxCount) {
            current.push(null);
          }
        }

        let targetIndex = typeof slotIndex === 'number' ? slotIndex : -1;
        if (maxCount > 0 && targetIndex >= maxCount) {
          targetIndex = -1;
        }
        if (targetIndex < 0) {
          targetIndex = current.findIndex((entry) => entry === null);
        }
        if (targetIndex < 0) {
          if (maxCount > 0 && current.length >= maxCount) {
            showNotice('Maximum reference image count reached for this engine.');
            return previous;
          }
          current.push(newAsset);
        } else {
          const existing = current[targetIndex];
          if (existing) {
            revokeAssetPreview(existing);
          }
          current[targetIndex] = newAsset;
        }

        return { ...previous, [field.id]: current };
      });

      setAssetPickerTarget(null);
    },
    [showNotice]
  );

  const handleAssetAdd = useCallback(
    (field: EngineInputField, file: File, slotIndex?: number) => {
      const assetId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);
      const baseAsset: ReferenceAsset = {
        id: assetId,
        fieldId: field.id,
        previewUrl,
        kind: field.type === 'video' ? 'video' : 'image',
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading' as const,
      };

      setInputAssets((previous) => {
        const maxCount = field.maxCount ?? 0;
        const current = previous[field.id] ? [...previous[field.id]] : [];

        if (maxCount > 0 && current.length < maxCount) {
          while (current.length < maxCount) {
            current.push(null);
          }
        }

        let targetIndex = typeof slotIndex === 'number' ? slotIndex : -1;
        if (maxCount > 0 && targetIndex >= maxCount) {
          targetIndex = -1;
        }
        if (targetIndex < 0) {
          targetIndex = current.findIndex((asset) => asset === null);
        }
        if (targetIndex < 0) {
          if (maxCount > 0 && current.length >= maxCount) {
            revokeAssetPreview(baseAsset);
            return previous;
          }
          current.push(baseAsset);
        } else {
          const existing = current[targetIndex];
          if (existing) {
            revokeAssetPreview(existing);
          }
          current[targetIndex] = baseAsset;
        }

        return { ...previous, [field.id]: current };
      });

      const upload = async () => {
        try {
          const formData = new FormData();
          formData.append('file', file, file.name);
          const uploadEndpoint = field.type === 'video' ? '/api/uploads/video' : '/api/uploads/image';
          const response = await authFetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.ok) {
            throw new Error(typeof payload?.error === 'string' ? payload.error : 'UPLOAD_FAILED');
          }
          const assetResponse = payload.asset as {
            id: string;
            url: string;
            width?: number | null;
            height?: number | null;
            size?: number;
            mime?: string;
            name?: string;
          };
          setInputAssets((previous) => {
            const current = previous[field.id];
            if (!current) return previous;
            const next = current.map((entry) => {
              if (!entry || entry.id !== assetId) return entry;
              return {
                ...entry,
                status: 'ready' as const,
                url: assetResponse.url,
                width: assetResponse.width ?? entry.width,
                height: assetResponse.height ?? entry.height,
                size: assetResponse.size ?? entry.size,
                type: assetResponse.mime ?? entry.type,
                assetId: assetResponse.id,
              };
            });
            return { ...previous, [field.id]: next };
          });
        } catch (error) {
          console.error('[assets] upload failed', error);
          setInputAssets((previous) => {
            const current = previous[field.id];
            if (!current) return previous;
            const next = current.map((entry) => {
              if (!entry || entry.id !== assetId) return entry;
              return {
                ...entry,
                status: 'error' as const,
                error: error instanceof Error ? error.message : 'Upload failed',
              };
            });
            return { ...previous, [field.id]: next };
          });
          showNotice?.('Upload failed. Please try again.');
        }
      };

      void upload();
    },
    [showNotice]
  );

  const handleAssetRemove = useCallback((field: EngineInputField, index: number) => {
    setInputAssets((previous) => {
      const current = previous[field.id];
      if (index < 0 || index >= current.length) return previous;
      const nextList = [...current];
      const toRelease = nextList[index];
      if (toRelease) {
        revokeAssetPreview(toRelease);
      }

      const maxCount = field.maxCount ?? 0;
      if (maxCount > 0) {
        nextList[index] = null;
      } else {
        nextList.splice(index, 1);
      }

      const nextState = { ...previous };
      const hasValues = nextList.some((asset) => asset !== null);

      if (hasValues || (maxCount > 0 && nextList.length)) {
        nextState[field.id] = nextList;
      } else {
        delete nextState[field.id];
      }

      return nextState;
    });
  }, []);

  const handleSelectPresetAmount = useCallback((value: number) => {
    setTopUpAmount(value);
  }, []);

  const handleCustomAmountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) {
      setTopUpAmount(1000);
      return;
    }
    setTopUpAmount(Math.max(1000, Math.round(value * 100)));
  }, []);

  const handleConfirmTopUp = useCallback(async () => {
    if (!topUpModal) return;
    const amountCents = Math.max(1000, topUpAmount);
    setIsTopUpLoading(true);
    setTopUpError(null);
    try {
      const res = await authFetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? 'Wallet top-up failed');
      }
      if (json?.url) {
        window.location.href = json.url as string;
        return;
      }
      closeTopUpModal();
      showNotice('Top-up initiated. Complete the payment to update your balance.');
    } catch (error) {
      setTopUpError(error instanceof Error ? error.message : 'Failed to start top-up');
    } finally {
      setIsTopUpLoading(false);
    }
  }, [topUpAmount, topUpModal, closeTopUpModal, showNotice]);

  const handleTopUpSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleConfirmTopUp();
    },
    [handleConfirmTopUp]
  );

  useEffect(() => {
    if (!authChecked) return undefined;
    let mounted = true;
    (async () => {
      try {
        const res = await authFetch('/api/member-status');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) {
          const tier = (json?.tier ?? 'Member') as 'Member' | 'Plus' | 'Pro';
          setMemberTier(tier);
        }
      } catch {
        // noop
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authChecked]);

  useEffect(() => {
    if (!authChecked || skipOnboardingRef.current) return undefined;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[app] onboarding check running', { skip: skipOnboardingRef.current });
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/user/exports/summary');
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.ok) return;
        if (cancelled) return;
        if ((json.total ?? 0) === 0 && json.onboardingDone !== true) {
          const params: Record<string, string> = { tab: 'starter', first: '1' };
          const search = new URLSearchParams(params).toString();
          router.replace(`/gallery?${search}`);
          await authFetch('/api/user/preferences', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ onboardingDone: true }),
          }).catch(() => undefined);
        }
      } catch (error) {
        console.warn('[app] onboarding redirect failed', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authChecked, router]);

  useEffect(() => {
    if (!fromVideoId) return undefined;
    let cancelled = false;
    (async () => {
      let shouldStripParam = false;
      try {
        const res = await authFetch(`/api/videos/${encodeURIComponent(fromVideoId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.ok || !json.video || cancelled) return;
        const video = json.video as SharedVideoPayload;
        const overrideGroup = mapSharedVideoToGroup(video, provider);
        setCompositeOverride(overrideGroup);
        setCompositeOverrideSummary(null);
        setSharedPrompt(video.prompt ?? video.promptExcerpt ?? null);
        setSelectedPreview({
          id: video.id,
          videoUrl: video.videoUrl ?? undefined,
          thumbUrl: video.thumbUrl ?? undefined,
          aspectRatio: video.aspectRatio ?? undefined,
          prompt: video.prompt ?? video.promptExcerpt ?? undefined,
        });
        shouldStripParam = true;
      } catch (error) {
        console.warn('[app] failed to load shared video', error);
      } finally {
        if (cancelled) return;
        if (shouldStripParam && searchString.includes('from=')) {
          const params = new URLSearchParams(searchString);
          params.delete('from');
          const next = params.toString();
          router.replace(next ? `/app?${next}` : '/app');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromVideoId, provider, router, searchString]);

  useEffect(() => {
    if (!compositeOverride) {
      setSharedPrompt(null);
    }
  }, [compositeOverride]);

  useEffect(() => {
    if (!topUpModal) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTopUpModal();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [topUpModal, closeTopUpModal]);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedPreview || renders.length > 0) return;
    if (hasStoredFormRef.current) return;
    const storedPreviewJobId = (readScopedStorage(STORAGE_KEYS.previewJobId) ?? '').trim();
    if (storedPreviewJobId.startsWith('job_')) return;
    const latestJobWithMedia = recentJobs.find((job) => job.thumbUrl || job.videoUrl);
    if (!latestJobWithMedia) return;
    setSelectedPreview({
      id: latestJobWithMedia.jobId,
      videoUrl: latestJobWithMedia.videoUrl ?? undefined,
      aspectRatio: latestJobWithMedia.aspectRatio ?? undefined,
      thumbUrl: latestJobWithMedia.thumbUrl ?? undefined,
      priceCents: latestJobWithMedia.finalPriceCents ?? latestJobWithMedia.pricingSnapshot?.totalCents,
      currency: latestJobWithMedia.currency ?? latestJobWithMedia.pricingSnapshot?.currency,
      prompt: latestJobWithMedia.prompt ?? undefined,
    });
  }, [readScopedStorage, recentJobs, renders.length, selectedPreview]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authChecked) return;
    if (!engines.length) return;
    if (hydratedForScope !== storageScope) return;
    if (requestedJobId) return;
    if (fromVideoId) return;
    if (renders.length > 0) return;
    if (compositeOverride) return;
    if (compositeOverrideSummary) return;

    const storedJobId = (readScopedStorage(STORAGE_KEYS.previewJobId) ?? '').trim();
    if (!storedJobId.startsWith('job_')) return;
    if (restoredPreviewJobRef.current === storedJobId) return;
    restoredPreviewJobRef.current = storedJobId;

    void authFetch(`/api/jobs/${encodeURIComponent(storedJobId)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              error?: string;
              status?: string;
              progress?: number;
              videoUrl?: string;
              thumbUrl?: string;
              aspectRatio?: string;
              finalPriceCents?: number;
              currency?: string;
              pricing?: { totalCents?: number; currency?: string } | null;
              settingsSnapshot?: unknown;
              createdAt?: string;
            }
          | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? `Failed to load job (${response.status})`);
        }

        const snapshot = payload.settingsSnapshot as
          | {
              schemaVersion?: unknown;
              surface?: unknown;
              engineId?: unknown;
              engineLabel?: unknown;
              prompt?: unknown;
              core?: unknown;
            }
          | null
          | undefined;
        if (snapshot?.schemaVersion !== 1 || snapshot?.surface !== 'video') {
          throw new Error('Invalid settings snapshot for preview');
        }

        applyVideoSettingsSnapshotRef.current(snapshot);

        const core = snapshot.core && typeof snapshot.core === 'object' ? (snapshot.core as Record<string, unknown>) : {};
        const durationSec = typeof core.durationSec === 'number' && Number.isFinite(core.durationSec) ? core.durationSec : undefined;
        const engineId = typeof snapshot.engineId === 'string' ? snapshot.engineId : 'unknown-engine';
        const engineLabel = typeof snapshot.engineLabel === 'string' ? snapshot.engineLabel : engineId;
        const promptValue = typeof snapshot.prompt === 'string' ? snapshot.prompt : '';
        const thumbUrl = typeof payload.thumbUrl === 'string' && payload.thumbUrl.length ? payload.thumbUrl : undefined;
        const videoUrl = typeof payload.videoUrl === 'string' && payload.videoUrl.length ? payload.videoUrl : undefined;
        const url = videoUrl ?? thumbUrl;
        if (!url) {
          throw new Error('Job has no preview media');
        }
        const createdAt =
          typeof payload.createdAt === 'string' && payload.createdAt.length ? payload.createdAt : new Date().toISOString();

        setCompositeOverride(
          mapSharedVideoToGroup(
            {
              id: storedJobId,
              engineId,
              engineLabel,
              durationSec: durationSec ?? 0,
              prompt: promptValue,
              thumbUrl,
              videoUrl,
              aspectRatio: payload.aspectRatio ?? undefined,
              createdAt,
            },
            provider
          )
        );
        setCompositeOverrideSummary(null);
        setSelectedPreview({
          id: storedJobId,
          videoUrl,
          thumbUrl,
          aspectRatio: payload.aspectRatio ?? undefined,
          progress: typeof payload.progress === 'number' ? payload.progress : undefined,
          status:
            payload.status === 'failed' ? 'failed' : payload.status === 'completed' ? 'completed' : ('pending' as const),
          priceCents: payload.finalPriceCents ?? payload.pricing?.totalCents ?? undefined,
          currency: payload.currency ?? payload.pricing?.currency ?? undefined,
          prompt: promptValue,
        });
      })
      .catch(() => {
        // ignore preview restore failures
      });
  }, [
    authChecked,
    engines.length,
    compositeOverride,
    compositeOverrideSummary,
    fromVideoId,
    hydratedForScope,
    readScopedStorage,
    renders.length,
    requestedJobId,
    storageScope,
    provider,
  ]);

  const focusComposer = useCallback(() => {
    if (!composerRef.current) return;
    composerRef.current.focus({ preventScroll: true });
  }, []);

  const engineOverride = useMemo<EngineCaps | null>(() => {
    if (!requestedEngineToken) return null;
    if (!engines.length) return null;
    if (hasStoredFormRef.current) return null;
    return (
      engines.find((engine) => matchesEngineToken(engine, requestedEngineToken)) ?? null
    );
  }, [engines, requestedEngineToken]);

  const selectedEngine = useMemo<EngineCaps | null>(() => {
    if (!engines.length) return null;
    if (engineOverride) return engineOverride;
    if (form && engines.some((engine) => engine.id === form.engineId)) {
      return engines.find((engine) => engine.id === form.engineId) ?? engines[0];
    }
    return engines[0];
  }, [engines, form, engineOverride]);

  useEffect(() => {
    if (form?.engineId === 'pika-image-to-video') {
      setForm((current) => {
        if (!current || current.engineId !== 'pika-image-to-video') return current;
        return { ...current, engineId: 'pika-text-to-video' };
      });
    }
  }, [form?.engineId, setForm]);

  const engineModeOptions = useMemo<Mode[] | undefined>(() => {
    if (!selectedEngine) return undefined;
    const preferredOrder: Mode[] = ['t2v', 'i2v', 'r2v', 'i2i'];
    const available = preferredOrder.filter((value) => selectedEngine.modes.includes(value));
    return available.length ? available : undefined;
  }, [selectedEngine]);

  const engineMap = useMemo(() => {
    const map = new Map<string, EngineCaps>();
    engines.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return map;
  }, [engines]);

  const applyVideoSettingsSnapshot = useCallback(
    (snapshot: unknown) => {
      try {
        if (!snapshot || typeof snapshot !== 'object') {
          throw new Error('Settings snapshot missing');
        }
        const record = snapshot as {
          schemaVersion?: unknown;
          surface?: unknown;
          engineId?: unknown;
          inputMode?: unknown;
          prompt?: unknown;
          negativePrompt?: unknown;
          core?: unknown;
          advanced?: unknown;
          refs?: unknown;
          meta?: unknown;
        };
        if (record.schemaVersion !== 1) {
          throw new Error('Unsupported snapshot version');
        }
        if (record.surface !== 'video') {
          throw new Error('This snapshot is not for video');
        }

        const snapshotEngineId = typeof record.engineId === 'string' ? record.engineId : null;
        const snapshotToken = snapshotEngineId ? normalizeEngineToken(snapshotEngineId) : null;
        const engine =
          (snapshotEngineId ? engineMap.get(snapshotEngineId) : null) ??
          (snapshotToken ? engines.find((candidate) => matchesEngineToken(candidate, snapshotToken)) : null) ??
          engines[0] ??
          null;
        if (!engine) {
          throw new Error('No engines available to apply this snapshot');
        }
        const snapshotModeRaw = typeof record.inputMode === 'string' ? record.inputMode : '';
        const snapshotMode: Mode =
          snapshotModeRaw === 't2v' || snapshotModeRaw === 'i2v' || snapshotModeRaw === 't2i' || snapshotModeRaw === 'i2i'
            ? (snapshotModeRaw as Mode)
            : (engine.modes[0] ?? 't2v');
        const mode = engine.modes.includes(snapshotMode) ? snapshotMode : (engine.modes[0] ?? 't2v');

        const promptValue = typeof record.prompt === 'string' ? record.prompt : '';
        const negativePromptValue = typeof record.negativePrompt === 'string' ? record.negativePrompt : '';
        setPrompt(promptValue);
        setNegativePrompt(negativePromptValue);

        const meta = record.meta && typeof record.meta === 'object' ? (record.meta as Record<string, unknown>) : {};
        const tier = typeof meta.memberTier === 'string' ? meta.memberTier : null;
        if (tier === 'Member' || tier === 'Plus' || tier === 'Pro') {
          setMemberTier(tier);
        }

        const core = record.core && typeof record.core === 'object' ? (record.core as Record<string, unknown>) : {};
        const durationSec =
          typeof core.durationSec === 'number' && Number.isFinite(core.durationSec) ? core.durationSec : undefined;
        const durationOption =
          typeof core.durationOption === 'number' || typeof core.durationOption === 'string' ? core.durationOption : undefined;
        const numFrames =
          typeof core.numFrames === 'number' && Number.isFinite(core.numFrames) ? Math.trunc(core.numFrames) : undefined;
        const resolution = typeof core.resolution === 'string' ? core.resolution : undefined;
        const aspectRatio = typeof core.aspectRatio === 'string' ? core.aspectRatio : undefined;
        const fps = typeof core.fps === 'number' && Number.isFinite(core.fps) ? Math.trunc(core.fps) : undefined;
        const iterations =
          typeof core.iterationCount === 'number' && Number.isFinite(core.iterationCount)
            ? Math.max(1, Math.min(4, Math.trunc(core.iterationCount)))
            : undefined;
        const audio = typeof core.audio === 'boolean' ? core.audio : undefined;

        const advanced =
          record.advanced && typeof record.advanced === 'object' ? (record.advanced as Record<string, unknown>) : {};
        const cfgScaleValue =
          typeof advanced.cfgScale === 'number' && Number.isFinite(advanced.cfgScale) ? advanced.cfgScale : null;
        if (cfgScaleValue !== null) {
          setCfgScale(cfgScaleValue);
        }
        const loopValue = typeof advanced.loop === 'boolean' ? advanced.loop : undefined;

        setForm((current) => {
          const previous = current ?? null;
          const candidate: FormState = {
            engineId: engine.id,
            mode,
            durationSec: typeof durationSec === 'number' ? durationSec : previous?.durationSec ?? 4,
            durationOption: durationOption ?? previous?.durationOption ?? undefined,
            numFrames: numFrames ?? previous?.numFrames ?? undefined,
            resolution: resolution ?? previous?.resolution ?? (engine.resolutions[0] ?? '1080p'),
            aspectRatio: aspectRatio ?? previous?.aspectRatio ?? (engine.aspectRatios[0] ?? '16:9'),
            fps: fps ?? previous?.fps ?? (engine.fps?.[0] ?? 24),
            iterations: iterations ?? previous?.iterations ?? 1,
            seedLocked: previous?.seedLocked ?? false,
            loop: typeof loopValue === 'boolean' ? loopValue : previous?.loop,
            audio: typeof audio === 'boolean' ? audio : previous?.audio ?? resolveAudioDefault(engine, mode),
          };
          return coerceFormState(engine, mode, candidate);
        });

        const refs = record.refs && typeof record.refs === 'object' ? (record.refs as Record<string, unknown>) : {};
        const inputsRaw = refs.inputs;
        if (inputsRaw === null || Array.isArray(inputsRaw)) {
          setInputAssets((previous) => {
            Object.values(previous).forEach((entries) => {
              entries.forEach((asset) => revokeAssetPreview(asset));
            });
            const next: Record<string, (ReferenceAsset | null)[]> = {};
            if (Array.isArray(inputsRaw)) {
              inputsRaw.forEach((entry, index) => {
                if (!entry || typeof entry !== 'object') return;
                const attachment = entry as Record<string, unknown>;
                const slotId = typeof attachment.slotId === 'string' ? attachment.slotId : '';
                const url = typeof attachment.url === 'string' ? attachment.url : '';
                if (!slotId || !url) return;
                const kind = attachment.kind === 'video' ? 'video' : 'image';
                const name = typeof attachment.name === 'string' ? attachment.name : `${kind}-${index + 1}`;
                const type =
                  typeof attachment.type === 'string' ? attachment.type : kind === 'image' ? 'image/*' : 'video/*';
                const size =
                  typeof attachment.size === 'number' && Number.isFinite(attachment.size) ? attachment.size : 0;
                const width =
                  typeof attachment.width === 'number' && Number.isFinite(attachment.width) ? attachment.width : null;
                const height =
                  typeof attachment.height === 'number' && Number.isFinite(attachment.height) ? attachment.height : null;
                const assetId = typeof attachment.assetId === 'string' ? attachment.assetId : undefined;
                const refAsset: ReferenceAsset = {
                  id: assetId ?? `snapshot-${index}`,
                  fieldId: slotId,
                  previewUrl: url,
                  kind,
                  name,
                  size,
                  type,
                  url,
                  width,
                  height,
                  assetId,
                  status: 'ready',
                };
                next[slotId] = [...(next[slotId] ?? []), refAsset];
              });
            }
            return next;
          });
        }

        queueMicrotask(() => {
          focusComposer();
        });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Failed to apply settings.');
      }
    },
    [engineMap, engines, focusComposer]
  );

  useEffect(() => {
    applyVideoSettingsSnapshotRef.current = applyVideoSettingsSnapshot;
  }, [applyVideoSettingsSnapshot]);

  const hydrateVideoSettingsFromJob = useCallback(
    async (jobId: string | null | undefined) => {
      if (!jobId) return;
      try {
        const response = await authFetch(`/api/jobs/${encodeURIComponent(jobId)}`);
        if (!response.ok) {
          if (response.status === 404) return;
          return;
        }
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; settingsSnapshot?: unknown }
          | null;
        if (!payload?.ok || !payload.settingsSnapshot) return;
        applyVideoSettingsSnapshot(payload.settingsSnapshot);
      } catch {
        // ignore best-effort recalls from gallery
      }
    },
    [applyVideoSettingsSnapshot]
  );

  const applyVideoSettingsFromTile = useCallback(
    (tile: QuadPreviewTile) => {
      try {
        applyVideoSettingsSnapshot({
          schemaVersion: 1,
          surface: 'video',
          engineId: tile.engineId,
          inputMode: 't2v',
          prompt: tile.prompt,
          negativePrompt: null,
          core: {
            durationSec: tile.durationSec,
            durationOption: null,
            numFrames: null,
            aspectRatio: tile.aspectRatio,
            resolution: null,
            fps: null,
            iterationCount: tile.iterationCount,
            audio: typeof tile.hasAudio === 'boolean' ? tile.hasAudio : null,
          },
          advanced: { cfgScale: null, loop: null },
          refs: { imageUrl: null, referenceImages: null, firstFrameUrl: null, lastFrameUrl: null, inputs: null },
          meta: { derived: true },
        });
      } catch {
        // ignore
      }
    },
    [applyVideoSettingsSnapshot]
  );

  useEffect(() => {
    if (!requestedJobId) return;
    if (!engines.length) return;
    if (hydratedJobRef.current === requestedJobId) return;
    hydratedJobRef.current = requestedJobId;
    setNotice(null);
    void authFetch(`/api/jobs/${encodeURIComponent(requestedJobId)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              error?: string;
              settingsSnapshot?: unknown;
              videoUrl?: string;
              thumbUrl?: string;
              aspectRatio?: string;
              progress?: number;
              status?: string;
              pricing?: { totalCents?: number; currency?: string } | null;
              finalPriceCents?: number;
              currency?: string;
              createdAt?: string;
            }
          | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? `Failed to load job (${response.status})`);
        }
        applyVideoSettingsSnapshot(payload.settingsSnapshot);

        try {
          if (requestedJobId.startsWith('job_')) {
            writeScopedStorage(STORAGE_KEYS.previewJobId, requestedJobId);
          }
        } catch {
          // ignore storage failures
        }

        const snapshot = payload.settingsSnapshot as
          | {
              schemaVersion?: unknown;
              surface?: unknown;
              engineId?: unknown;
              engineLabel?: unknown;
              prompt?: unknown;
              core?: unknown;
            }
          | null
          | undefined;
        if (snapshot?.schemaVersion === 1 && snapshot?.surface === 'video') {
          const core = snapshot.core && typeof snapshot.core === 'object' ? (snapshot.core as Record<string, unknown>) : {};
          const durationSec = typeof core.durationSec === 'number' && Number.isFinite(core.durationSec) ? core.durationSec : 0;
          const engineId = typeof snapshot.engineId === 'string' ? snapshot.engineId : 'unknown-engine';
          const engineLabel = typeof snapshot.engineLabel === 'string' ? snapshot.engineLabel : engineId;
          const promptValue = typeof snapshot.prompt === 'string' ? snapshot.prompt : '';
          const thumbUrl = typeof payload.thumbUrl === 'string' && payload.thumbUrl.length ? payload.thumbUrl : undefined;
          const videoUrl = typeof payload.videoUrl === 'string' && payload.videoUrl.length ? payload.videoUrl : undefined;
          if (thumbUrl || videoUrl) {
            setCompositeOverride(
              mapSharedVideoToGroup(
                {
                  id: requestedJobId,
                  engineId,
                  engineLabel,
                  durationSec,
                  prompt: promptValue,
                  thumbUrl,
                  videoUrl,
                  aspectRatio: payload.aspectRatio ?? undefined,
                  createdAt:
                    typeof payload.createdAt === 'string' && payload.createdAt.length
                      ? payload.createdAt
                      : new Date().toISOString(),
                },
                provider
              )
            );
            setCompositeOverrideSummary(null);
            setSelectedPreview({
              id: requestedJobId,
              videoUrl,
              thumbUrl,
              aspectRatio: payload.aspectRatio ?? undefined,
              progress: typeof payload.progress === 'number' ? payload.progress : undefined,
              status:
                payload.status === 'failed'
                  ? 'failed'
                  : payload.status === 'completed'
                    ? 'completed'
                    : ('pending' as const),
              priceCents: payload.finalPriceCents ?? payload.pricing?.totalCents ?? undefined,
              currency: payload.currency ?? payload.pricing?.currency ?? undefined,
              prompt: promptValue,
            });
          }
        }
      })
      .catch((error) => {
        setNotice(error instanceof Error ? error.message : 'Failed to load job settings.');
      });
  }, [applyVideoSettingsSnapshot, engines.length, provider, requestedJobId, writeScopedStorage]);

  const activeMode: Mode = form?.mode ?? (selectedEngine?.modes[0] ?? 't2v');

  const capability = useMemo(() => {
    if (!selectedEngine) return undefined;
    return getEngineCaps(selectedEngine.id, activeMode) ?? undefined;
  }, [selectedEngine, activeMode]);

  const generateAudioField = useMemo(() => {
    if (!selectedEngine) return null;
    return findGenerateAudioField(selectedEngine, activeMode);
  }, [selectedEngine, activeMode]);

  const supportsAudioToggle =
    Boolean(selectedEngine && capability?.audioToggle && generateAudioField && supportsAudioPricingToggle(selectedEngine));

  const handleEngineChange = useCallback(
    (engineId: string) => {
      const nextEngine = engines.find((entry) => entry.id === engineId);
      if (!nextEngine) return;
      setForm((current) => {
        const candidate = current ?? null;
        const nextMode = candidate && nextEngine.modes.includes(candidate.mode) ? candidate.mode : nextEngine.modes[0];
        const normalizedPrevious = candidate ? { ...candidate, engineId: nextEngine.id, mode: nextMode } : null;
        return coerceFormState(nextEngine, nextMode, normalizedPrevious);
      });
    },
    [engines]
  );

  useEffect(() => {
    if (!engineOverride) return;
    if (hasStoredFormRef.current) return;
    setForm((current) => {
      const candidate = current ?? null;
      if (candidate?.engineId === engineOverride.id) return candidate;
      const preferredMode = candidate && engineOverride.modes.includes(candidate.mode) ? candidate.mode : engineOverride.modes[0];
      const normalizedPrevious = candidate ? { ...candidate, engineId: engineOverride.id, mode: preferredMode } : null;
      const nextState = coerceFormState(engineOverride, preferredMode, normalizedPrevious);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[generate] engine override applied', {
          previous: candidate?.engineId,
          next: nextState.engineId,
        });
      }
      queueMicrotask(() => {
        try {
          writeStorage(STORAGE_KEYS.form, JSON.stringify(nextState));
        } catch {
          // noop
        }
      });
      return nextState;
    });
  }, [engineOverride, writeStorage]);

  useEffect(() => {
    if (!requestedEngineToken) return;
    if (!selectedEngine) return;
    if (!matchesEngineToken(selectedEngine, requestedEngineToken)) return;
    if (!searchString.includes('engine=')) return;
    const params = new URLSearchParams(searchString);
    params.delete('engine');
    const next = params.toString();
    router.replace(next ? `/app?${next}` : '/app');
  }, [requestedEngineToken, selectedEngine, searchString, router]);

  const handleModeChange = useCallback(
    (mode: Mode) => {
      if (!selectedEngine) return;
      const nextMode = selectedEngine.modes.includes(mode) ? mode : selectedEngine.modes[0];
      setForm((current) => coerceFormState(selectedEngine, nextMode, current ? { ...current, mode: nextMode } : null));
    },
    [selectedEngine]
  );

  const handleDurationChange = useCallback((raw: number | string) => {
    setForm((current) => {
      if (!current) return current;
      const numeric = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.]/g, ''));
      const durationSec = Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : current.durationSec;
      return {
        ...current,
        durationSec,
        durationOption: raw,
        numFrames: null,
      };
    });
  }, []);

  const handleFramesChange = useCallback((value: number) => {
    setForm((current) => {
      if (!current) return current;
      const safeFrames = Math.max(1, Math.round(value));
      return {
        ...current,
        numFrames: safeFrames,
        durationSec: framesToSeconds(safeFrames),
        durationOption: safeFrames,
      };
    });
  }, []);

  const handleResolutionChange = useCallback(
    (resolution: string) => {
      setForm((current) => {
        if (!current) return current;
        if (!selectedEngine) return current;
        const allowed = capability?.resolution && capability.resolution.length ? capability.resolution : selectedEngine.resolutions;
        if (allowed.length && !allowed.includes(resolution)) {
          const fallback = allowed.includes(current.resolution) ? current.resolution : allowed[0];
          return fallback === current.resolution ? current : { ...current, resolution: fallback };
        }
        if (current.resolution === resolution) return current;
        return { ...current, resolution };
      });
    },
    [capability, selectedEngine]
  );

  const handleAspectRatioChange = useCallback(
    (ratio: string) => {
      setForm((current) => {
        if (!current) return current;
        if (!selectedEngine) return current;
        const allowed =
          capability?.aspectRatio && capability.aspectRatio.length
            ? capability.aspectRatio
            : capability
              ? []
              : selectedEngine.aspectRatios;
        if (allowed.length && !allowed.includes(ratio)) {
          const fallback = allowed.includes(current.aspectRatio) ? current.aspectRatio : allowed[0];
          return fallback === current.aspectRatio ? current : { ...current, aspectRatio: fallback };
        }
        if (current.aspectRatio === ratio) return current;
        return { ...current, aspectRatio: ratio };
      });
    },
    [capability, selectedEngine]
  );

  const handleFpsChange = useCallback((fps: number) => {
    setForm((current) => {
      if (!current) return current;
      if (current.fps === fps) return current;
      return { ...current, fps };
    });
  }, []);

  const resolveAssetFieldRole = (field: EngineInputField, required: boolean): AssetFieldRole => {
    const id = (field.id ?? '').toLowerCase();
    if (id.includes('first_frame') || id.includes('last_frame')) return 'frame';
    if (id.includes('reference')) return 'reference';
    if (id === 'image_url' || id === 'input_image') return 'primary';
    if (required && field.type === 'image') return 'primary';
    if (field.type === 'image') return 'reference';
    return 'generic';
  };

  const inputSchemaSummary = useMemo(() => {
    const schema = selectedEngine?.inputSchema;
    if (!schema) {
      return {
        assetFields: [] as AssetFieldConfig[],
        promptField: undefined as EngineInputField | undefined,
        promptRequired: true,
        negativePromptField: undefined as EngineInputField | undefined,
        negativePromptRequired: false,
      };
    }

    const appliesToMode = (field: EngineInputField) => !field.modes || field.modes.includes(activeMode);
    const isRequired = (field: EngineInputField, origin: 'required' | 'optional') => {
      if (field.requiredInModes) {
        return field.requiredInModes.includes(activeMode);
      }
      return origin === 'required';
    };

    const assetFields: AssetFieldConfig[] = [];
    let promptField: EngineInputField | undefined;
    let promptFieldOrigin: 'required' | 'optional' | undefined;
    let negativePromptField: EngineInputField | undefined;
    let negativePromptOrigin: 'required' | 'optional' | undefined;

    const ingest = (fields: EngineInputField[] | undefined, origin: 'required' | 'optional') => {
      if (!fields) return;
      fields.forEach((field) => {
        if (!appliesToMode(field)) return;
        if (field.type === 'text') {
          const normalizedId = (field.id ?? '').toLowerCase();
          const normalizedIdCompact = normalizedId.replace(/[^a-z0-9]/g, '');
          const normalizedLabel = (field.label ?? '').toLowerCase();
          const normalizedLabelCompact = normalizedLabel.replace(/\s+/g, '');
          const hasNegativePromptCue = (value: string) =>
            value.includes('negativeprompt') ||
            (value.includes('negative') && value.includes('prompt')) ||
            value.includes('negprompt');
          const isNegative =
            normalizedId === 'negative_prompt' ||
            hasNegativePromptCue(normalizedIdCompact) ||
            normalizedLabel.includes('negative prompt') ||
            hasNegativePromptCue(normalizedLabelCompact);
          if (isNegative) {
            if (!negativePromptField) {
              negativePromptField = field;
              negativePromptOrigin = origin;
            }
            return;
          }
          const isPrompt = normalizedId === 'prompt';
          if (!promptField || isPrompt) {
            promptField = field;
            promptFieldOrigin = origin;
          }
          return;
        }
        if (field.type === 'image' || field.type === 'video') {
          const required = isRequired(field, origin);
          const role = resolveAssetFieldRole(field, required);
          assetFields.push({ field, required, role });
        }
      });
    };

    ingest(schema.required, 'required');
    ingest(schema.optional, 'optional');

    const promptRequired = promptField ? isRequired(promptField, promptFieldOrigin ?? 'optional') : true;
    const negativePromptRequired = negativePromptField
      ? isRequired(negativePromptField, negativePromptOrigin ?? 'optional')
      : false;

    return {
      assetFields,
      promptField,
      promptRequired,
      negativePromptField,
      negativePromptRequired,
    };
  }, [selectedEngine, activeMode]);

  useEffect(() => {
    setInputAssets((previous) => {
      if (!inputSchemaSummary.assetFields.length) {
        if (Object.keys(previous).length === 0) return previous;
        Object.values(previous).forEach((entries) => {
          entries.forEach((asset) => revokeAssetPreview(asset));
        });
        return {};
      }
      const allowed = new Set(inputSchemaSummary.assetFields.map((entry) => entry.field.id));
      let changed = false;
      const next: Record<string, (ReferenceAsset | null)[]> = {};
      Object.entries(previous).forEach(([fieldId, items]) => {
        if (allowed.has(fieldId)) {
          next[fieldId] = items;
        } else {
          changed = true;
          items.forEach((asset) => revokeAssetPreview(asset));
        }
      });
      return changed ? next : previous;
    });
  }, [inputSchemaSummary.assetFields]);

  const primaryAssetFieldIds = useMemo(() => {
    const ids = inputSchemaSummary.assetFields
      .filter((entry) => entry.role === 'primary' && typeof entry.field.id === 'string')
      .map((entry) => entry.field.id as string);
    return new Set(ids);
  }, [inputSchemaSummary.assetFields]);

  const referenceAssetFieldIds = useMemo(() => {
    const ids = inputSchemaSummary.assetFields
      .filter((entry) => entry.role === 'reference' && typeof entry.field.id === 'string')
      .map((entry) => entry.field.id as string);
    return new Set(ids);
  }, [inputSchemaSummary.assetFields]);

  const genericImageFieldIds = useMemo(() => {
    const ids = inputSchemaSummary.assetFields
      .filter((entry) => entry.role === 'generic' && entry.field.type === 'image' && typeof entry.field.id === 'string')
      .map((entry) => entry.field.id as string);
    return new Set(ids);
  }, [inputSchemaSummary.assetFields]);

  const frameAssetFieldIds = useMemo(() => {
    const ids = inputSchemaSummary.assetFields
      .filter((entry) => entry.role === 'frame' && typeof entry.field.id === 'string')
      .map((entry) => entry.field.id as string);
    return new Set(ids);
  }, [inputSchemaSummary.assetFields]);

  useEffect(() => {
    if (!selectedEngine) {
      if (cfgScale !== null) {
        setCfgScale(null);
      }
      return;
    }
    const cfgParam = selectedEngine.params?.cfg_scale;
    if (cfgParam) {
      if (cfgScale === null) {
        setCfgScale(cfgParam.default ?? null);
      }
    } else {
      if (cfgScale !== null) {
        setCfgScale(null);
      }
    }
  }, [cfgScale, selectedEngine, form?.mode]);

  const composerAssets = useMemo<Record<string, (ComposerAttachment | null)[]>>(() => {
    const map: Record<string, (ComposerAttachment | null)[]> = {};
    Object.entries(inputAssets).forEach(([fieldId, entries]) => {
      map[fieldId] = entries.map((asset) =>
        asset
          ? {
              kind: asset.kind,
              name: asset.name,
              size: asset.size,
              type: asset.type,
              previewUrl: asset.previewUrl,
              status: asset.status,
              error: asset.error,
            }
          : null
      );
    });
    return map;
  }, [inputAssets]);

  const startRender = useCallback(async () => {
    if (!form || !selectedEngine || !authChecked) return;
    const trimmedPrompt = prompt.trim();
    const trimmedNegativePrompt = negativePrompt.trim();
    const supportsNegativePrompt = Boolean(inputSchemaSummary.negativePromptField);
    const isLumaRay2 = selectedEngine.id === 'lumaRay2';
    const lumaDuration = isLumaRay2
      ? getLumaRay2DurationInfo(form.durationOption ?? form.durationSec)
      : null;
    const lumaResolution = isLumaRay2 ? getLumaRay2ResolutionInfo(form.resolution) : null;
    const lumaAspectOk = !isLumaRay2 || isLumaRay2AspectRatio(form.aspectRatio);

    if (inputSchemaSummary.promptRequired && !trimmedPrompt) {
      showNotice('A prompt is required for this engine and mode.');
      return;
    }

    if (
      supportsNegativePrompt &&
      inputSchemaSummary.negativePromptRequired &&
      !trimmedNegativePrompt
    ) {
      const label = inputSchemaSummary.negativePromptField?.label ?? 'Negative prompt';
      showNotice(`${label} is required before generating.`);
      return;
    }

    const missingAssetField = inputSchemaSummary.assetFields.find(({ field, required }) => {
      if (!required) return false;
      const minCount = field.minCount ?? 1;
      const current = (inputAssets[field.id]?.filter((asset) => asset !== null).length) ?? 0;
      return current < minCount;
    });

    if (missingAssetField) {
      showNotice(`${missingAssetField.field.label} is required before generating.`);
      return;
    }

    if (isLumaRay2 && (!lumaDuration || !lumaResolution || !lumaAspectOk)) {
      showNotice(LUMA_RAY2_ERROR_UNSUPPORTED);
      setPreflightError(LUMA_RAY2_ERROR_UNSUPPORTED);
      return;
    }

    const iterationCount = Math.max(1, form.iterations ?? 1);
    const batchId = `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    if (iterationCount > 1) {
      const totalCents = typeof preflight?.pricing?.totalCents === 'number' ? preflight.pricing.totalCents * iterationCount : undefined;
      emitClientMetric('group_render_initiated', {
        batchId,
        iterations: iterationCount,
        engine: selectedEngine.id,
        total_cents: totalCents ?? null,
        currency: preflight?.pricing?.currency ?? preflight?.currency ?? 'USD',
      });
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    const paymentMode: 'wallet' | 'platform' = token ? 'wallet' : 'platform';
    const currencyCode = preflight?.pricing?.currency ?? preflight?.currency ?? 'USD';

    const presentInsufficientFunds = (shortfallCents?: number) => {
      const normalizedShortfall = typeof shortfallCents === 'number' ? Math.max(0, shortfallCents) : undefined;

      let friendlyNotice: string = workspaceCopy.wallet.insufficient;
      let formattedShortfall: string | undefined;
      if (typeof normalizedShortfall === 'number' && normalizedShortfall > 0) {
        try {
          formattedShortfall = new Intl.NumberFormat(CURRENCY_LOCALE, {
            style: 'currency',
            currency: currencyCode,
          }).format(normalizedShortfall / 100);
          friendlyNotice = workspaceCopy.wallet.insufficientWithAmount.replace('{amount}', formattedShortfall);
        } catch {
          formattedShortfall = `${currencyCode} ${(normalizedShortfall / 100).toFixed(2)}`;
          friendlyNotice = workspaceCopy.wallet.insufficientWithAmount.replace('{amount}', formattedShortfall);
        }
      }

      showNotice(friendlyNotice);
      setTopUpModal({
        message: friendlyNotice,
        amountLabel: formattedShortfall,
        shortfallCents: typeof normalizedShortfall === 'number' ? normalizedShortfall : undefined,
      });
      setPreflightError(friendlyNotice);
    };

    if (paymentMode === 'wallet') {
      const unitCostCents =
        typeof preflight?.pricing?.totalCents === 'number'
          ? preflight.pricing.totalCents
          : typeof preflight?.total === 'number'
            ? preflight.total
            : null;
      if (typeof unitCostCents === 'number' && unitCostCents > 0) {
        const requiredCents = unitCostCents * iterationCount;
        try {
          const res = await authFetch('/api/wallet');
          if (res.ok) {
            const walletJson = await res.json();
            const balanceCents =
              typeof walletJson.balanceCents === 'number'
                ? walletJson.balanceCents
                : typeof walletJson.balance === 'number'
                  ? Math.round(walletJson.balance * 100)
                  : typeof walletJson.balance === 'string'
                    ? Math.round(Number(walletJson.balance) * 100)
                  : undefined;
            if (typeof balanceCents === 'number') {
              const shortfall = requiredCents - balanceCents;
              if (shortfall > 0) {
                presentInsufficientFunds(shortfall);
                return;
              }
            }
          }
        } catch (walletError) {
          console.warn('[startRender] wallet balance check failed', walletError);
        }
      }
    }

    const schema = selectedEngine?.inputSchema;
    const fieldIndex = new Map<string, EngineInputField>();
    if (schema) {
      [...(schema.required ?? []), ...(schema.optional ?? [])].forEach((field) => {
        fieldIndex.set(field.id, field);
      });
    }

    const orderedAttachments: Array<{ field: EngineInputField; asset: ReferenceAsset }> = [];
    inputSchemaSummary.assetFields.forEach(({ field }) => {
      const items = inputAssets[field.id] ?? [];
      items.forEach((asset) => {
        if (!asset) return;
        orderedAttachments.push({ field, asset });
      });
    });

    Object.entries(inputAssets).forEach(([fieldId, items]) => {
      if (orderedAttachments.some((entry) => entry.field.id === fieldId)) return;
      const field = fieldIndex.get(fieldId);
      if (!field) return;
      items.forEach((asset) => {
        if (!asset) return;
        orderedAttachments.push({ field, asset });
      });
    });

    let inputsPayload: Array<{
      name: string;
      type: string;
      size: number;
      kind: 'image' | 'video';
      slotId?: string;
      label?: string;
      url: string;
      width?: number | null;
      height?: number | null;
      assetId?: string;
    }> | undefined;

    if (orderedAttachments.length) {
      const collected: typeof inputsPayload = [];
      for (const { field, asset } of orderedAttachments) {
        if (!asset) continue;
        if (asset.status === 'uploading') {
          showNotice('Please wait for uploads to finish before generating.');
          return;
        }
        if (asset.status === 'error' || !asset.url) {
          showNotice('One of your reference files is unavailable. Remove it and try again.');
          return;
        }
        collected.push({
          name: asset.name,
          type: asset.type || (asset.kind === 'image' ? 'image/*' : 'video/*'),
          size: asset.size,
          kind: asset.kind,
          slotId: field.id,
          label: field.label,
          url: asset.url,
          width: asset.width,
          height: asset.height,
          assetId: asset.assetId,
        });
      }
      if (collected.length) {
        inputsPayload = collected;
      }
    }

    const referenceSlots = referenceAssetFieldIds.size > 0 ? referenceAssetFieldIds : genericImageFieldIds;
    const primaryAttachment =
      inputsPayload?.find(
        (attachment) => typeof attachment.slotId === 'string' && primaryAssetFieldIds.has(attachment.slotId)
      ) ?? null;
    const referenceImageUrls = inputsPayload
      ? inputsPayload
          .filter((attachment) => {
            if (attachment.kind !== 'image' || typeof attachment.url !== 'string') return false;
            const slotId = attachment.slotId;
            if (slotId && primaryAssetFieldIds.has(slotId)) return false;
            if (slotId && frameAssetFieldIds.has(slotId)) return false;
            if (!slotId) return referenceSlots.size === 0;
            if (referenceSlots.size === 0) {
              return !primaryAssetFieldIds.has(slotId);
            }
            return referenceSlots.has(slotId);
          })
          .map((attachment) => attachment.url)
          .filter((url, index, self) => self.indexOf(url) === index)
      : [];
    const referenceVideoUrls = inputsPayload
      ? inputsPayload
          .filter((attachment) => attachment.kind === 'video' && typeof attachment.url === 'string')
          .map((attachment) => attachment.url)
          .filter((url, index, self) => self.indexOf(url) === index)
      : [];

    const primaryImageUrl = primaryAttachment?.url ?? referenceImageUrls[0];

    const allowIndex = defaultAllowIndex ?? true;
    const visibilityPreference: 'public' | 'private' = allowIndex ? 'public' : 'private';

    const runIteration = async (iterationIndex: number) => {
      const isImageDrivenMode = form.mode === 'i2v' || form.mode === 'i2i';
      if (isImageDrivenMode && !primaryImageUrl) {
        const guardMessage = selectedEngine.id.startsWith('sora-2')
          ? 'Ajoutez une image (URL ou fichier) pour lancer Image → Video avec Sora.'
          : 'Add at least one reference image (URL or upload) before running this mode.';
        showNotice(guardMessage);
        return;
      }
      const isVideoDrivenMode = form.mode === 'r2v';
      if (isVideoDrivenMode && referenceVideoUrls.length === 0) {
        showNotice('Add 1–3 reference videos (MP4/MOV) before running Reference → Video.');
        return;
      }
      if (isImageDrivenMode && selectedEngine.id === 'veo-3-1-first-last') {
        const firstFrameAttachment = inputsPayload?.find((attachment) => attachment.slotId === 'first_frame_url');
        const lastFrameAttachment = inputsPayload?.find((attachment) => attachment.slotId === 'last_frame_url');
        if (!firstFrameAttachment || !lastFrameAttachment) {
          showNotice('Upload both a first and last frame before generating with Veo First/Last.');
          return;
        }
        const sameSource =
          firstFrameAttachment.assetId && lastFrameAttachment.assetId
            ? firstFrameAttachment.assetId === lastFrameAttachment.assetId
            : firstFrameAttachment.url === lastFrameAttachment.url;
        if (sameSource) {
          showNotice('First and last frames must be two different images for this engine.');
          return;
        }
      }

      const localKey = `local_${batchId}_${iterationIndex + 1}`;
      const id = localKey;
      const ar = form.aspectRatio;
      const thumb = ar === '9:16'
        ? '/assets/frames/thumb-9x16.svg'
        : ar === '1:1'
          ? '/assets/frames/thumb-1x1.svg'
          : '/assets/frames/thumb-16x9.svg';

      const { seconds: etaSeconds, label: etaLabel } = getRenderEta(selectedEngine, form.durationSec);
      const friendlyMessage =
        iterationCount > 1 ? formatTakeLabel(iterationIndex + 1, iterationCount) : '';
      const startedAt = Date.now();
      const minEtaSeconds = Math.min(Math.max(etaSeconds ?? 4, 0), 8);
      const minDurationMs = Math.max(1200, minEtaSeconds * 1000);
      const minReadyAt = startedAt + minDurationMs;

      let progressMessage = friendlyMessage;
      const totalMs = minDurationMs;
      let progressInterval: number | null = null;
      let progressTimeout: number | null = null;

      const stopProgressTracking = () => {
        if (typeof window === 'undefined') return;
        if (progressInterval !== null) {
          window.clearInterval(progressInterval);
          progressInterval = null;
        }
        if (progressTimeout !== null) {
          window.clearTimeout(progressTimeout);
          progressTimeout = null;
        }
      };

      const startProgressTracking = () => {
        if (typeof window === 'undefined') return;
        if (progressInterval !== null) return;
        progressInterval = window.setInterval(() => {
          const now = Date.now();
          const elapsed = now - startedAt;
          const pct = Math.min(95, Math.round((elapsed / totalMs) * 100));
          setRenders((prev) =>
            prev.map((r) =>
              r.localKey === localKey && !r.videoUrl
                ? {
                    ...r,
                    progress: pct < 5 ? 5 : pct,
                    message: progressMessage,
                  }
                : r
            )
          );
          setSelectedPreview((cur) =>
            cur && cur.localKey === localKey && !cur.videoUrl
              ? { ...cur, progress: pct < 5 ? 5 : pct, message: progressMessage }
              : cur
          );
        }, 400);
        const timeoutMs = Math.max(totalMs * 1.5, totalMs + 15000);
        progressTimeout = window.setTimeout(() => {
          stopProgressTracking();
        }, timeoutMs);
      };

      const initial: LocalRender = {
        localKey,
        batchId,
        iterationIndex,
        iterationCount,
        id,
        engineId: selectedEngine.id,
        engineLabel: selectedEngine.label,
        createdAt: new Date().toISOString(),
        aspectRatio: form.aspectRatio,
        durationSec: form.durationSec,
        prompt,
        progress: 5,
        message: friendlyMessage,
        status: 'pending',
        thumbUrl: thumb,
        readyVideoUrl: undefined,
        priceCents: preflight?.pricing?.totalCents ?? undefined,
        currency: preflight?.pricing?.currency ?? preflight?.currency ?? 'USD',
        pricingSnapshot: preflight?.pricing,
        paymentStatus: 'pending_payment',
        etaSeconds,
        etaLabel,
        startedAt,
        minReadyAt,
        groupId: batchId,
        renderIds: undefined,
        heroRenderId: null,
      };

      setRenders((prev) => [initial, ...prev]);
      setBatchHeroes((prev) => {
        if (prev[batchId]) return prev;
        return { ...prev, [batchId]: localKey };
      });
      setActiveBatchId(batchId);
      setActiveGroupId(batchId);
      if (iterationCount > 1) {
        setViewMode((prev) => (prev === 'quad' ? prev : 'quad'));
      }
      setSelectedPreview({
        id,
        localKey,
        batchId,
        iterationIndex,
        iterationCount,
        aspectRatio: form.aspectRatio,
        thumbUrl: thumb,
        progress: initial.progress,
        message: friendlyMessage,
        priceCents: initial.priceCents,
        currency: initial.currency,
        etaSeconds,
        etaLabel,
        prompt,
        status: initial.status,
      });

      startProgressTracking();

      try {
        const shouldSendAspectRatio = !capability || (capability.aspectRatio?.length ?? 0) > 0;
        const resolvedDurationSeconds = isLumaRay2 && lumaDuration ? lumaDuration.seconds : form.durationSec;
        const durationOptionLabel: LumaRay2DurationLabel | undefined =
          typeof form.durationOption === 'string'
            ? (['5s', '9s'].includes(form.durationOption) ? (form.durationOption as LumaRay2DurationLabel) : undefined)
            : undefined;
        const resolvedDurationLabel =
          isLumaRay2 && lumaDuration
            ? lumaDuration.label
            : toLumaRay2DurationLabel(form.durationSec, durationOptionLabel) ?? durationOptionLabel ?? form.durationSec;
        const resolvedResolution = isLumaRay2 && lumaResolution ? lumaResolution.value : form.resolution;

        const generatePayload = {
          engineId: selectedEngine.id,
          prompt: trimmedPrompt,
          durationSec: resolvedDurationSeconds,
          durationOption: resolvedDurationLabel,
          numFrames: form.numFrames ?? undefined,
          resolution: resolvedResolution,
          fps: form.fps,
          mode: form.mode,
          membershipTier: memberTier,
          payment: { mode: paymentMode },
          cfgScale: typeof cfgScale === 'number' ? cfgScale : undefined,
          ...(selectedEngine.id.startsWith('sora-2')
            ? { variant: selectedEngine.id === 'sora-2-pro' ? 'sora2pro' : 'sora2' }
            : {}),
          ...(shouldSendAspectRatio ? { aspectRatio: form.aspectRatio } : {}),
          ...(supportsNegativePrompt && trimmedNegativePrompt ? { negativePrompt: trimmedNegativePrompt } : {}),
          ...(supportsAudioToggle ? { audio: form.audio } : {}),
          ...(inputsPayload ? { inputs: inputsPayload } : {}),
          ...(primaryImageUrl ? { imageUrl: primaryImageUrl } : {}),
          ...(referenceImageUrls.length ? { referenceImages: referenceImageUrls } : {}),
          idempotencyKey: id,
          batchId,
          groupId: batchId,
          iterationIndex,
          iterationCount,
          localKey,
          message: friendlyMessage,
          etaSeconds,
          etaLabel,
          visibility: visibilityPreference,
          allowIndex,
          indexable: allowIndex,
          ...(isLumaRay2 ? { loop: Boolean(form.loop) } : {}),
        };
        const res = await runGenerate(generatePayload, token ? { token } : undefined);

        const resolvedJobId = res.jobId ?? id;
        const resolvedBatchId = res.batchId ?? batchId;
        const resolvedGroupId = res.groupId ?? batchId;
        const resolvedIterationIndex = res.iterationIndex ?? iterationIndex;
        const resolvedIterationCount = res.iterationCount ?? iterationCount;
        const resolvedThumb = res.thumbUrl ?? thumb;
        const resolvedPriceCents =
          res.pricing?.totalCents ?? preflight?.pricing?.totalCents ?? undefined;
        const resolvedCurrency =
          res.pricing?.currency ?? preflight?.pricing?.currency ?? preflight?.currency ?? 'USD';
        const resolvedEtaSeconds =
          typeof res.etaSeconds === 'number' ? res.etaSeconds : etaSeconds;
        const resolvedEtaLabel = res.etaLabel ?? etaLabel;
        const resolvedMessage = res.message ?? friendlyMessage;
        const resolvedStatus =
          res.status ?? (res.videoUrl ? 'completed' : 'pending');
        const resolvedProgress =
          typeof res.progress === 'number' ? res.progress : res.videoUrl ? 100 : 5;
        const resolvedPricingSnapshot = res.pricing ?? preflight?.pricing;
        const resolvedPaymentStatus = res.paymentStatus ?? 'pending_payment';
        const resolvedRenderIds = res.renderIds ?? undefined;
        const resolvedHeroRenderId = res.heroRenderId ?? null;
        const resolvedVideoUrl = res.videoUrl ?? undefined;

        try {
          if (resolvedJobId.startsWith('job_')) {
            writeScopedStorage(STORAGE_KEYS.previewJobId, resolvedJobId);
          }
        } catch {
          // ignore storage failures
        }

        const now = Date.now();
        const gatingActive = Boolean(resolvedVideoUrl) && now < minReadyAt;
        const clampedProgress = resolvedProgress < 5 ? 5 : resolvedProgress;
        const gatedProgress = gatingActive ? Math.min(clampedProgress, 95) : clampedProgress;

        setRenders((prev) =>
          prev.map((render) =>
            render.localKey === localKey
              ? {
                  ...render,
                  id: resolvedJobId,
                  jobId: resolvedJobId,
                  batchId: resolvedBatchId,
                  groupId: resolvedGroupId,
                  iterationIndex: resolvedIterationIndex,
                  iterationCount: resolvedIterationCount,
                  thumbUrl: resolvedThumb,
                  message: resolvedMessage,
                  progress: gatedProgress,
                  status: gatingActive ? 'pending' : resolvedStatus,
                  priceCents: resolvedPriceCents,
                  currency: resolvedCurrency,
                  pricingSnapshot: resolvedPricingSnapshot,
                  paymentStatus: resolvedPaymentStatus,
                  etaSeconds: resolvedEtaSeconds,
                  etaLabel: resolvedEtaLabel,
                  renderIds: resolvedRenderIds,
                  heroRenderId: resolvedHeroRenderId,
                  readyVideoUrl: resolvedVideoUrl ?? render.readyVideoUrl,
                  videoUrl: gatingActive ? render.videoUrl : resolvedVideoUrl ?? render.videoUrl,
                }
              : render
          )
        );
        progressMessage = resolvedMessage;
        setSelectedPreview((cur) =>
          cur && cur.localKey === localKey
            ? {
                ...cur,
                id: resolvedJobId,
                batchId: resolvedBatchId,
                iterationIndex: resolvedIterationIndex,
                iterationCount: resolvedIterationCount,
                thumbUrl: resolvedThumb,
                progress: gatedProgress,
                message: resolvedMessage,
                priceCents: resolvedPriceCents,
                currency: resolvedCurrency,
                etaSeconds: resolvedEtaSeconds,
                etaLabel: resolvedEtaLabel,
                videoUrl: gatingActive ? cur.videoUrl : resolvedVideoUrl ?? cur.videoUrl,
                status: gatingActive ? 'pending' : resolvedStatus,
              }
            : cur
        );

        if (resolvedIterationCount > 1) {
          setViewMode((prev) => (prev === 'quad' ? prev : 'quad'));
        }
        setActiveBatchId(resolvedBatchId);
        setActiveGroupId(resolvedBatchId ?? batchId ?? id);
        setBatchHeroes((prev) => {
          if (prev[resolvedBatchId]) return prev;
          return { ...prev, [resolvedBatchId]: localKey };
        });

        if (resolvedVideoUrl || resolvedStatus === 'completed') {
          stopProgressTracking();
        }

        if (typeof window !== 'undefined') {
          const detail = {
            ok: true,
            jobId: resolvedJobId,
            status: resolvedStatus ?? 'pending',
            progress: resolvedProgress,
            videoUrl: resolvedVideoUrl ?? null,
            thumbUrl: resolvedThumb ?? null,
            aspectRatio: form.aspectRatio ?? null,
            pricing: resolvedPricingSnapshot,
            finalPriceCents: resolvedPriceCents ?? null,
            currency: resolvedCurrency,
            paymentStatus: resolvedPaymentStatus ?? 'platform',
            batchId: resolvedBatchId ?? null,
            groupId: resolvedGroupId ?? null,
            iterationIndex: resolvedIterationIndex ?? null,
            iterationCount: resolvedIterationCount ?? null,
            renderIds: resolvedRenderIds ?? null,
            heroRenderId: resolvedHeroRenderId ?? null,
            localKey,
            message: resolvedMessage ?? null,
            etaSeconds: resolvedEtaSeconds ?? null,
            etaLabel: resolvedEtaLabel ?? null,
          };
          window.dispatchEvent(new CustomEvent('jobs:status', { detail }));
        }

        void mutateLatestJobs(undefined, { revalidate: true });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('wallet:invalidate'));
        }

        const jobId = resolvedJobId;
        const poll = async () => {
          try {
            const status = await getJobStatus(jobId);
            if (status.message) {
              progressMessage = status.message;
            }
            const target = rendersRef.current.find((r) => r.id === jobId);
            const now = Date.now();
            const minReadyAtCurrent = target?.minReadyAt ?? 0;
            const isCompleted = status.status === 'completed' || Boolean(status.videoUrl);
            if (isCompleted && target && now < minReadyAtCurrent) {
              window.setTimeout(poll, Math.max(500, minReadyAtCurrent - now));
              return;
            }
            const hasVideo = Boolean(status.videoUrl);
            const hasThumb = Boolean(status.thumbUrl);
            setRenders((prev) =>
              prev.map((r) =>
                r.id === jobId
                  ? {
                      ...r,
                      status: status.status ?? r.status,
                      progress: status.progress ?? r.progress,
                      readyVideoUrl: status.videoUrl ?? r.readyVideoUrl,
                      videoUrl: status.videoUrl ?? r.videoUrl ?? r.readyVideoUrl,
                      thumbUrl: status.thumbUrl ?? r.thumbUrl,
                      priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? r.priceCents,
                      currency: status.currency ?? status.pricing?.currency ?? r.currency,
                      pricingSnapshot: status.pricing ?? r.pricingSnapshot,
                      paymentStatus: status.paymentStatus ?? r.paymentStatus,
                    }
                  : r
              )
            );
            setSelectedPreview((cur) =>
              cur && (cur.id === jobId || cur.localKey === localKey)
                ? {
                    ...cur,
                    status: status.status ?? cur.status,
                    id: jobId,
                    localKey,
                    progress: status.progress ?? cur.progress,
                    videoUrl: status.videoUrl ?? target?.readyVideoUrl ?? cur.videoUrl,
                    thumbUrl: status.thumbUrl ?? cur.thumbUrl,
                    priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? cur.priceCents,
                    currency: status.currency ?? status.pricing?.currency ?? cur.currency,
                    etaLabel: cur.etaLabel,
                    etaSeconds: cur.etaSeconds,
                  }
                : cur
            );
            const shouldKeepPolling =
              status.status !== 'failed' &&
              (status.status !== 'completed' || !hasVideo || !hasThumb);
            if (shouldKeepPolling) {
              const delay = status.status === 'completed' && !hasVideo ? 4000 : 2000;
              window.setTimeout(poll, delay);
            }
            if (status.status === 'failed' || (status.status === 'completed' && hasVideo && hasThumb)) {
              stopProgressTracking();
            }
          } catch {
            window.setTimeout(poll, 3000);
          }
        };
        window.setTimeout(poll, 1500);

        if (resolvedVideoUrl) {
          stopProgressTracking();
        }
      } catch (error) {
        stopProgressTracking();
        let fallbackBatchId: string | null = null;
        setRenders((prev) => {
          const next = prev.filter((r) => r.localKey !== localKey);
          fallbackBatchId = next[0]?.batchId ?? null;
          return next;
        });
        setBatchHeroes((prev) => {
          if (!prev[batchId]) return prev;
          const next = { ...prev };
          delete next[batchId];
          return next;
        });
        setActiveBatchId((current) => (current === batchId ? fallbackBatchId : current));
        setActiveGroupId((current) => (current === batchId ? fallbackBatchId : current));
        setSelectedPreview((cur) => (cur && cur.localKey === localKey ? null : cur));
        if (isInsufficientFundsError(error)) {
          const shortfallCents = error.details?.requiredCents;
          presentInsufficientFunds(shortfallCents);
          return;
        }
        if (error && typeof error === 'object' && (error as { error?: string }).error === 'FAL_UNPROCESSABLE_ENTITY') {
          const payload = error as { userMessage?: string; providerMessage?: string; detail?: unknown };
          const userMessage =
            typeof payload.userMessage === 'string'
              ? payload.userMessage
              : 'The provider rejected this reference image. Please try with a different one.';
          const providerMessage =
            typeof payload.providerMessage === 'string'
              ? payload.providerMessage
              : typeof payload.detail === 'string'
                ? payload.detail
                : undefined;
          const composed =
            providerMessage && providerMessage !== userMessage
              ? `${userMessage}\n(${providerMessage})`
              : userMessage;
          showNotice(composed);
          setPreflightError(composed);
          return;
        }
        const enrichedError = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
        const apiMessage =
          typeof enrichedError?.originalMessage === 'string' && enrichedError.originalMessage.trim().length
            ? enrichedError.originalMessage.trim()
            : undefined;
        const fallbackMessage =
          apiMessage ??
          (error instanceof Error && typeof error.message === 'string' && error.message.trim().length
            ? error.message
            : 'Generate failed');
        showNotice(fallbackMessage);
        setPreflightError(fallbackMessage);
      }
    };

    for (let iterationIndex = 0; iterationIndex < iterationCount; iterationIndex += 1) {
      void runIteration(iterationIndex);
    }
  }, [
    form,
    prompt,
    negativePrompt,
    selectedEngine,
    preflight,
    memberTier,
    showNotice,
    writeScopedStorage,
    mutateLatestJobs,
    inputSchemaSummary,
    inputAssets,
    authChecked,
    setActiveGroupId,
    capability,
    defaultAllowIndex,
    workspaceCopy.wallet.insufficient,
    workspaceCopy.wallet.insufficientWithAmount,
    cfgScale,
    formatTakeLabel,
    primaryAssetFieldIds,
    referenceAssetFieldIds,
    genericImageFieldIds,
    frameAssetFieldIds,
    supportsAudioToggle,
  ]);

  useEffect(() => {
    if (!selectedEngine || !authChecked) return;
    setForm((current) => {
      const candidate = current ?? null;
      if (!candidate) return candidate;
      const nextMode = candidate && selectedEngine.modes.includes(candidate.mode) ? candidate.mode : selectedEngine.modes[0];
      const normalizedPrevious = candidate ? { ...candidate, mode: nextMode } : null;
      const nextState = coerceFormState(selectedEngine, nextMode, normalizedPrevious);
      if (candidate) {
        const hasChanged =
          candidate.engineId !== nextState.engineId ||
          candidate.mode !== nextState.mode ||
          candidate.durationSec !== nextState.durationSec ||
          candidate.durationOption !== nextState.durationOption ||
          candidate.numFrames !== nextState.numFrames ||
          candidate.resolution !== nextState.resolution ||
          candidate.aspectRatio !== nextState.aspectRatio ||
          candidate.fps !== nextState.fps ||
          candidate.iterations !== nextState.iterations ||
          candidate.seedLocked !== nextState.seedLocked ||
          candidate.loop !== nextState.loop ||
          candidate.audio !== nextState.audio;
        return hasChanged ? nextState : candidate;
      }
      return nextState;
    });
  }, [selectedEngine, authChecked]);

  useEffect(() => {
    if (!form || !selectedEngine || !authChecked) return;
    let canceled = false;

    const payload: PreflightRequest = {
      engine: form.engineId,
      mode: form.mode,
      durationSec: form.durationSec,
      resolution: form.resolution as PreflightRequest['resolution'],
      aspectRatio: form.aspectRatio as PreflightRequest['aspectRatio'],
      fps: form.fps,
      seedLocked: Boolean(form.seedLocked),
      loop: form.loop,
      ...(supportsAudioToggle ? { audio: form.audio } : {}),
      user: { memberTier },
    };
    setPricing(true);
    setPreflightError(undefined);

    const timeout = setTimeout(() => {
      Promise.resolve()
        .then(() => runPreflight(payload))
        .then((response) => {
          if (canceled) return;
          setPreflight(response);
        })
        .catch((err) => {
          if (canceled) return;
          console.error('[preflight] failed', err);
          setPreflightError(err instanceof Error ? err.message : 'Preflight failed');
        })
        .finally(() => {
          if (!canceled) {
            setPricing(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
  }, [form, selectedEngine, memberTier, authChecked, supportsAudioToggle]);

  const handleQuadTileAction = useCallback(
    (action: QuadTileAction, tile: QuadPreviewTile) => {
      emitClientMetric('tile_action', { action, batchId: tile.batchId, version: tile.iterationIndex + 1 });
      const jobId = tile.jobId ?? tile.id;
      switch (action) {
        case 'continue': {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(jobId);
          setPrompt(tile.prompt);
          focusComposer();
          break;
        }
        case 'refine': {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(jobId);
          setPrompt(`${tile.prompt}\n\n// refine here`);
          focusComposer();
          break;
        }
        case 'branch': {
          showNotice('Branching flow is coming soon in this build.');
          break;
        }
        case 'copy': {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            void navigator.clipboard.writeText(tile.prompt).then(
              () => showNotice('Prompt copied to clipboard'),
              () => showNotice('Unable to copy prompt, please copy manually.')
            );
          } else {
            showNotice('Clipboard not available in this context.');
          }
          break;
        }
        case 'open': {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(jobId);
          setActiveBatchId(tile.batchId);
          setViewMode('quad');
          setSelectedPreview({
            id: tile.id,
            localKey: tile.localKey,
            batchId: tile.batchId,
            iterationIndex: tile.iterationIndex,
            iterationCount: tile.iterationCount,
            videoUrl: tile.videoUrl,
            aspectRatio: tile.aspectRatio,
            thumbUrl: tile.thumbUrl,
            progress: tile.progress,
            message: tile.message,
            priceCents: tile.priceCents,
            currency: tile.currency,
            etaLabel: tile.etaLabel,
            prompt: tile.prompt,
          });
          break;
        }
        default:
          break;
      }
    },
    [applyVideoSettingsFromTile, focusComposer, hydrateVideoSettingsFromJob, setPrompt, showNotice]
  );

  const handleCopySharedPrompt = useCallback(() => {
    const promptValue = sharedPrompt ?? selectedPreview?.prompt ?? null;
    if (!promptValue) {
      showNotice('No prompt available to copy.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(promptValue).then(
        () => showNotice('Prompt copied to clipboard'),
        () => showNotice('Unable to copy prompt, please copy manually.')
      );
    } else {
      showNotice('Clipboard not available in this context.');
    }
  }, [sharedPrompt, selectedPreview, showNotice]);

  const fallbackEngineId = selectedEngine?.id ?? 'unknown-engine';

  const handleGalleryGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      setActiveGroupId(group.id);
      if (action === 'remove') {
        return;
      }
      if (group.source === 'active') {
        const renderGroup = renderGroups.get(group.id);
        if (!renderGroup || renderGroup.items.length === 0) return;
        const preferredHeroKey =
          batchHeroes[group.id] ?? renderGroup.items.find((item) => item.videoUrl)?.localKey ?? renderGroup.items[0]?.localKey;
        const heroRender = preferredHeroKey
          ? renderGroup.items.find((item) => item.localKey === preferredHeroKey) ?? renderGroup.items[0]
          : renderGroup.items[0];
        if (!heroRender) return;
        const heroJobId = heroRender.jobId ?? heroRender.id;
        if (action === 'compare') {
          emitClientMetric('compare_used', { batchId: group.id });
          showNotice('Compare view is coming soon.');
          return;
        }
        const tile = buildQuadTileFromRender(heroRender, renderGroup);
        if (action === 'open') {
          handleQuadTileAction('open', tile);
          setCompositeOverride(null);
          setCompositeOverrideSummary(null);
          setSharedPrompt(null);
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(heroJobId);
          return;
        }
        if (action === 'continue') {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(heroJobId);
          handleQuadTileAction('continue', tile);
          return;
        }
        if (action === 'refine') {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(heroJobId);
          handleQuadTileAction('refine', tile);
          return;
        }
        if (action === 'branch') {
          handleQuadTileAction('branch', tile);
        }
        return;
      }

      const hero = group.hero;
      const memberToTile = (member: GroupMemberSummary): QuadPreviewTile => ({
        localKey: member.localKey ?? member.id,
        batchId: member.batchId ?? group.id,
        id: member.jobId ?? member.id,
        jobId: member.jobId ?? undefined,
        iterationIndex: member.iterationIndex ?? 0,
        iterationCount: member.iterationCount ?? group.count,
        videoUrl: member.videoUrl ?? undefined,
        thumbUrl: member.thumbUrl ?? undefined,
        aspectRatio: member.aspectRatio ?? '16:9',
        progress: typeof member.progress === 'number' ? member.progress : member.status === 'completed' ? 100 : 0,
        message: member.message ?? '',
        priceCents: member.priceCents ?? undefined,
        currency: member.currency ?? undefined,
        durationSec: member.durationSec,
        engineLabel: member.engineLabel,
        engineId: member.engineId ?? fallbackEngineId,
        etaLabel: member.etaLabel ?? undefined,
        prompt: member.prompt ?? '',
        status: member.status ?? 'completed',
        hasAudio: typeof member.job?.hasAudio === 'boolean' ? member.job.hasAudio : undefined,
      });

      if (action === 'compare') {
        emitClientMetric('compare_used', { batchId: group.id });
        showNotice('Compare view is coming soon.');
        return;
      }

      if (action === 'branch') {
        showNotice('Branching flow is coming soon in this build.');
        return;
      }

      const tile = memberToTile(hero);
      const heroJobId = hero.jobId ?? tile.id;

      if (action === 'open') {
        const targetBatchId = tile.batchId ?? group.batchId ?? null;
        if (tile.iterationCount > 1) {
          setViewMode('quad');
        } else {
          setViewMode('single');
        }
        if (targetBatchId) {
          setActiveBatchId(targetBatchId);
          if (tile.localKey) {
            setBatchHeroes((prev) => ({ ...prev, [targetBatchId]: tile.localKey! }));
          }
        }
        setSelectedPreview({
          id: tile.id,
          localKey: tile.localKey,
          batchId: tile.batchId,
          iterationIndex: tile.iterationIndex,
          iterationCount: tile.iterationCount,
          videoUrl: tile.videoUrl,
          aspectRatio: tile.aspectRatio,
          thumbUrl: tile.thumbUrl,
          progress: tile.progress,
          message: tile.message,
          priceCents: tile.priceCents,
          currency: tile.currency,
          etaLabel: tile.etaLabel,
          prompt: tile.prompt,
        });
        const normalizedSummary = normalizeGroupSummary(group);
        setCompositeOverride(adaptGroupSummary(normalizedSummary, provider));
        setCompositeOverrideSummary(normalizedSummary);
        try {
          if (heroJobId.startsWith('job_')) {
            writeScopedStorage(STORAGE_KEYS.previewJobId, heroJobId);
          }
        } catch {
          // ignore storage failures
        }
        applyVideoSettingsFromTile(tile);
        void hydrateVideoSettingsFromJob(heroJobId);
        return;
      }

      if (action === 'continue' || action === 'refine') {
        applyVideoSettingsFromTile(tile);
        void hydrateVideoSettingsFromJob(heroJobId);
        handleQuadTileAction(action, tile);
        return;
      }
    },
    [
      renderGroups,
      batchHeroes,
      buildQuadTileFromRender,
      handleQuadTileAction,
      showNotice,
      fallbackEngineId,
      setActiveGroupId,
      setViewMode,
      setActiveBatchId,
      setSelectedPreview,
      provider,
      setCompositeOverride,
      setCompositeOverrideSummary,
      applyVideoSettingsFromTile,
      hydrateVideoSettingsFromJob,
      writeScopedStorage,
    ]
  );

  const openGroupViaGallery = useCallback(
    (group: GroupSummary) => {
      setActiveGroupId(group.id);
      handleGalleryGroupAction(group, 'open');
    },
    [handleGalleryGroupAction, setActiveGroupId]
  );
  const handleActiveGroupOpen = useCallback(
    (group: GroupSummary) => {
      setActiveGroupId(group.id);
      handleGalleryGroupAction(group, 'open');
    },
    [handleGalleryGroupAction, setActiveGroupId]
  );
  const handleActiveGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      if (action === 'remove') return;
      setActiveGroupId(group.id);
      handleGalleryGroupAction(group, action);
    },
    [handleGalleryGroupAction, setActiveGroupId]
  );

  const singlePriceCents = typeof preflight?.total === 'number' ? preflight.total : null;
  const singlePrice =
    typeof singlePriceCents === 'number' ? singlePriceCents / 100 : null;
  const price =
    typeof singlePrice === 'number' && form?.iterations
      ? singlePrice * form.iterations
      : singlePrice;
  const currency = preflight?.currency ?? 'USD';

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-text-secondary">
        Checking session…
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-text-secondary">
        Loading engines…
      </main>
    );
  }

  if (enginesError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-state-warning">
        {workspaceCopy.errors.loadEngines}: {enginesError.message}
      </main>
    );
  }

  if (!selectedEngine || !form) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-text-secondary">
        {workspaceCopy.errors.noEngines}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 flex-col xl:flex-row">
        <div className="flex flex-1">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <main className="flex flex-1 flex-col gap-5 p-5 lg:p-7">
            {notice && (
              <div className="rounded-[12px] border border-[#FACC15]/60 bg-[#FEF3C7] px-4 py-2 text-sm text-[#92400E] shadow-card">
                {notice}
              </div>
            )}
            <div className="grid gap-5 xl:grid-cols-[320px_auto]">
              <div className="contents xl:col-start-1 xl:row-start-1 xl:flex xl:min-w-0 xl:flex-col xl:gap-5 xl:self-start">
                <div className="order-1 xl:order-none">
                  <div className="min-w-0">
                    <EngineSelect
                      engines={engines}
                      engineId={form.engineId}
                      onEngineChange={handleEngineChange}
                      mode={form.mode}
                      onModeChange={handleModeChange}
                      modeOptions={engineModeOptions}
                    />
                  </div>
                </div>
                <div className="order-3 xl:order-none">
                  <div className="min-w-0">
                    <SettingsControls
                      engine={selectedEngine}
                      caps={capability}
                      durationSec={form.durationSec}
                      durationOption={form.durationOption ?? null}
                      onDurationChange={handleDurationChange}
                      numFrames={form.numFrames ?? undefined}
                      onNumFramesChange={handleFramesChange}
                      resolution={form.resolution}
                      onResolutionChange={handleResolutionChange}
                      aspectRatio={form.aspectRatio}
                      onAspectRatioChange={handleAspectRatioChange}
                      fps={form.fps}
                      onFpsChange={handleFpsChange}
                      mode={form.mode}
                      iterations={form.iterations}
                      onIterationsChange={(iterations) =>
                        setForm((current) => {
                          const next = current ? { ...current, iterations } : current;
                          if (iterations <= 1) {
                            setViewMode('single');
                          }
                          return next;
                        })
                      }
                      showAudioControl={supportsAudioToggle}
                      audioEnabled={form.audio}
                      onAudioChange={(audio) => setForm((current) => (current ? { ...current, audio } : current))}
                      showLoopControl={selectedEngine.id === 'lumaRay2'}
                      loopEnabled={selectedEngine.id === 'lumaRay2' ? Boolean(form.loop) : undefined}
                      onLoopChange={(next) =>
                        setForm((current) => (current ? { ...current, loop: next } : current))
                      }
                      showExtendControl={false}
                      seedLocked={form.seedLocked}
                      onSeedLockedChange={(seedLocked) =>
                        setForm((current) => (current ? { ...current, seedLocked } : current))
                      }
                      focusRefs={{
                        duration: durationRef,
                        resolution: resolutionRef,
                      }}
                      cfgScale={cfgScale}
                      onCfgScaleChange={(value) => setCfgScale(value)}
                    />
                    {selectedEngine && (
                      <div className="mt-3 space-y-1 rounded-input border border-border/80 bg-white/80 p-3 text-[12px] text-text-secondary">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-text-primary">{selectedEngine.label}</span>
                          <span className="text-text-muted">• {MODE_DISPLAY_LABEL[form.mode]}</span>
                        </div>
                        {capability?.maxUploadMB && (form.mode === 'i2v' || form.mode === 'r2v') && (
                          <p className="text-[11px] text-text-muted">Max upload: {capability.maxUploadMB} MB</p>
                        )}
                        {capability?.acceptsImageFormats && capability.acceptsImageFormats.length > 0 && form.mode === 'i2v' && (
                          <p className="text-[11px] text-text-muted">
                            Accepted formats: {capability.acceptsImageFormats.map((format) => format.toUpperCase()).join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="order-2 xl:order-none xl:col-start-2 xl:row-start-1 xl:self-start">
                <div className="space-y-5">
                  {showCenterGallery ? (
                    normalizedPendingGroups.length === 0 && !isGenerationLoading ? (
                      <div className="rounded-card border border-border bg-white/80 p-5 text-center text-sm text-text-secondary">
                        {workspaceCopy.gallery.empty}
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
	                        {normalizedPendingGroups.map((group) => {
	                          const engineId = group.hero.engineId;
	                          const engine = engineId ? engineMap.get(engineId) ?? null : null;
	                          return (
	                            <GroupedJobCard
	                              key={group.id}
	                              group={group}
	                              engine={engine ?? undefined}
	                              onOpen={handleActiveGroupOpen}
	                              onAction={handleActiveGroupAction}
                              allowRemove={false}
                            />
                          );
                        })}
                        {isGenerationLoading &&
                          Array.from({ length: normalizedPendingGroups.length ? 0 : generationSkeletonCount }).map((_, index) => (
                            <div key={`workspace-gallery-skeleton-${index}`} className="rounded-card border border-border bg-white/60 p-0" aria-hidden>
                              <div className="relative overflow-hidden rounded-card">
                                <div className="relative" style={{ aspectRatio: '16 / 9' }}>
                                  <div className="skeleton absolute inset-0" />
                                </div>
                              </div>
                              <div className="border-t border-border bg-white/70 px-3 py-2">
                                <div className="h-3 w-24 rounded-full bg-neutral-200" />
                              </div>
                            </div>
                          ))}
                      </div>
                    )
                  ) : null}
                  <CompositePreviewDock
                    group={compositeGroup}
                    isLoading={isGenerationLoading && !compositeGroup}
                    copyPrompt={sharedPrompt}
                    onCopyPrompt={sharedPrompt ? handleCopySharedPrompt : undefined}
                    onOpenModal={(group) => {
                      if (!group) return;
                      if (renderGroups.has(group.id)) {
                        setViewerTarget({ kind: 'pending', id: group.id });
                        return;
                      }
                      if (compositeOverrideSummary && compositeOverrideSummary.id === group.id) {
                        setViewerTarget({ kind: 'summary', summary: compositeOverrideSummary });
                      }
                    }}
                  />
                  <Composer
                    engine={selectedEngine}
                    prompt={prompt}
                    onPromptChange={setPrompt}
                    negativePrompt={negativePrompt}
                    onNegativePromptChange={setNegativePrompt}
                    price={price}
                    currency={currency}
                    isLoading={isPricing}
                    error={preflightError}
                    messages={preflight?.messages}
                    textareaRef={composerRef}
                    onGenerate={startRender}
                    iterations={form.iterations}
                    preflight={preflight}
                    promptField={inputSchemaSummary.promptField}
                    promptRequired={inputSchemaSummary.promptRequired}
                    negativePromptField={inputSchemaSummary.negativePromptField}
                    negativePromptRequired={inputSchemaSummary.negativePromptRequired}
                    assetFields={inputSchemaSummary.assetFields}
                    assets={composerAssets}
                    onAssetAdd={handleAssetAdd}
                    onAssetRemove={handleAssetRemove}
                    onNotice={showNotice}
                    onOpenLibrary={handleOpenAssetLibrary}
                  />
                </div>
              </div>
            </div>
          </main>
        </div>
        {isDesktopLayout && (
          <div className="w-[360px] px-4 py-4">
            <GalleryRail
              engine={selectedEngine}
              activeGroups={normalizedPendingGroups}
              onOpenGroup={openGroupViaGallery}
              onGroupAction={handleGalleryGroupAction}
              variant="desktop"
            />
          </div>
        )}
      </div>
      {!isDesktopLayout && (
        <div className="border-t border-hairline bg-white/70 px-4 py-4">
          <GalleryRail
            engine={selectedEngine}
            activeGroups={normalizedPendingGroups}
            onOpenGroup={openGroupViaGallery}
            onGroupAction={handleGalleryGroupAction}
            variant="mobile"
          />
        </div>
      )}
      </div>
      {viewerGroup ? (
        <GroupViewerModal
          group={viewerGroup}
          onClose={() => setViewerTarget(null)}
          onRefreshJob={handleRefreshJob}
          defaultAllowIndex={defaultAllowIndex}
        />
      ) : null}
      {topUpModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-4">
          <div className="absolute inset-0" role="presentation" onClick={closeTopUpModal} />
          <form
            className="relative z-10 w-full max-w-md rounded-[16px] border border-border bg-white p-6 shadow-2xl"
            onSubmit={handleTopUpSubmit}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-text-primary">Wallet balance too low</h2>
                <p className="mt-2 text-sm text-text-secondary">{topUpModal.message}</p>
                {topUpModal.amountLabel && (
                  <p className="mt-2 text-sm font-medium text-text-primary">
                    Suggested top-up: {topUpModal.amountLabel}
                  </p>
                )}
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{workspaceCopy.topUp.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[1000, 2500, 5000].map((value) => {
                      const formatted = (() => {
                        try {
                          return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(value / 100);
                        } catch {
                          return `${currency} ${(value / 100).toFixed(2)}`;
                        }
                      })();
                      const isActive = topUpAmount === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleSelectPresetAmount(value)}
                          className={clsx(
                            'rounded-input border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isActive
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
                          )}
                        >
                          {formatted}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    <label htmlFor="custom-topup" className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                      {workspaceCopy.topUp.otherAmountLabel}
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-secondary">
                          $
                        </span>
                        <input
                          id="custom-topup"
                          type="number"
                          min={10}
                          step={1}
                          value={Math.max(10, Math.round(topUpAmount / 100))}
                          onChange={handleCustomAmountChange}
                          className="h-10 w-full rounded-input border border-border bg-white pl-6 pr-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      <span className="text-xs text-text-muted">
                        {workspaceCopy.topUp.minLabel.replace('{amount}', '$10')}
                      </span>
                    </div>
                  </div>
                  {topUpError && <p className="mt-2 text-sm text-state-warning">{topUpError}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={closeTopUpModal}
                className="rounded-full border border-hairline bg-white/80 p-2 text-text-muted transition hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={workspaceCopy.topUp.close}
              >
                {workspaceCopy.topUp.close}
              </button>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeTopUpModal}
                className="rounded-input border border-hairline px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-accentSoft/50 hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {workspaceCopy.topUp.maybeLater}
              </button>
              <button
                type="submit"
                disabled={isTopUpLoading}
                className={clsx(
                  'rounded-input border border-transparent bg-accent px-4 py-2 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                  !isTopUpLoading && 'hover:brightness-105'
                )}
              >
                {isTopUpLoading ? workspaceCopy.topUp.submitting : workspaceCopy.topUp.submit}
              </button>
            </div>
          </form>
        </div>
      )}
      {assetPickerTarget && (
        <AssetLibraryModal
          fieldLabel={assetPickerTarget.field.label ?? workspaceCopy.assetLibrary.fieldFallback}
          assets={assetLibrary}
          isLoading={isAssetLibraryLoading}
          error={assetLibraryError}
          source={assetLibrarySource}
          onSourceChange={(nextSource) => {
            if (nextSource === assetLibrarySource) return;
            setAssetLibrarySource(nextSource);
            setAssetLibraryError(null);
            setAssetLibrary([]);
            void fetchAssetLibrary(nextSource);
          }}
          onClose={() => setAssetPickerTarget(null)}
          onRefresh={fetchAssetLibrary}
          onSelect={(asset) => handleSelectLibraryAsset(assetPickerTarget.field, asset, assetPickerTarget.slotIndex)}
          onDelete={handleDeleteLibraryAsset}
          deletingAssetId={assetDeletePendingId}
        />
      )}
    </div>
  );
}
const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);
