'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useEngines, useInfiniteJobs, runPreflight, runGenerate, getJobStatus, saveAssetToLibrary, saveImageToLibrary } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { translateError } from '@/lib/error-messages';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { EngineCaps, EngineInputField, EngineModeUiCaps, Mode, PreflightRequest, PreflightResponse } from '@/types/engines';
import { LOGIN_LAST_TARGET_KEY, LOGIN_SKIP_ONBOARDING_KEY } from '@/lib/auth-storage';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { SettingsControls } from '@/components/SettingsControls';
import { CoreSettingsBar } from '@/components/CoreSettingsBar';
import { EngineSettingsBar } from '@/components/EngineSettingsBar';
import {
  Composer,
  type ComposerAttachment,
  type AssetFieldConfig,
  type AssetFieldRole,
  type ComposerPromotedAction,
  type MultiPromptScene,
} from '@/components/Composer';
import type { KlingElementState, KlingElementAsset, KlingElementsBuilderProps } from '@/components/KlingElementsBuilder';
import type { QuadPreviewTile, QuadTileAction } from '@/components/QuadPreviewPanel';
import type { GalleryFeedState, GalleryRailProps } from '@/components/GalleryRail';
import type { GroupSummary, GroupMemberSummary } from '@/types/groups';
import type { CompositePreviewDockProps } from '@/components/groups/CompositePreviewDock';
import dynamic from 'next/dynamic';
import { DEFAULT_PROCESSING_COPY } from '@/components/groups/ProcessingOverlay';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { getRenderEta } from '@/lib/render-eta';
import { ENV as CLIENT_ENV } from '@/lib/env';
import { adaptGroupSummaries, adaptGroupSummary } from '@/lib/video-group-adapter';
import type { VideoGroup, VideoItem } from '@/types/video-groups';
import {
  mapSelectedPreviewToGroup,
  mapSharedVideoToGroup,
  type SelectedVideoPreview,
  type SharedVideoPreview,
} from '@/lib/video-preview-group';
import { useResultProvider } from '@/hooks/useResultProvider';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { normalizeGroupSummaries, normalizeGroupSummary } from '@/lib/normalize-group-summary';
import type { Job } from '@/types/jobs';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { isExpiredRefundedFailedGalleryItem, isRefundedPaymentStatus } from '@/lib/gallery-retention';
import { supportsAudioPricingToggle } from '@/lib/pricing-addons';
import { readLastKnownUserId } from '@/lib/last-known';
import { dispatchAnalyticsEvent } from '@/lib/analytics-client';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AssetLibraryModalProps } from '@/components/library/AssetLibraryModal';
import {
  getLumaRay2DurationInfo,
  getLumaRay2ResolutionInfo,
  isLumaRay2EngineId,
  isLumaRay2AspectRatio,
  isLumaRay2GenerateMode,
  toLumaRay2DurationLabel,
  LUMA_RAY2_ERROR_UNSUPPORTED,
  type LumaRay2DurationLabel,
} from '@/lib/luma-ray2';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { isPlaceholderMediaUrl } from '@/lib/media';
import {
  getSeedanceAssetState,
  getSeedanceFieldBlockKey,
  getUnifiedSeedanceMode,
  isUnifiedSeedanceEngineId,
  SEEDANCE_REFERENCE_AUDIO_FIELD_IDS,
  UNIFIED_SEEDANCE_ENGINE_IDS,
} from '@/lib/seedance-workflow';
import {
  getUnifiedHappyHorseMode,
  isHappyHorseEngineId,
} from '@/lib/happy-horse-workflow';
import {
  getLocalizedModeLabel,
  getLocalizedWorkflowCopy,
  localizeLtxField,
  normalizeUiLocale,
} from '@/lib/ltx-localization';

const AssetLibraryModal = dynamic<AssetLibraryModalProps>(
  () => import('@/components/library/AssetLibraryModal').then((mod) => mod.AssetLibraryModal),
  { ssr: false }
);

const CompositePreviewDock = dynamic<CompositePreviewDockProps>(
  () => import('@/components/groups/CompositePreviewDock').then((mod) => mod.CompositePreviewDock),
  {
    loading: () => <CompositePreviewDockSkeleton />,
  }
);

const GalleryRail = dynamic<GalleryRailProps>(
  () => import('@/components/GalleryRail').then((mod) => mod.GalleryRail),
  {
    ssr: false,
    loading: () => <GalleryRailSkeleton />,
  }
);

const KlingElementsBuilder = dynamic<KlingElementsBuilderProps>(
  () => import('@/components/KlingElementsBuilder').then((mod) => mod.KlingElementsBuilder),
  { ssr: false }
);

const COMPOSITE_PREVIEW_POSTER_SIZES = '(max-width: 1024px) 100vw, calc(100vw - 420px)';
const COMPOSITE_PREVIEW_SLOT_COUNT: Record<VideoGroup['layout'], number> = {
  x1: 1,
  x2: 2,
  x3: 4,
  x4: 4,
};

function isCompositePreviewVideoItem(item: VideoItem): boolean {
  const hint = typeof item.meta?.mediaType === 'string' ? item.meta.mediaType.toLowerCase() : null;
  if (hint === 'video') return true;
  if (hint === 'image') return false;
  const url = item.url.toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
}

function getCompositePreviewPosterSrc(group: VideoGroup | null): string | null {
  if (!group) return null;
  const desired = COMPOSITE_PREVIEW_SLOT_COUNT[group.layout] ?? Math.min(group.items.length, 4);
  const visibleItems = group.items.slice(0, desired);
  const activeVideoItem = visibleItems.find((item) => item.thumb && isCompositePreviewVideoItem(item));
  const fallbackItem = visibleItems.find((item) => item.thumb);
  return activeVideoItem?.thumb ?? fallbackItem?.thumb ?? null;
}

function CompositePreviewDockSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface-glass-60 p-4" aria-hidden>
      <div className="mx-auto aspect-video w-full max-w-[760px] overflow-hidden rounded-card bg-skeleton" />
      <div className="mx-auto mt-3 flex w-full max-w-[760px] gap-2">
        <div className="h-8 w-32 rounded-full bg-skeleton" />
        <div className="h-8 w-24 rounded-full bg-skeleton" />
      </div>
    </div>
  );
}

function GalleryRailSkeleton() {
  return (
    <div className="w-full rounded-card border border-border bg-surface-glass-60 p-3" aria-hidden>
      <div className="mb-3 h-4 w-24 rounded-full bg-skeleton" />
      <div className="space-y-3">
        <div className="aspect-video rounded-card bg-skeleton" />
        <div className="aspect-video rounded-card bg-skeleton" />
      </div>
    </div>
  );
}

function WorkspaceBootPreview({ posterSrc }: { posterSrc?: string | null }) {
  return (
    <section className="rounded-card border border-border bg-surface-glass-90 shadow-card" aria-hidden>
      <div className="border-b border-hairline px-4 py-3">
        <div className="h-9 w-full max-w-[520px] rounded-full bg-skeleton" />
      </div>
      <div className="px-4 py-4">
        <div className="relative mx-auto aspect-video w-full max-w-[960px] overflow-hidden rounded-card bg-placeholder">
          {posterSrc ? (
            <Image
              src={posterSrc}
              alt=""
              fill
              priority
              sizes={COMPOSITE_PREVIEW_POSTER_SIZES}
              className="object-cover"
            />
          ) : (
            <div className="skeleton absolute inset-0" />
          )}
        </div>
        <div className="mx-auto mt-3 flex w-full max-w-[760px] gap-2">
          <div className="h-8 w-32 rounded-full bg-skeleton" />
          <div className="h-8 w-24 rounded-full bg-skeleton" />
        </div>
      </div>
    </section>
  );
}

function ComposerBootSkeleton() {
  return (
    <section className="rounded-card border border-border bg-surface-glass-80 p-4 shadow-card" aria-hidden>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="h-4 w-36 rounded-full bg-skeleton" />
        <div className="h-8 w-28 rounded-full bg-skeleton" />
      </div>
      <div className="min-h-[156px] rounded-card border border-hairline bg-surface-2 p-4">
        <div className="h-4 w-3/4 rounded-full bg-skeleton" />
        <div className="mt-3 h-4 w-5/6 rounded-full bg-skeleton" />
        <div className="mt-3 h-4 w-2/3 rounded-full bg-skeleton" />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-input bg-skeleton" />
          <div className="h-9 w-24 rounded-input bg-skeleton" />
        </div>
        <div className="h-11 w-36 rounded-input bg-skeleton" />
      </div>
    </section>
  );
}

function WorkspaceChrome({
  isDesktopLayout,
  children,
  desktopRail,
  mobileRail,
}: {
  isDesktopLayout: boolean;
  children: ReactNode;
  desktopRail: ReactNode;
  mobileRail: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className={clsx('flex flex-1', isDesktopLayout ? 'flex-row' : 'flex-col')}>
        <div className="flex min-w-0 flex-1">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <main className="flex min-w-0 flex-1 flex-col gap-[var(--stack-gap-lg)] p-5 lg:p-7">
              {children}
            </main>
          </div>
        </div>
        {isDesktopLayout ? (
          <div className="flex w-[320px] justify-end py-4 pl-2 pr-0">
            {desktopRail}
          </div>
        ) : null}
      </div>
      {!isDesktopLayout ? (
        <div className="border-t border-hairline bg-surface-glass-70 px-4 py-4">
          {mobileRail}
        </div>
      ) : null}
    </div>
  );
}

function EngineSettingsBootSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-hidden>
      <div className="h-9 w-40 rounded-input bg-skeleton" />
      <div className="h-9 w-28 rounded-input bg-skeleton" />
      <div className="h-9 w-24 rounded-input bg-skeleton" />
    </div>
  );
}

function WorkspaceBootContent({
  initialPreviewGroup,
  initialPreviewPosterSrc,
}: {
  initialPreviewGroup?: VideoGroup | null;
  initialPreviewPosterSrc?: string | null;
}) {
  const posterSrc = getCompositePreviewPosterSrc(initialPreviewGroup ?? null) ?? initialPreviewPosterSrc ?? null;

  return (
    <div className="stack-gap-lg">
      {initialPreviewGroup ? (
        <>
          <CompositePreviewDock
            group={initialPreviewGroup}
            isLoading={false}
            showTitle={false}
            engineSettings={<EngineSettingsBootSkeleton />}
          />
        </>
      ) : (
        <WorkspaceBootPreview posterSrc={posterSrc} />
      )}
      <ComposerBootSkeleton />
    </div>
  );
}

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

function resolvePolledThumbUrl(current?: string | null, next?: string | null): string | undefined {
  if (next && !isPlaceholderMediaUrl(next)) return next;
  if (current) return current;
  return next ?? undefined;
}

type SharedVideoPayload = SharedVideoPreview;

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const MULTI_PROMPT_MIN_SEC = 3;
const MULTI_PROMPT_MAX_SEC = 15;

function createLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createMultiPromptScene(): MultiPromptScene {
  return {
    id: createLocalId('scene'),
    prompt: '',
    duration: 5,
  };
}

function buildMultiPromptSummary(scenes: MultiPromptScene[]): string {
  return scenes
    .filter((scene) => scene.prompt.trim().length)
    .map((scene, index) => `Scene ${index + 1}: ${scene.prompt.trim()}`)
    .join(' | ');
}

function haveSameGroupOrder(a: GroupSummary[], b: GroupSummary[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index]?.id !== b[index]?.id) return false;
  }
  return true;
}

function createKlingElement(): KlingElementState {
  return {
    id: createLocalId('element'),
    frontal: null,
    references: Array.from({ length: 3 }, () => null),
    video: null,
  };
}

function normalizeSharedVideoPayload(raw: SharedVideoPayload): SharedVideoPayload {
  const durationSec = coerceNumber(raw.durationSec) ?? 0;
  return {
    ...raw,
    durationSec,
  };
}

type ReferenceAsset = {
  id: string;
  fieldId: string;
  previewUrl: string;
  kind: 'image' | 'video' | 'audio';
  name: string;
  size: number;
  type: string;
  url?: string;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  assetId?: string;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
};

type UserAsset = {
  id: string;
  url: string;
  kind: 'image' | 'video' | 'audio';
  width?: number | null;
  height?: number | null;
  size?: number | null;
  mime?: string | null;
  source?: string | null;
  createdAt?: string;
  canDelete?: boolean;
  jobId?: string | null;
  sourceOutputId?: string | null;
};

type AssetLibrarySource = 'all' | 'upload' | 'generated' | 'recent' | 'character' | 'angle' | 'upscale';
type AssetLibraryKind = 'image' | 'video';
type UploadableAssetKind = 'image' | 'video' | 'audio';
type UploadFailurePayload = { error?: unknown; maxMB?: unknown } | null;
type UploadFailure = Error & {
  code?: string;
  maxMB?: number;
  status?: number;
  assetType?: UploadableAssetKind;
};

type AssetPickerTarget =
  | { kind: 'field'; field: EngineInputField; slotIndex?: number }
  | { kind: 'kling'; elementId: string; slot: 'frontal' | 'reference'; slotIndex?: number };

function buildAssetLibraryCacheKey(kind: AssetLibraryKind, source: AssetLibrarySource): string {
  return `${kind}:${source}`;
}

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
  authGate: {
    title: 'Create an account to render',
    body: 'You can explore the full workspace with starter renders, but launching a real render requires an account.',
    primary: 'Create account',
    secondary: 'Sign in',
    close: 'Maybe later',
    uploadLocked: 'Sign in to upload',
  },
  assetLibrary: {
    title: 'Select asset',
    searchPlaceholder: 'Search assets…',
    import: 'Import',
    importing: 'Importing…',
    importFailed: 'Import failed. Please try again.',
    refresh: 'Refresh',
    close: 'Close',
    fieldFallback: 'Asset',
    sourcesTitle: 'Library',
    toolsTitle: 'Create or transform',
    toolsDescription: 'Open another workspace to prepare a better source before importing it here.',
    emptySearch: 'No assets match this search.',
    empty: 'No saved images yet. Upload a reference image to see it here.',
    emptyUploads: 'No uploaded images yet. Upload a reference image to see it here.',
    emptyGenerated: 'No generated images saved yet. Save a generated image to see it here.',
    emptyCharacter: 'No character assets saved yet. Generate one in Character Builder first.',
    emptyAngle: 'No angle assets saved yet. Generate one in the Angle tool first.',
    emptyUpscale: 'No upscale assets saved yet. Save an upscale result first.',
    tabs: {
      all: 'All',
      upload: 'Uploaded',
      generated: 'Generated',
      character: 'Character',
      angle: 'Angle',
      upscale: 'Upscale',
    },
    shortcuts: {
      createImage: 'Create image',
      changeAngle: 'Change angle',
      characterBuilder: 'Character builder',
      upscale: 'Upscale',
    },
  },
} as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeCopy<T extends Record<string, unknown>>(defaults: T, overrides?: Partial<T> | null): T {
  if (!isPlainRecord(overrides)) return defaults;
  const next: Record<string, unknown> = { ...defaults };
  Object.entries(overrides).forEach(([key, overrideValue]) => {
    const defaultValue = next[key];
    if (isPlainRecord(defaultValue) && isPlainRecord(overrideValue)) {
      next[key] = mergeCopy(defaultValue, overrideValue);
      return;
    }
    if (overrideValue !== undefined) {
      next[key] = overrideValue;
    }
  });
  return next as T;
}

function normalizeEngineToken(value?: string | null): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function resolveUploadErrorMessage(
  assetType: string,
  status: number,
  errorCode: unknown,
  fallback: string,
  maxMB?: number
): string {
  if (assetType === 'image') {
    return translateError({
      code: typeof errorCode === 'string' ? errorCode : null,
      status,
      message: fallback,
    }).message;
  }
  const normalizedCode = typeof errorCode === 'string' ? errorCode.trim().toUpperCase() : null;
  const sizeLimit =
    typeof maxMB === 'number' && Number.isFinite(maxMB) && maxMB > 0 ? `${Math.round(maxMB)} MB` : 'the upload limit';

  if (assetType === 'video') {
    switch (normalizedCode) {
      case 'FILE_TOO_LARGE':
        return `This video is too large to import. Keep each reference video under ${sizeLimit} and try again.`;
      case 'UNSUPPORTED_TYPE':
        return 'This video format could not be imported. Use a standard MP4 or MOV file and try again.';
      case 'EMPTY_FILE':
        return 'This video file appears to be empty. Export it again from your device and retry.';
      case 'UNAUTHORIZED':
        return 'Your session expired before the video upload could start. Sign in again and retry.';
      case 'UPLOAD_FAILED':
      case 'STORE_FAILED':
        return 'The video reached the server but could not be stored. Please retry in a moment.';
      default:
        break;
    }
  }

  if (assetType === 'audio') {
    switch (normalizedCode) {
      case 'FILE_TOO_LARGE':
        return `This audio file is too large to import. Keep each reference clip under ${sizeLimit} and try again.`;
      case 'UNSUPPORTED_TYPE':
        return 'This audio format could not be imported. Use a standard MP3 or WAV file and try again.';
      case 'EMPTY_FILE':
        return 'This audio file appears to be empty. Export it again from your device and retry.';
      case 'UNAUTHORIZED':
        return 'Your session expired before the audio upload could start. Sign in again and retry.';
      case 'UPLOAD_FAILED':
      case 'STORE_FAILED':
        return 'The audio reached the server but could not be stored. Please retry in a moment.';
      default:
        break;
    }
  }

  if (status === 401) {
    return 'Your session expired before the upload could start. Sign in again and retry.';
  }
  if (status === 413) {
    return `This file is too large to import. Keep it under ${sizeLimit} and try again.`;
  }
  if (typeof errorCode === 'string' && errorCode.trim().length > 0) {
    return errorCode;
  }
  return fallback;
}

function createUploadFailure(
  assetType: UploadableAssetKind,
  status: number,
  payload: UploadFailurePayload,
  fallback: string
): UploadFailure {
  const code = typeof payload?.error === 'string' ? payload.error : undefined;
  const maxMB = typeof payload?.maxMB === 'number' && Number.isFinite(payload.maxMB) ? payload.maxMB : undefined;
  const error = new Error(resolveUploadErrorMessage(assetType, status, code, fallback, maxMB)) as UploadFailure;
  error.code = code;
  error.maxMB = maxMB;
  error.status = status;
  error.assetType = assetType;
  return error;
}

function getUploadFailureMessage(
  assetType: UploadableAssetKind,
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error) {
    const uploadError = error as UploadFailure;
    if (uploadError.code || uploadError.status || uploadError.maxMB) {
      return resolveUploadErrorMessage(
        assetType,
        uploadError.status ?? 0,
        uploadError.code ?? uploadError.message,
        fallback,
        uploadError.maxMB
      );
    }
    if (uploadError.name === 'AbortError') {
      return 'The upload was interrupted before it completed. Please try again.';
    }
    if (
      uploadError.message === 'Failed to fetch' ||
      uploadError.message === 'Network request failed' ||
      uploadError.message === 'NetworkError when attempting to fetch resource.'
    ) {
      return 'The upload could not reach the server. Check your connection and try again.';
    }
    return uploadError.message || fallback;
  }
  return fallback;
}

function matchesEngineToken(engine: EngineCaps, token: string): boolean {
  if (!token) return false;
  if (normalizeEngineToken(engine.id) === token) return true;
  if (normalizeEngineToken(engine.label) === token) return true;
  const slug = normalizeEngineToken(engine.providerMeta?.modelSlug);
  if (slug && slug === token) return true;
  return false;
}

const DESKTOP_RAIL_MIN_WIDTH = 1088;

type DurationOptionMeta = {
  raw: number | string;
  value: number;
  label: string;
  isAuto?: boolean;
};

function parseDurationOptionValue(option: number | string): DurationOptionMeta {
  if (typeof option === 'number') {
    return {
      raw: option,
      value: option,
      label: `${option}s`,
    };
  }
  if (option.trim().toLowerCase() === 'auto') {
    return {
      raw: option,
      value: 0,
      label: option,
      isAuto: true,
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

const STANDARD_ENGINE_FIELD_IDS = new Set([
  'prompt',
  'negativeprompt',
  'duration',
  'durationseconds',
  'resolution',
  'aspectratio',
  'fps',
  'generateaudio',
  'seed',
  'camerafixed',
  'enablesafetychecker',
  'cfgscale',
  'loop',
]);

const PROMOTED_WORKFLOW_FIELD_IDS = new Set(['enhanceprompt', 'autofix']);

function isModeValue(value: unknown): value is Mode {
  return (
    value === 't2v' ||
    value === 'i2v' ||
    value === 'v2v' ||
    value === 'ref2v' ||
    value === 'fl2v' ||
    value === 'r2v' ||
    value === 'a2v' ||
    value === 'extend' ||
    value === 'retake' ||
    value === 'reframe' ||
    value === 't2i' ||
    value === 'i2i'
  );
}

function getEngineModeLabel(engineId: string | null | undefined, mode: Mode, locale?: string | null): string {
  if (engineId === 'happy-horse-1-0' && mode === 'ref2v') {
    return 'R2V';
  }
  return getLocalizedModeLabel(mode, locale);
}

function coerceStoredExtraInputValues(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    if (!key.trim()) return acc;
    if (
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      (Array.isArray(entry) &&
        entry.every(
          (item) => item === null || typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
        ))
    ) {
      acc[key] = entry;
    }
    return acc;
  }, {});
}

function normalizeExtraInputValue(field: EngineInputField, value: unknown): unknown {
  if (value == null) return undefined;
  if (field.type === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }
  if (field.type === 'enum') {
    const raw = typeof value === 'number' ? value : typeof value === 'string' ? value.trim() : '';
    if (raw === '') return undefined;
    return raw;
  }
  if (field.type === 'text') {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  return undefined;
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

function findInputFieldById(engine: EngineCaps, mode: Mode, fieldId: string): EngineInputField | null {
  const schema = engine.inputSchema;
  if (!schema) return null;
  const normalizedTarget = normalizeFieldId(fieldId);
  const fields = [...(schema.required ?? []), ...(schema.optional ?? [])];
  return (
    fields.find((field) => {
      const id = normalizeFieldId(field.id);
      if (id !== normalizedTarget) return false;
      return !field.modes || field.modes.includes(mode);
    }) ?? null
  );
}

function findGenerateAudioField(engine: EngineCaps, mode: Mode): EngineInputField | null {
  return findInputFieldById(engine, mode, 'generate_audio');
}

function resolveAudioDefault(engine: EngineCaps, mode: Mode): boolean {
  const field = findGenerateAudioField(engine, mode);
  const parsed = parseBooleanInput(field?.default);
  return parsed ?? true;
}

function resolveBooleanFieldDefault(
  engine: EngineCaps,
  mode: Mode,
  fieldId: string,
  fallback: boolean
): boolean {
  const field = findInputFieldById(engine, mode, fieldId);
  const parsed = parseBooleanInput(field?.default);
  return parsed ?? fallback;
}

function resolveNumberFieldDefault(engine: EngineCaps, mode: Mode, fieldId: string): number | null {
  const field = findInputFieldById(engine, mode, fieldId);
  const raw = field?.default;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().length) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getPreferredEngineMode(engine: EngineCaps, candidate?: Mode | null): Mode {
  if (candidate && engine.modes.includes(candidate)) return candidate;
  return engine.modes[0] ?? 't2v';
}

function getModeCaps(engine: EngineCaps, mode: Mode): EngineModeUiCaps | undefined {
  const exact = engine.modeCaps?.[mode];
  if (exact) return exact;
  return {
    modes: [mode],
    duration: { min: 1, default: engine.maxDurationSec || 1 },
    resolution: engine.resolutions,
    aspectRatio: engine.aspectRatios,
    fps: engine.fps,
    audioToggle: engine.audio,
  };
}

function framesToSeconds(frames: number): number {
  if (!Number.isFinite(frames) || frames <= 0) return 1;
  return Math.max(1, Math.round(frames / 24));
}

function coerceFormState(engine: EngineCaps, mode: Mode, previous: FormState | null | undefined): FormState {
  const capability = getModeCaps(engine, mode);
  const isLumaRay2Engine = isLumaRay2EngineId(engine.id);
  const resetFastDefaultsOnEngineSwitch =
    (engine.id === 'ltx-2-fast' || engine.id === 'ltx-2-3-fast') &&
    Boolean(previous?.engineId) &&
    previous?.engineId !== engine.id;
  const previousDurationOption = resetFastDefaultsOnEngineSwitch ? null : previous?.durationOption ?? null;
  const previousDurationSec = resetFastDefaultsOnEngineSwitch ? null : previous?.durationSec ?? null;
  const previousNumFrames = resetFastDefaultsOnEngineSwitch ? null : previous?.numFrames ?? null;
  const previousResolution = resetFastDefaultsOnEngineSwitch ? null : previous?.resolution ?? null;
  const previousFps = resetFastDefaultsOnEngineSwitch ? null : previous?.fps ?? null;

  const durationResult = (() => {
    const prevOption = previousDurationOption;
    const prevSeconds = previousDurationSec;
    const prevFrames = previousNumFrames;
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
        const parsedOptions = capability.duration.options
          .map(parseDurationOptionValue)
          .filter((entry) => entry.isAuto || entry.value > 0);
        const numericOptions = parsedOptions.filter((entry) => !entry.isAuto && entry.value > 0);
        const defaultRaw = capability.duration.default ?? parsedOptions[0]?.raw ?? engine.maxDurationSec;
        const defaultMeta = parseDurationOptionValue(defaultRaw as number | string);
        const fallbackDurationSec =
          prevSeconds != null && prevSeconds > 0
            ? prevSeconds
            : numericOptions.find((meta) => matchesDurationOption(meta, defaultRaw as number | string, defaultMeta.value))
                ?.value ?? numericOptions[0]?.value ?? Math.min(engine.maxDurationSec, 8);
        const closestBySeconds =
          prevSeconds != null && numericOptions.length
            ? numericOptions.reduce((best, candidate) => {
                const bestDiff = Math.abs(best.value - prevSeconds);
                const candidateDiff = Math.abs(candidate.value - prevSeconds);
                return candidateDiff < bestDiff ? candidate : best;
              }, numericOptions[0])
            : null;
        const selected = parsedOptions.find((meta) => matchesDurationOption(meta, prevOption, prevSeconds))
          ?? closestBySeconds
          ?? parsedOptions.find((meta) => matchesDurationOption(meta, defaultRaw as number | string, defaultMeta.value))
          ?? parsedOptions[0]
          ?? defaultMeta;
        const resolvedDurationValue = selected.isAuto ? fallbackDurationSec : selected.value;
        const clampedSeconds = Math.max(1, Math.min(engine.maxDurationSec, Math.round(resolvedDurationValue)));
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
      return previousResolution ?? engine.resolutions[0] ?? '1080p';
    }
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

  const fpsOptions = (() => {
    if (Array.isArray(capability?.fps)) return capability.fps;
    if (typeof capability?.fps === 'number') return [capability.fps];
    return engine.fps && engine.fps.length ? engine.fps : [24];
  })();
  const fps = (() => {
    if (previousFps && fpsOptions.includes(previousFps)) {
      return previousFps;
    }
    return fpsOptions[0];
  })();

  const iterations = previous?.iterations ? Math.max(1, Math.min(4, previous.iterations)) : 1;
  const loop = isLumaRay2Engine && isLumaRay2GenerateMode(mode) ? Boolean(previous?.loop) : undefined;
  const audio = (() => {
    const previousAudio = typeof previous?.audio === 'boolean' ? previous.audio : null;
    if (previousAudio !== null) return previousAudio;
    return resolveAudioDefault(engine, mode);
  })();
  const seed = (() => {
    const previousSeed = typeof previous?.seed === 'number' && Number.isFinite(previous.seed) ? previous.seed : null;
    if (previousSeed !== null) return previousSeed;
    return resolveNumberFieldDefault(engine, mode, 'seed');
  })();
  const cameraFixed = (() => {
    const previousValue = typeof previous?.cameraFixed === 'boolean' ? previous.cameraFixed : null;
    if (previousValue !== null) return previousValue;
    return resolveBooleanFieldDefault(engine, mode, 'camera_fixed', false);
  })();
  const safetyChecker = (() => {
    const previousValue = typeof previous?.safetyChecker === 'boolean' ? previous.safetyChecker : null;
    if (previousValue !== null) return previousValue;
    return resolveBooleanFieldDefault(engine, mode, 'enable_safety_checker', true);
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
    seed,
    cameraFixed,
    safetyChecker,
    extraInputValues: previous?.extraInputValues ?? {},
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
  dispatchAnalyticsEvent(event, payload);
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
  seed?: number | null;
  cameraFixed?: boolean;
  safetyChecker?: boolean;
  extraInputValues: Record<string, unknown>;
}

const DEFAULT_PROMPT = 'A quiet cinematic shot of neon-lit Tokyo streets in the rain';
const STORAGE_KEYS = {
  prompt: 'maxvideoai.generate.prompt.v1',
  negativePrompt: 'maxvideoai.generate.negativePrompt.v1',
  form: 'maxvideoai.generate.form.v1',
  memberTier: 'maxvideoai.generate.memberTier.v1',
  pendingRenders: 'maxvideoai.generate.pendingRenders.v1',
  previewJobId: 'maxvideoai.generate.previewJobId.v1',
  multiPromptEnabled: 'maxvideoai.generate.multiPromptEnabled.v1',
  multiPromptScenes: 'maxvideoai.generate.multiPromptScenes.v1',
  shotType: 'maxvideoai.generate.shotType.v1',
  voiceIds: 'maxvideoai.generate.voiceIds.v1',
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
      seed,
      cameraFixed,
      safetyChecker,
      extraInputValues,
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
      seed: typeof seed === 'number' && Number.isFinite(seed) ? Math.trunc(seed) : undefined,
      cameraFixed: typeof cameraFixed === 'boolean' ? cameraFixed : undefined,
      safetyChecker: typeof safetyChecker === 'boolean' ? safetyChecker : undefined,
      extraInputValues: coerceStoredExtraInputValues(extraInputValues),
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
  previewVideoUrl?: string;
  readyVideoUrl?: string;
  thumbUrl?: string;
  hasAudio?: boolean;
  priceCents?: number;
  currency?: string;
  pricingSnapshot?: PreflightResponse['pricing'];
  paymentStatus?: string;
  failedAt?: number;
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
  previewVideoUrl?: string | null;
  readyVideoUrl?: string | null;
  thumbUrl?: string | null;
  hasAudio?: boolean;
  priceCents?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  failedAt?: number | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
  startedAt: number;
  minReadyAt: number;
  groupId?: string | null;
  renderIds?: string[];
  heroRenderId?: string | null;
};

function isAudioWorkspaceRender(input: {
  jobId?: string | null;
  engineId?: string | null;
  surface?: string | null;
}): boolean {
  const surface = typeof input.surface === 'string' ? input.surface.trim().toLowerCase() : '';
  if (surface === 'audio') return true;
  const jobId = typeof input.jobId === 'string' ? input.jobId.trim().toLowerCase() : '';
  if (jobId.startsWith('aud_')) return true;
  const engineId = typeof input.engineId === 'string' ? input.engineId.trim().toLowerCase() : '';
  return engineId.startsWith('audio-');
}

function coercePersistedRender(entry: PersistedRender): LocalRender | null {
  const localKey = typeof entry.localKey === 'string' && entry.localKey.length ? entry.localKey : null;
  const engineId = typeof entry.engineId === 'string' && entry.engineId.length ? entry.engineId : null;
  const engineLabel = typeof entry.engineLabel === 'string' && entry.engineLabel.length ? entry.engineLabel : null;
  if (!localKey || !engineId || !engineLabel) {
    return null;
  }
  if (isAudioWorkspaceRender({ jobId: entry.jobId, engineId })) {
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
    previewVideoUrl:
      typeof entry.previewVideoUrl === 'string' && entry.previewVideoUrl.length ? entry.previewVideoUrl : undefined,
    readyVideoUrl:
      typeof entry.readyVideoUrl === 'string' && entry.readyVideoUrl.length ? entry.readyVideoUrl : undefined,
    thumbUrl: typeof entry.thumbUrl === 'string' && entry.thumbUrl.length ? entry.thumbUrl : undefined,
    hasAudio: typeof entry.hasAudio === 'boolean' ? entry.hasAudio : undefined,
    priceCents: typeof entry.priceCents === 'number' ? entry.priceCents : undefined,
    currency: typeof entry.currency === 'string' && entry.currency.length ? entry.currency : undefined,
    pricingSnapshot: undefined,
    paymentStatus: typeof entry.paymentStatus === 'string' && entry.paymentStatus.length ? entry.paymentStatus : undefined,
    failedAt: typeof entry.failedAt === 'number' && Number.isFinite(entry.failedAt) && entry.failedAt > 0 ? Math.trunc(entry.failedAt) : undefined,
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
    .filter(
      (render) =>
        render.status === 'pending' &&
        typeof render.jobId === 'string' &&
        render.jobId.length > 0 &&
        !isAudioWorkspaceRender({ jobId: render.jobId, engineId: render.engineId })
    )
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
      previewVideoUrl: render.previewVideoUrl,
      readyVideoUrl: render.readyVideoUrl,
      thumbUrl: render.thumbUrl,
      hasAudio: render.hasAudio,
      priceCents: render.priceCents,
      currency: render.currency,
      paymentStatus: render.paymentStatus,
      failedAt: render.failedAt ?? null,
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
const PRIMARY_IMAGE_SLOT_IDS = ['image_url', 'input_image', 'image'] as const;
const PRIMARY_VIDEO_SLOT_IDS = ['video_url', 'input_video', 'video'] as const;
const UNIFIED_VEO_FIRST_LAST_ENGINE_IDS = new Set(['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite']);

export default function AppClientPage({ initialPreviewGroup = null }: { initialPreviewGroup?: VideoGroup | null }) {
  const { data, error: enginesError, isLoading } = useEngines();
  const engines = useMemo(() => data?.engines ?? [], [data]);
  const { data: latestJobsPages, mutate: mutateLatestJobs } = useInfiniteJobs(24, { type: 'video' });
  const { user, loading: authLoading, authStatus } = useRequireAuth({ redirectIfLoggedOut: false });
  const engineIdByLabel = useMemo(() => {
    const map = new Map<string, string>();
    engines.forEach((engine) => {
      map.set(engine.label.toLowerCase(), engine.id);
    });
    return map;
  }, [engines]);
  const recentJobs = useMemo(
    () => (latestJobsPages?.flatMap((page) => page.jobs ?? []) ?? []).filter((job) => job.surface !== 'audio'),
    [latestJobsPages]
  );
  const provider = useResultProvider();
  const showCenterGallery = CLIENT_ENV.WORKSPACE_CENTER_GALLERY === 'true';
  const { t, locale } = useI18n();
  const uiLocale = normalizeUiLocale(locale);
  const workflowCopy = useMemo(() => getLocalizedWorkflowCopy(uiLocale), [uiLocale]);
  const rawWorkspaceCopy = t('workspace.generate', DEFAULT_WORKSPACE_COPY);
  const workspaceCopy = useMemo(
    () =>
      mergeCopy(
        DEFAULT_WORKSPACE_COPY,
        (rawWorkspaceCopy ?? {}) as Partial<typeof DEFAULT_WORKSPACE_COPY>
      ),
    [rawWorkspaceCopy]
  );
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hydratedForScope, setHydratedForScope] = useState<string | null>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [multiPromptEnabled, setMultiPromptEnabled] = useState(false);
  const [multiPromptScenes, setMultiPromptScenes] = useState<MultiPromptScene[]>(() => [createMultiPromptScene()]);
  const [shotType, setShotType] = useState<'customize' | 'intelligent'>('customize');
  const [voiceIdsInput, setVoiceIdsInput] = useState<string>('');
  const [klingElements, setKlingElements] = useState<KlingElementState[]>(() => [createKlingElement()]);
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
  const [authModalOpen, setAuthModalOpen] = useState(false);
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
const requestedMode = useMemo<Mode | null>(() => {
  const value = searchParams?.get('mode');
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return isModeValue(trimmed) ? trimmed : null;
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
const searchString = useMemo(() => searchParams?.toString() ?? '', [searchParams]);
const loginRedirectTarget = useMemo(() => {
  const base = pathname ?? '/app';
  return searchString ? `${base}?${searchString}` : base;
}, [pathname, searchString]);
const skipOnboardingRef = useRef<boolean>(false);
const hydratedJobRef = useRef<string | null>(null);
const preserveStoredDraftRef = useRef<boolean>(false);
const requestedEngineOverrideIdRef = useRef<string | null>(null);
const requestedEngineOverrideTokenRef = useRef<string | null>(null);
const requestedModeOverrideRef = useRef<Mode | null>(null);

useEffect(() => {
  if (!resolvedRequestedEngineId) return;
  requestedEngineOverrideIdRef.current = resolvedRequestedEngineId;
  requestedEngineOverrideTokenRef.current = requestedEngineToken;
  requestedModeOverrideRef.current = requestedMode;
}, [resolvedRequestedEngineId, requestedEngineToken, requestedMode]);

const effectiveRequestedEngineId = resolvedRequestedEngineId ?? requestedEngineOverrideIdRef.current;
const effectiveRequestedEngineToken = requestedEngineToken ?? requestedEngineOverrideTokenRef.current;
const effectiveRequestedMode = requestedMode ?? requestedModeOverrideRef.current;

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
  const [sharedVideoSettings, setSharedVideoSettings] = useState<SharedVideoPayload | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<SelectedVideoPreview | null>(null);
  const [guidedSampleFeed, setGuidedSampleFeed] = useState<GalleryFeedState>({ visibleGroups: [], sampleOnly: false });
  const [previewAutoPlayRequestId, setPreviewAutoPlayRequestId] = useState(0);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchHeroes, setBatchHeroes] = useState<Record<string, string>>({});
  const [galleryRetentionTick, setGalleryRetentionTick] = useState(0);
  const [viewerTarget, setViewerTarget] = useState<
    { kind: 'pending'; id: string } | { kind: 'summary'; summary: GroupSummary } | { kind: 'group'; group: VideoGroup } | null
  >(null);
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(min-width: ${DESKTOP_RAIL_MIN_WIDTH}px)`).matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_RAIL_MIN_WIDTH}px)`);
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
      previewVideoUrl: job.previewVideoUrl ?? undefined,
      readyVideoUrl: job.videoUrl ?? undefined,
      thumbUrl,
      hasAudio: typeof job.hasAudio === 'boolean' ? job.hasAudio : undefined,
      priceCents: priceCents ?? undefined,
        currency,
        pricingSnapshot: job.pricingSnapshot,
        paymentStatus: job.paymentStatus ?? 'platform',
        failedAt:
          normalizedStatus === 'failed' && isRefundedPaymentStatus(job.paymentStatus ?? null)
            ? parsedCreated
            : undefined,
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
      } else {
        setUserId(null);
      }
      setAuthChecked(true);
      return;
    }
    setUserId(null);
    setAuthChecked(true);
  }, [authLoading, authStatus, user?.id]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setGalleryRetentionTick((current) => current + 1);
    }, 5_000);
    return () => window.clearInterval(intervalId);
  }, []);

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

      const storedMultiPromptEnabled = readStorage(STORAGE_KEYS.multiPromptEnabled);
      setMultiPromptEnabled(storedMultiPromptEnabled === 'true');
      const storedMultiPromptScenes = readStorage(STORAGE_KEYS.multiPromptScenes);
      if (storedMultiPromptScenes) {
        try {
          const parsed = JSON.parse(storedMultiPromptScenes) as MultiPromptScene[];
          if (Array.isArray(parsed) && parsed.length) {
            const sanitized = parsed
              .map((scene) => ({
                id: typeof scene.id === 'string' ? scene.id : createLocalId('scene'),
                prompt: typeof scene.prompt === 'string' ? scene.prompt : '',
                duration:
                  typeof scene.duration === 'number' && Number.isFinite(scene.duration)
                    ? Math.round(scene.duration)
                    : 5,
              }))
              .filter((scene) => scene.prompt.length || scene.duration);
            setMultiPromptScenes(sanitized.length ? sanitized : [createMultiPromptScene()]);
          }
        } catch {
          setMultiPromptScenes([createMultiPromptScene()]);
        }
      }

      const storedShotType = readStorage(STORAGE_KEYS.shotType);
      if (storedShotType === 'customize' || storedShotType === 'intelligent') {
        setShotType(storedShotType);
      }
      const storedVoiceIds = readStorage(STORAGE_KEYS.voiceIds);
      if (typeof storedVoiceIds === 'string') {
        setVoiceIdsInput(storedVoiceIds);
      }

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
      preserveStoredDraftRef.current = Boolean(effectiveRequestedEngineId && storedFormRaw);

      if (storedFormRaw) {
        const storedToken = normalizeEngineToken(storedFormRaw.engineId);
        const engine =
          engines.find((entry) => entry.id === storedFormRaw.engineId) ??
          (storedToken ? engines.find((entry) => matchesEngineToken(entry, storedToken)) : null) ??
          engines[0] ??
          null;
        if (engine) {
          const mode = getPreferredEngineMode(engine, storedFormRaw.mode);
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
            seed: typeof storedFormRaw.seed === 'number' ? storedFormRaw.seed : base.seed,
            cameraFixed:
              typeof storedFormRaw.cameraFixed === 'boolean' ? storedFormRaw.cameraFixed : base.cameraFixed,
            safetyChecker:
              typeof storedFormRaw.safetyChecker === 'boolean'
                ? storedFormRaw.safetyChecker
                : base.safetyChecker,
            extraInputValues: storedFormRaw.extraInputValues ?? base.extraInputValues,
          };
          nextForm = coerceFormState(engine, mode, candidate);
        }
      }
      hasStoredFormRef.current = Boolean(nextForm);

      if (effectiveRequestedEngineId) {
        const requestedEngine =
          engines.find((entry) => entry.id === effectiveRequestedEngineId) ??
          (effectiveRequestedEngineToken
            ? engines.find((entry) => matchesEngineToken(entry, effectiveRequestedEngineToken))
            : null) ??
          null;
        if (requestedEngine) {
          const preferredMode = getPreferredEngineMode(requestedEngine, effectiveRequestedMode ?? nextForm?.mode ?? null);
          const normalizedPrevious = nextForm
            ? { ...nextForm, engineId: requestedEngine.id, mode: preferredMode }
            : null;
          const base: FormState = normalizedPrevious
            ? coerceFormState(requestedEngine, preferredMode, normalizedPrevious)
            : {
                engineId: requestedEngine.id,
                mode: preferredMode,
                durationSec: 4,
                durationOption: 4,
                numFrames: undefined,
                resolution: '720p',
                aspectRatio: '16:9',
                fps: 24,
                iterations: 1,
                seedLocked: false,
                audio: true,
                seed: null,
                cameraFixed: false,
                safetyChecker: true,
                extraInputValues: {},
              };
          nextForm = base;
          hasStoredFormRef.current = hasStoredFormRef.current && preserveStoredDraftRef.current;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[generate] engine override from storage hydrate', {
              from: storedFormRaw?.engineId ?? null,
              to: nextForm.engineId,
              preserveStoredDraft: preserveStoredDraftRef.current,
            });
          }
          const shouldPersistRequestedEngine =
            !storedFormRaw ||
            storedFormRaw.engineId !== nextForm.engineId ||
            storedFormRaw.mode !== nextForm.mode;
          if (!preserveStoredDraftRef.current || shouldPersistRequestedEngine) {
            queueMicrotask(() => {
              try {
                writeStorage(STORAGE_KEYS.form, JSON.stringify(nextForm));
              } catch {
                // noop
              }
            });
          }
        } else if (!storedFormRaw) {
          const preferredMode: Mode = effectiveRequestedMode ?? 't2v';
          const base: FormState = {
            engineId: effectiveRequestedEngineId,
            mode: preferredMode,
            durationSec: 4,
            durationOption: 4,
            numFrames: undefined,
            resolution: '720p',
            aspectRatio: '16:9',
            fps: 24,
            iterations: 1,
            seedLocked: false,
            audio: true,
            seed: null,
            cameraFixed: false,
            safetyChecker: true,
            extraInputValues: {},
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
        nextForm = coerceFormState(engine, getPreferredEngineMode(engine, effectiveRequestedMode), null);
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
    effectiveRequestedEngineId,
    effectiveRequestedMode,
    effectiveRequestedEngineToken,
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
                      previewVideoUrl: status.previewVideoUrl ?? item.previewVideoUrl,
                      thumbUrl: resolvePolledThumbUrl(item.thumbUrl, status.thumbUrl),
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
                    previewVideoUrl: status.previewVideoUrl ?? cur.previewVideoUrl,
                    thumbUrl: resolvePolledThumbUrl(cur.thumbUrl, status.thumbUrl),
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
    const removedLocalKeys: string[] = [];
    const removedGroupIds = new Set<string>();

    setRenders((prev) => {
      let changed = false;
      const next = prev.filter((render) => {
        const shouldRemove = isAudioWorkspaceRender({ jobId: render.jobId, engineId: render.engineId });
        if (!shouldRemove) {
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
      if (typeof current.id === 'string' && current.id.toLowerCase().startsWith('aud_')) {
        return null;
      }
      if (current.localKey && removedLocalKeys.includes(current.localKey)) {
        return null;
      }
      if (current.batchId && removedGroupIds.has(current.batchId)) {
        return null;
      }
      return current;
    });
  }, [renders]);

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
        if (!hasVideo) {
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

  useEffect(() => {
    if (!renders.length) return;
    const now = Date.now();
    const removedLocalKeys: string[] = [];
    const removedGroupIds = new Set<string>();
    setRenders((prev) => {
      let changed = false;
      const next = prev.filter((render) => {
        if (!isExpiredRefundedFailedGalleryItem(render, now)) {
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
  }, [renders, galleryRetentionTick]);

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
          previewVideoUrl: gatingActive ? null : item.previewVideoUrl ?? null,
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
          previewVideoUrl: member.previewVideoUrl,
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
  const isGuidedSamplesActive = guidedSampleFeed.sampleOnly;
  const guidedSampleGroups = guidedSampleFeed.visibleGroups;
  const restoredPreviewJobRef = useRef<string | null>(null);
  const applyVideoSettingsSnapshotRef = useRef<(snapshot: unknown) => void>(() => undefined);
  const activeVideoGroup = useMemo<VideoGroup | null>(() => {
    if (compositeOverride) return null;
    if (!activeVideoGroups.length) return null;
    if (!activeGroupId) return activeVideoGroups[0] ?? null;
    return activeVideoGroups.find((group) => group.id === activeGroupId) ?? activeVideoGroups[0] ?? null;
  }, [activeVideoGroups, activeGroupId, compositeOverride]);
  const compositeGroup = compositeOverride ?? activeVideoGroup ?? null;
  const selectedPreviewGroup = useMemo(() => mapSelectedPreviewToGroup(selectedPreview, provider), [selectedPreview, provider]);
  const initialPreviewFallbackGroup =
    effectiveRequestedEngineId || effectiveRequestedEngineToken || requestedJobId || fromVideoId
      ? null
      : initialPreviewGroup;
  const displayCompositeGroup = compositeGroup ?? selectedPreviewGroup ?? initialPreviewFallbackGroup;
  const compositePreviewPosterSrc = useMemo(() => getCompositePreviewPosterSrc(displayCompositeGroup), [displayCompositeGroup]);

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
    if (viewerTarget.kind === 'group') {
      return viewerTarget.group;
    }
    return adaptGroupSummary(normalizeGroupSummary(viewerTarget.summary), provider);
  }, [viewerTarget, pendingSummaryMap, provider]);
  const buildQuadTileFromRender = useCallback(
    (render: LocalRender, group: LocalRenderGroup): QuadPreviewTile => {
      const gatingActive = render.status !== 'failed' && Date.now() < render.minReadyAt;
      const videoUrl = gatingActive ? undefined : render.videoUrl ?? render.readyVideoUrl;
      const previewVideoUrl = gatingActive ? undefined : render.previewVideoUrl;
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
        previewVideoUrl,
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
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.form, JSON.stringify({ ...form, updatedAt: Date.now() }));
    } catch {
      // noop
    }
  }, [form, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.prompt, prompt);
    } catch {
      // noop
    }
  }, [prompt, hydratedForScope, storageScope, writeStorage]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.negativePrompt, negativePrompt);
    } catch {
      // noop
    }
  }, [negativePrompt, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.multiPromptEnabled, multiPromptEnabled ? 'true' : 'false');
    } catch {
      // noop
    }
  }, [multiPromptEnabled, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.multiPromptScenes, JSON.stringify(multiPromptScenes));
    } catch {
      // noop
    }
  }, [multiPromptScenes, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.shotType, shotType);
    } catch {
      // noop
    }
  }, [shotType, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.voiceIds, voiceIdsInput);
    } catch {
      // noop
    }
  }, [voiceIdsInput, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.memberTier, memberTier);
    } catch {
      // noop
    }
  }, [memberTier, hydratedForScope, storageScope, writeStorage]);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const [inputAssets, setInputAssets] = useState<Record<string, (ReferenceAsset | null)[]>>({});
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickerTarget | null>(null);
  const [assetLibrary, setAssetLibrary] = useState<UserAsset[]>([]);
  const [isAssetLibraryLoading, setIsAssetLibraryLoading] = useState(false);
  const [assetLibraryError, setAssetLibraryError] = useState<string | null>(null);
  const [assetLibrarySource, setAssetLibrarySource] = useState<AssetLibrarySource>('all');
  const [assetLibraryLoadedKey, setAssetLibraryLoadedKey] = useState<string | null>(null);
  const [assetDeletePendingId, setAssetDeletePendingId] = useState<string | null>(null);

  const assetLibraryKind = useMemo<AssetLibraryKind>(() => {
    if (!assetPickerTarget) return 'image';
    if (assetPickerTarget.kind === 'field' && assetPickerTarget.field.type === 'video') {
      return 'video';
    }
    return 'image';
  }, [assetPickerTarget]);
  const assetLibraryRequestKey = assetPickerTarget
    ? buildAssetLibraryCacheKey(assetLibraryKind, assetLibrarySource)
    : null;
  const visibleAssetLibrary = useMemo(
    () => assetLibrary.filter((asset) => asset.kind === assetLibraryKind),
    [assetLibrary, assetLibraryKind]
  );

  const assetsRef = useRef<Record<string, (ReferenceAsset | null)[]>>({});
  const klingElementsRef = useRef<KlingElementState[]>([]);

const revokeAssetPreview = (asset: ReferenceAsset | null | undefined) => {
  if (!asset) return;
  if (asset.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(asset.previewUrl);
  }
};

const revokeKlingAssetPreview = (asset: { previewUrl: string } | null | undefined) => {
  if (!asset) return;
  if (asset.previewUrl && asset.previewUrl.startsWith('blob:')) {
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

useEffect(() => {
  klingElementsRef.current = klingElements;
}, [klingElements]);

useEffect(() => {
  return () => {
    klingElementsRef.current.forEach((element) => {
      revokeKlingAssetPreview(element.frontal);
      element.references.forEach((asset) => revokeKlingAssetPreview(asset));
      revokeKlingAssetPreview(element.video);
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

  const showComposerError = useCallback((message: string) => {
    setPreflightError(message);
  }, []);

  const fetchAssetLibrary = useCallback(async (options?: { source?: AssetLibrarySource; kind?: AssetLibraryKind }) => {
    const source = options?.source ?? assetLibrarySource;
    const kind = options?.kind ?? assetLibraryKind;
    const requestKey = buildAssetLibraryCacheKey(kind, source);
    setIsAssetLibraryLoading(true);
    setAssetLibraryError(null);
    try {
      const isRecentOutputSource = source === 'recent';
      const assetUrl = isRecentOutputSource
        ? `/api/media-library/recent-outputs?limit=60&kind=${encodeURIComponent(kind)}`
        : source === 'all'
          ? `/api/media-library/assets?limit=60&kind=${encodeURIComponent(kind)}`
          : `/api/media-library/assets?limit=60&kind=${encodeURIComponent(kind)}&source=${encodeURIComponent(source)}`;

      const assetResponse = await authFetch(assetUrl);
      if (assetResponse.status === 401) {
        setAssetLibrary([]);
        setAssetLibraryError(
          kind === 'video' ? 'Sign in to access your video library.' : 'Sign in to access your image library.'
        );
        setAssetLibraryLoadedKey(requestKey);
        return;
      }
      const payload = await assetResponse.json().catch(() => null);
      if (!assetResponse.ok || !payload?.ok) {
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : kind === 'video'
              ? 'Failed to load videos'
              : 'Failed to load images';
        throw new Error(message);
      }
      const rawItems = isRecentOutputSource ? payload.outputs : payload.assets;
      const assets = Array.isArray(rawItems)
        ? (rawItems as Array<Omit<UserAsset, 'canDelete'> & { thumbUrl?: string | null; sourceOutputId?: string | null; jobId?: string | null }>).map((asset) => {
            const mime = asset.mime ?? null;
            return {
              id: asset.id,
              url: asset.url,
              kind: mime?.startsWith('video/') ? 'video' : 'image',
              width: asset.width ?? null,
              height: asset.height ?? null,
              size: asset.size ?? null,
              mime,
              source: isRecentOutputSource ? 'recent' : asset.source ?? null,
              createdAt: asset.createdAt,
              canDelete: !isRecentOutputSource,
              jobId: asset.jobId ?? null,
              sourceOutputId: asset.sourceOutputId ?? (isRecentOutputSource ? asset.id : null),
            } satisfies UserAsset;
          })
        : [];
      const filteredUploads = assets.filter((asset) =>
        kind === 'video'
          ? Boolean(asset.mime?.startsWith('video/'))
          : !asset.mime || asset.mime.startsWith('image/')
      );

      const combined = filteredUploads;
      const deduped = combined.filter(
        (asset, index, list) => list.findIndex((entry) => entry.url === asset.url) === index
      );
      setAssetLibrary(deduped);
      setAssetLibraryLoadedKey(requestKey);
    } catch (error) {
      console.error('[assets] failed to load library', error);
      setAssetLibraryError(
        error instanceof Error
          ? error.message
          : kind === 'video'
            ? 'Failed to load videos'
            : 'Failed to load images'
      );
      setAssetLibraryLoadedKey(requestKey);
    } finally {
      setIsAssetLibraryLoading(false);
    }
  }, [assetLibraryKind, assetLibrarySource]);

  useEffect(() => {
    if (!assetPickerTarget || !assetLibraryRequestKey || isAssetLibraryLoading) return;
    if (assetLibraryLoadedKey === assetLibraryRequestKey) return;
    setAssetLibrary([]);
    setAssetLibraryError(null);
    void fetchAssetLibrary({ kind: assetLibraryKind, source: assetLibrarySource });
  }, [
    assetLibraryKind,
    assetLibraryLoadedKey,
    assetLibraryRequestKey,
    assetLibrarySource,
    assetPickerTarget,
    fetchAssetLibrary,
    isAssetLibraryLoading,
  ]);

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
  const getSeedanceFieldBlockedMessage = useCallback(
    (field: EngineInputField) => {
      if (!isUnifiedSeedanceEngineId(form?.engineId)) return null;
      const fieldHasOwnAssets = (inputAssets[field.id] ?? []).some((asset) => asset !== null);
      const blockKey = getSeedanceFieldBlockKey(field.id, inputAssets, fieldHasOwnAssets);
      if (blockKey === 'clearReferences') {
        return workflowCopy.clearReferencesToUseStartEnd;
      }
      if (blockKey === 'clearStartEnd') {
        return workflowCopy.clearStartEndToUseReferences;
      }
      return null;
    },
    [form?.engineId, inputAssets, workflowCopy.clearReferencesToUseStartEnd, workflowCopy.clearStartEndToUseReferences]
  );

  const handleOpenAssetLibrary = useCallback(
    (field: EngineInputField, slotIndex?: number) => {
      const blockedMessage = getSeedanceFieldBlockedMessage(field);
      if (blockedMessage) {
        showNotice(blockedMessage);
        return;
      }
      const nextSource: AssetLibrarySource = field.type === 'video' ? 'recent' : 'all';
      if (nextSource !== assetLibrarySource) {
        setAssetLibrarySource(nextSource);
        setAssetLibrary([]);
        setAssetLibraryError(null);
        setAssetLibraryLoadedKey(null);
      }
      setAssetPickerTarget({ kind: 'field', field, slotIndex });
    },
    [assetLibrarySource, getSeedanceFieldBlockedMessage, showNotice]
  );

  const handleOpenKlingAssetLibrary = useCallback(
    (elementId: string, slot: 'frontal' | 'reference', slotIndex?: number) => {
      if (assetLibrarySource !== 'all') {
        setAssetLibrarySource('all');
        setAssetLibrary([]);
        setAssetLibraryError(null);
        setAssetLibraryLoadedKey(null);
      }
      setAssetPickerTarget({ kind: 'kling', elementId, slot, slotIndex });
    },
    [assetLibrarySource]
  );

  const handleSelectLibraryAsset = useCallback(
    async (field: EngineInputField, asset: UserAsset, slotIndex?: number) => {
      const blockedMessage = getSeedanceFieldBlockedMessage(field);
      if (blockedMessage) {
        showNotice(blockedMessage);
        return;
      }
      if (field.type === 'video' && asset.kind !== 'video') {
        showNotice('This slot requires a video source. Pick a video from the video library or import an MP4/MOV clip.');
        return;
      }
      if (field.type === 'image' && asset.kind !== 'image') {
        showNotice('This slot requires an image source. Pick an image from the library or import one.');
        return;
      }

      let resolvedAsset = asset;

      if (field.type === 'video' && asset.kind === 'video') {
        try {
          const host = new URL(asset.url).host.toLowerCase();
          const shouldMirrorVideo =
            asset.source === 'generated' ||
            asset.source === 'recent' ||
            host === 'fal.media' ||
            host.endsWith('.fal.media');
          if (shouldMirrorVideo) {
            const mirrored = await saveAssetToLibrary({
              url: asset.url,
              label:
                field.label ??
                asset.url.split('/').pop() ??
                'Video',
              source: asset.source === 'recent' ? 'saved_job_output' : asset.source,
              kind: 'video',
              jobId: asset.jobId ?? null,
              sourceOutputId: asset.sourceOutputId ?? null,
            });
            resolvedAsset = {
              ...asset,
              id: mirrored.id,
              url: mirrored.url,
              width: mirrored.width ?? asset.width,
              height: mirrored.height ?? asset.height,
              size: mirrored.size ?? asset.size,
              mime: mirrored.mime ?? asset.mime,
              canDelete: true,
            };
            setAssetLibrary((previous) =>
              previous.map((entry) =>
                entry.id === asset.id || entry.url === asset.url ? resolvedAsset : entry
              )
            );
          }
        } catch (error) {
          console.error('[assets] failed to mirror generated video asset', error);
          showNotice(error instanceof Error ? error.message : 'Unable to prepare this video. Try importing the source clip directly.');
          return;
        }
      }

      if (
        field.type === 'image' &&
        asset.kind === 'image' &&
        asset.source === 'character'
      ) {
        try {
          const host = new URL(asset.url).host.toLowerCase();
          if (host === 'fal.media' || host.endsWith('.fal.media')) {
            const mirrored = await saveImageToLibrary({
              url: asset.url,
              label:
                field.label ??
                asset.url.split('/').pop() ??
                'Image',
              source: asset.source,
            });
            resolvedAsset = {
              ...asset,
              id: mirrored.id,
              url: mirrored.url,
              width: mirrored.width ?? asset.width,
              height: mirrored.height ?? asset.height,
              size: mirrored.size ?? asset.size,
              mime: mirrored.mime ?? asset.mime,
              canDelete: true,
            };
            setAssetLibrary((previous) =>
              previous.map((entry) =>
                entry.id === asset.id || entry.url === asset.url ? resolvedAsset : entry
              )
            );
          }
        } catch (error) {
          console.error('[assets] failed to mirror character library asset', error);
          showNotice(error instanceof Error ? error.message : 'Unable to prepare this character asset. Try another image.');
          return;
        }
      }

      const newAsset: ReferenceAsset = {
        id: resolvedAsset.id || `library_${Date.now().toString(36)}`,
        fieldId: field.id,
        previewUrl: resolvedAsset.url,
        kind: field.type === 'video' ? 'video' : field.type === 'audio' ? 'audio' : 'image',
        name:
          resolvedAsset.url.split('/').pop() ??
          (field.type === 'video' ? 'Video' : field.type === 'audio' ? 'Audio' : 'Image'),
        size: resolvedAsset.size ?? 0,
        type:
          resolvedAsset.mime ??
          (field.type === 'video' ? 'video/*' : field.type === 'audio' ? 'audio/*' : 'image/*'),
        url: resolvedAsset.url,
        width: resolvedAsset.width ?? null,
        height: resolvedAsset.height ?? null,
        assetId: resolvedAsset.id,
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
            showNotice(`Maximum ${field.label ?? 'reference image'} count reached for this engine.`);
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
    [getSeedanceFieldBlockedMessage, showNotice]
  );

  const handleSelectKlingLibraryAsset = useCallback(
    (target: Extract<AssetPickerTarget, { kind: 'kling' }>, asset: UserAsset) => {
      const newAsset: KlingElementAsset = {
        id: asset.id || `library_${Date.now().toString(36)}`,
        previewUrl: asset.url,
        kind: 'image',
        name: asset.url.split('/').pop() ?? 'Image',
        status: 'ready',
        url: asset.url,
      };

      setKlingElements((previous) =>
        previous.map((element) => {
          if (element.id !== target.elementId) return element;

          if (target.slot === 'frontal') {
            revokeKlingAssetPreview(element.frontal);
            return { ...element, frontal: newAsset };
          }

          const references = [...element.references];
          let targetIndex = typeof target.slotIndex === 'number' ? target.slotIndex : references.findIndex((entry) => entry === null);
          if (targetIndex < 0) {
            targetIndex = references.length > 0 ? references.length - 1 : 0;
          }
          if (targetIndex >= references.length) {
            return element;
          }
          revokeKlingAssetPreview(references[targetIndex]);
          references[targetIndex] = newAsset;
          return { ...element, references };
        })
      );

      setAssetPickerTarget(null);
    },
    []
  );

  const handleAssetAdd = useCallback(
    (field: EngineInputField, file: File, slotIndex?: number, meta?: { durationSec?: number }) => {
      const blockedMessage = getSeedanceFieldBlockedMessage(field);
      if (blockedMessage) {
        showNotice(blockedMessage);
        return;
      }
      const assetId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);
      const baseAsset: ReferenceAsset = {
        id: assetId,
        fieldId: field.id,
        previewUrl,
        kind: field.type === 'video' ? 'video' : field.type === 'audio' ? 'audio' : 'image',
        name: file.name,
        size: file.size,
        type: file.type,
        durationSec: typeof meta?.durationSec === 'number' ? meta.durationSec : null,
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
          const preparedFile =
            field.type === 'image'
              ? await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 })
              : file;
          const formData = new FormData();
          formData.append('file', preparedFile, preparedFile.name);
          const uploadEndpoint =
            field.type === 'video'
              ? '/api/uploads/video'
              : field.type === 'audio'
                ? '/api/uploads/audio'
                : '/api/uploads/image';
          const uploadAssetType: UploadableAssetKind =
            field.type === 'video' ? 'video' : field.type === 'audio' ? 'audio' : 'image';
          const response = await authFetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.ok) {
            throw createUploadFailure(uploadAssetType, response.status, payload, 'Upload failed');
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
          const uploadAssetType: UploadableAssetKind =
            field.type === 'video' ? 'video' : field.type === 'audio' ? 'audio' : 'image';
          const message = getUploadFailureMessage(uploadAssetType, error, 'Upload failed');
          const uploadError = error as UploadFailure;
          console.error(
            '[assets] upload failed',
            {
              fieldId: field.id,
              assetType: uploadAssetType,
              status: uploadError?.status ?? null,
              code: uploadError?.code ?? null,
              maxMB: uploadError?.maxMB ?? null,
              message,
            },
            error
          );
          setInputAssets((previous) => {
            const current = previous[field.id];
            if (!current) return previous;
            const next = current.map((entry) => {
              if (!entry || entry.id !== assetId) return entry;
              return {
                ...entry,
                status: 'error' as const,
                error: message,
              };
            });
            return { ...previous, [field.id]: next };
          });
          showNotice?.(message);
        }
      };

      void upload();
    },
    [getSeedanceFieldBlockedMessage, showNotice]
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

  const handleMultiPromptAddScene = useCallback(() => {
    setMultiPromptScenes((previous) => [...previous, createMultiPromptScene()]);
  }, []);

  const handleMultiPromptRemoveScene = useCallback((id: string) => {
    setMultiPromptScenes((previous) => {
      const next = previous.filter((scene) => scene.id !== id);
      return next.length ? next : [createMultiPromptScene()];
    });
  }, []);

  const handleMultiPromptUpdateScene = useCallback(
    (id: string, patch: Partial<Pick<MultiPromptScene, 'prompt' | 'duration'>>) => {
      setMultiPromptScenes((previous) =>
        previous.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene))
      );
    },
    []
  );

  const handleSeedChange = useCallback((value: string) => {
    setForm((current) => {
      if (!current) return current;
      const trimmed = value.trim();
      if (!trimmed) {
        return { ...current, seed: null };
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return current;
      return { ...current, seed: Math.trunc(parsed) };
    });
  }, []);

  const handleCameraFixedChange = useCallback((value: boolean) => {
    setForm((current) => (current ? { ...current, cameraFixed: value } : current));
  }, []);

  const handleSafetyCheckerChange = useCallback((value: boolean) => {
    setForm((current) => (current ? { ...current, safetyChecker: value } : current));
  }, []);

  const handleKlingElementAdd = useCallback(() => {
    setKlingElements((previous) => [...previous, createKlingElement()]);
  }, []);

  const handleKlingElementRemove = useCallback((id: string) => {
    setKlingElements((previous) => {
      const next = previous.filter((element) => element.id !== id);
      return next.length ? next : [createKlingElement()];
    });
  }, []);

  const handleKlingElementAssetRemove = useCallback(
    (elementId: string, slot: 'frontal' | 'reference' | 'video', index?: number) => {
      setKlingElements((previous) =>
        previous.map((element) => {
          if (element.id !== elementId) return element;
          if (slot === 'frontal') {
            revokeKlingAssetPreview(element.frontal);
            return { ...element, frontal: null };
          }
          if (slot === 'video') {
            revokeKlingAssetPreview(element.video);
            return { ...element, video: null };
          }
          const references = [...element.references];
          if (typeof index === 'number' && index >= 0 && index < references.length) {
            revokeKlingAssetPreview(references[index]);
            references[index] = null;
          }
          return { ...element, references };
        })
      );
    },
    []
  );

  const handleKlingElementAssetAdd = useCallback(
    (elementId: string, slot: 'frontal' | 'reference' | 'video', file: File, index?: number) => {
      const assetId = createLocalId('element_asset');
      const previewUrl = URL.createObjectURL(file);
      const baseAsset: KlingElementAsset = {
        id: assetId,
        previewUrl,
        name: file.name,
        kind: slot === 'video' ? 'video' : 'image',
        status: 'uploading' as const,
        url: undefined as string | undefined,
      };

      setKlingElements((previous) =>
        previous.map((element) => {
          if (element.id !== elementId) return element;
          if (slot === 'frontal') {
            revokeKlingAssetPreview(element.frontal);
            return { ...element, frontal: baseAsset };
          }
          if (slot === 'video') {
            revokeKlingAssetPreview(element.video);
            return { ...element, video: baseAsset };
          }
          const references = [...element.references];
          let targetIndex = typeof index === 'number' ? index : references.findIndex((entry) => entry === null);
          if (targetIndex < 0) {
            targetIndex = references.length;
          }
          if (targetIndex >= references.length) {
            return element;
          }
          revokeKlingAssetPreview(references[targetIndex]);
          references[targetIndex] = baseAsset;
          return { ...element, references };
        })
      );

      const upload = async () => {
        try {
          const preparedFile =
            slot === 'video'
              ? file
              : await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 });
          const formData = new FormData();
          formData.append('file', preparedFile, preparedFile.name);
          const uploadEndpoint = slot === 'video' ? '/api/uploads/video' : '/api/uploads/image';
          const response = await authFetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.ok) {
            throw createUploadFailure(slot === 'video' ? 'video' : 'image', response.status, payload, 'Upload failed');
          }
          const assetResponse = payload.asset as {
            id: string;
            url: string;
            name?: string;
          };
          setKlingElements((previous) =>
            previous.map((element) => {
              if (element.id !== elementId) return element;
              const updateAsset = (asset: typeof baseAsset | null) => {
                if (!asset || asset.id !== assetId) return asset;
                if (asset.previewUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(asset.previewUrl);
                }
                return {
                  ...asset,
                  status: 'ready' as const,
                  url: assetResponse.url,
                  previewUrl: assetResponse.url || asset.previewUrl,
                  name: assetResponse.name ?? asset.name,
                };
              };
              if (slot === 'frontal') {
                return { ...element, frontal: updateAsset(element.frontal) };
              }
              if (slot === 'video') {
                return { ...element, video: updateAsset(element.video) };
              }
              const references = element.references.map((asset) => updateAsset(asset));
              return { ...element, references };
            })
          );
        } catch (error) {
          const assetType = slot === 'video' ? 'video' : 'image';
          const message = getUploadFailureMessage(assetType, error, 'Upload failed.');
          const uploadError = error as UploadFailure;
          console.error(
            '[kling-assets] upload failed',
            {
              elementId,
              slot,
              assetType,
              status: uploadError?.status ?? null,
              code: uploadError?.code ?? null,
              maxMB: uploadError?.maxMB ?? null,
              message,
            },
            error
          );
          setKlingElements((previous) =>
            previous.map((element) => {
              if (element.id !== elementId) return element;
              const markError = (asset: typeof baseAsset | null) => {
                if (!asset || asset.id !== assetId) return asset;
                return { ...asset, status: 'error' as const, error: message };
              };
              if (slot === 'frontal') return { ...element, frontal: markError(element.frontal) };
              if (slot === 'video') return { ...element, video: markError(element.video) };
              const references = element.references.map((asset) => markError(asset));
              return { ...element, references };
            })
          );
          showNotice?.(message);
        }
      };

      void upload();
    },
    [showNotice]
  );

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
        const video = normalizeSharedVideoPayload(json.video as SharedVideoPayload);
        const overrideGroup = mapSharedVideoToGroup(video, provider);
        setCompositeOverride(overrideGroup);
        setCompositeOverrideSummary(null);
        setSharedPrompt(video.prompt ?? video.promptExcerpt ?? null);
        setSharedVideoSettings(video);
        setSelectedPreview({
          id: video.id,
          videoUrl: video.videoUrl ?? undefined,
          previewVideoUrl: video.previewVideoUrl ?? undefined,
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
      setSharedVideoSettings(null);
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
    if (effectiveRequestedEngineId || effectiveRequestedEngineToken) return;
    if (hasStoredFormRef.current) return;
    const storedPreviewJobId = (readScopedStorage(STORAGE_KEYS.previewJobId) ?? '').trim();
    if (storedPreviewJobId.startsWith('job_')) return;
    const latestJobWithMedia = recentJobs.find((job) => job.thumbUrl || job.videoUrl);
    if (!latestJobWithMedia) return;
    setSelectedPreview({
      id: latestJobWithMedia.jobId,
      videoUrl: latestJobWithMedia.videoUrl ?? undefined,
      previewVideoUrl: latestJobWithMedia.previewVideoUrl ?? undefined,
      aspectRatio: latestJobWithMedia.aspectRatio ?? undefined,
      thumbUrl: latestJobWithMedia.thumbUrl ?? undefined,
      priceCents: latestJobWithMedia.finalPriceCents ?? latestJobWithMedia.pricingSnapshot?.totalCents,
      currency: latestJobWithMedia.currency ?? latestJobWithMedia.pricingSnapshot?.currency,
      prompt: latestJobWithMedia.prompt ?? undefined,
    });
  }, [effectiveRequestedEngineId, effectiveRequestedEngineToken, readScopedStorage, recentJobs, renders.length, selectedPreview]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authChecked) return;
    if (!engines.length) return;
    if (hydratedForScope !== storageScope) return;
    if (effectiveRequestedEngineId || effectiveRequestedEngineToken) return;
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
              previewVideoUrl?: string;
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
        const previewVideoUrl =
          typeof payload.previewVideoUrl === 'string' && payload.previewVideoUrl.length
            ? payload.previewVideoUrl
            : undefined;
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
              previewVideoUrl,
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
          previewVideoUrl,
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
    effectiveRequestedEngineId,
    effectiveRequestedEngineToken,
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
    if (!effectiveRequestedEngineToken) return null;
    if (!engines.length) return null;
    if (hasStoredFormRef.current) return null;
    return (
      engines.find((engine) => matchesEngineToken(engine, effectiveRequestedEngineToken)) ?? null
    );
  }, [engines, effectiveRequestedEngineToken]);

  const selectedEngine = useMemo<EngineCaps | null>(() => {
    if (!engines.length) return null;
    if (engineOverride) return engineOverride;
    if (form && engines.some((engine) => engine.id === form.engineId)) {
      return engines.find((engine) => engine.id === form.engineId) ?? engines[0];
    }
    return engines[0];
  }, [engines, form, engineOverride]);

  const supportsKlingV3Controls =
    selectedEngine?.id === 'kling-3-pro' ||
    selectedEngine?.id === 'kling-3-standard' ||
    selectedEngine?.id === 'kling-3-4k';
  const supportsKlingV3VoiceControl =
    selectedEngine?.id === 'kling-3-pro' || selectedEngine?.id === 'kling-3-standard';
  const isSeedance = selectedEngine?.id === 'seedance-1-5-pro';
  const isUnifiedSeedance = isUnifiedSeedanceEngineId(selectedEngine?.id);
  const isUnifiedHappyHorse = isHappyHorseEngineId(selectedEngine?.id);
  const multiPromptTotalSec = useMemo(
    () => multiPromptScenes.reduce((sum, scene) => sum + (scene.duration || 0), 0),
    [multiPromptScenes]
  );
  const multiPromptActive = Boolean(supportsKlingV3Controls && multiPromptEnabled);
  const multiPromptInvalid = multiPromptActive
    ? multiPromptScenes.length === 0 ||
      multiPromptScenes.some((scene) => !scene.prompt.trim()) ||
      multiPromptTotalSec < MULTI_PROMPT_MIN_SEC ||
      multiPromptTotalSec > MULTI_PROMPT_MAX_SEC
    : false;
  const voiceIds = useMemo(
    () =>
      voiceIdsInput
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    [voiceIdsInput]
  );
  const voiceControlEnabled = Boolean(supportsKlingV3VoiceControl && voiceIds.length);
  const promptMaxChars = !multiPromptActive ? (selectedEngine?.inputLimits.promptMaxChars ?? null) : null;
  const promptCharLimitExceeded = typeof promptMaxChars === 'number' && prompt.length > promptMaxChars;
  const seedValue =
    typeof form?.seed === 'number' && Number.isFinite(form.seed) ? String(form.seed) : '';
  const cameraFixedValue = typeof form?.cameraFixed === 'boolean' ? form.cameraFixed : false;
  const safetyCheckerValue = typeof form?.safetyChecker === 'boolean' ? form.safetyChecker : true;
  const effectivePrompt = multiPromptActive ? buildMultiPromptSummary(multiPromptScenes) : prompt;
  const primaryAudioDurationSec = useMemo(() => {
    for (const entries of Object.values(inputAssets)) {
      for (const asset of entries) {
        if (asset?.kind === 'audio' && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec)) {
          return Math.max(1, Math.round(asset.durationSec));
        }
      }
    }
    return null;
  }, [inputAssets]);
  const primaryVideoDurationSec = useMemo(() => {
    for (const fieldId of PRIMARY_VIDEO_SLOT_IDS) {
      const entries = inputAssets[fieldId] ?? [];
      for (const asset of entries) {
        if (asset?.kind === 'video' && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec)) {
          return Math.max(1, Math.round(asset.durationSec));
        }
      }
    }
    return null;
  }, [inputAssets]);
  const multiPromptError = multiPromptInvalid
    ? `Multi-prompt requires a prompt per scene and total duration between ${MULTI_PROMPT_MIN_SEC}s and ${MULTI_PROMPT_MAX_SEC}s.`
    : null;

  useEffect(() => {
    if (!supportsKlingV3Controls && multiPromptEnabled) {
      setMultiPromptEnabled(false);
    }
  }, [supportsKlingV3Controls, multiPromptEnabled]);

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
    if (UNIFIED_SEEDANCE_ENGINE_IDS.has(selectedEngine.id)) {
      return undefined;
    }
    if (selectedEngine.id === 'veo-3-1') {
      const order: Mode[] = ['ref2v', 'extend'];
      const available = order.filter((value) => selectedEngine.modes.includes(value));
      return available.length ? available : undefined;
    }
    if (selectedEngine.id === 'veo-3-1-fast') {
      const order: Mode[] = ['extend'];
      const available = order.filter((value) => selectedEngine.modes.includes(value));
      return available.length ? available : undefined;
    }
    if (selectedEngine.id === 'veo-3-1-lite') {
      return undefined;
    }
    if (selectedEngine.id === 'ltx-2-3') {
      const order: Mode[] = ['extend', 'retake'];
      const available = order.filter((value) => selectedEngine.modes.includes(value));
      return available.length ? available : undefined;
    }
    const preferredOrder: Mode[] = ['t2v', 'i2v', 'v2v', 'reframe', 'ref2v', 'fl2v', 'a2v', 'extend', 'retake', 'r2v', 'i2i'];
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
        const snapshotMode: Mode = isModeValue(snapshotModeRaw) ? snapshotModeRaw : getPreferredEngineMode(engine);
        const mode = engine.modes.includes(snapshotMode) ? snapshotMode : getPreferredEngineMode(engine);

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
        const extraInputValues = coerceStoredExtraInputValues(advanced.extraInputValues) ?? {};
        const cfgScaleValue =
          typeof advanced.cfgScale === 'number' && Number.isFinite(advanced.cfgScale) ? advanced.cfgScale : null;
        if (cfgScaleValue !== null) {
          setCfgScale(cfgScaleValue);
        }
        const loopValue = typeof advanced.loop === 'boolean' ? advanced.loop : undefined;
        const seedValue =
          typeof advanced.seed === 'number' && Number.isFinite(advanced.seed) ? Math.trunc(advanced.seed) : null;
        const cameraFixedValue = typeof advanced.cameraFixed === 'boolean' ? advanced.cameraFixed : undefined;
        const safetyCheckerValue = typeof advanced.safetyChecker === 'boolean' ? advanced.safetyChecker : undefined;
        const shotTypeRaw = typeof advanced.shotType === 'string' ? advanced.shotType.trim().toLowerCase() : '';
        if (shotTypeRaw === 'customize' || shotTypeRaw === 'intelligent') {
          setShotType(shotTypeRaw);
        }

        const voiceIdsRaw = advanced.voiceIds;
        const voiceIdsList = Array.isArray(voiceIdsRaw)
          ? voiceIdsRaw
              .map((value) => (typeof value === 'string' ? value.trim() : ''))
              .filter((value): value is string => value.length > 0)
          : typeof voiceIdsRaw === 'string'
            ? voiceIdsRaw
                .split(',')
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
            : [];
        setVoiceIdsInput(voiceIdsList.join(', '));

        const multiPromptRaw = Array.isArray(advanced.multiPrompt) ? advanced.multiPrompt : null;
        const multiPromptScenesValue = multiPromptRaw
          ? multiPromptRaw
              .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                const record = entry as Record<string, unknown>;
                const scenePrompt = typeof record.prompt === 'string' ? record.prompt : '';
                const sceneDuration =
                  typeof record.duration === 'number'
                    ? Math.round(record.duration)
                    : typeof record.duration === 'string'
                      ? Math.round(Number(record.duration.replace(/[^\d.]/g, '')))
                      : 0;
                if (!scenePrompt.trim()) return null;
                return {
                  id: createLocalId('scene'),
                  prompt: scenePrompt,
                  duration: sceneDuration || MULTI_PROMPT_MIN_SEC,
                };
              })
              .filter((scene): scene is MultiPromptScene => Boolean(scene))
          : null;
        if (multiPromptScenesValue && multiPromptScenesValue.length) {
          setMultiPromptEnabled(true);
          setMultiPromptScenes(multiPromptScenesValue);
        } else {
          setMultiPromptEnabled(false);
          setMultiPromptScenes([createMultiPromptScene()]);
        }

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
            seed: seedValue ?? previous?.seed ?? null,
            cameraFixed:
              typeof cameraFixedValue === 'boolean'
                ? cameraFixedValue
                : previous?.cameraFixed ?? resolveBooleanFieldDefault(engine, mode, 'camera_fixed', false),
            safetyChecker:
              typeof safetyCheckerValue === 'boolean'
                ? safetyCheckerValue
                : previous?.safetyChecker ?? resolveBooleanFieldDefault(engine, mode, 'enable_safety_checker', true),
            extraInputValues,
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
                const kind = attachment.kind === 'video' ? 'video' : attachment.kind === 'audio' ? 'audio' : 'image';
                const name = typeof attachment.name === 'string' ? attachment.name : `${kind}-${index + 1}`;
                const type =
                  typeof attachment.type === 'string'
                    ? attachment.type
                    : kind === 'image'
                      ? 'image/*'
                      : kind === 'audio'
                        ? 'audio/*'
                        : 'video/*';
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

        const elementsRaw = refs.elements;
        if (elementsRaw === null || Array.isArray(elementsRaw)) {
          const buildKlingAssetFromUrl = (url: string, kind: 'image' | 'video', index: number): KlingElementAsset => ({
            id: createLocalId(`kling_${kind}`),
            previewUrl: url,
            name: url.split('/').pop() ?? `${kind}-${index + 1}`,
            kind,
            status: 'ready',
            url,
          });
          const parsedElements = Array.isArray(elementsRaw)
            ? elementsRaw
                .map((entry, elementIndex) => {
                  if (!entry || typeof entry !== 'object') return null;
                  const record = entry as Record<string, unknown>;
                  const frontalUrl =
                    typeof record.frontalImageUrl === 'string' && record.frontalImageUrl.trim().length
                      ? record.frontalImageUrl.trim()
                      : null;
                  const referenceUrls = Array.isArray(record.referenceImageUrls)
                    ? record.referenceImageUrls
                        .map((value: unknown) => (typeof value === 'string' ? value.trim() : ''))
                        .filter((value): value is string => value.length > 0)
                        .slice(0, 3)
                    : [];
                  const videoUrl =
                    typeof record.videoUrl === 'string' && record.videoUrl.trim().length ? record.videoUrl.trim() : null;
                  if (!frontalUrl && referenceUrls.length === 0 && !videoUrl) return null;
                  const references = Array.from({ length: 3 }, (_, index) =>
                    referenceUrls[index] ? buildKlingAssetFromUrl(referenceUrls[index], 'image', index) : null
                  );
                  return {
                    id: createLocalId(`element_${elementIndex}`),
                    frontal: frontalUrl ? buildKlingAssetFromUrl(frontalUrl, 'image', 0) : null,
                    references,
                    video: videoUrl ? buildKlingAssetFromUrl(videoUrl, 'video', 0) : null,
                  } as KlingElementState;
                })
                .filter((element): element is KlingElementState => Boolean(element))
            : [];
          const nextElements = parsedElements.length ? parsedElements : [createKlingElement()];
          setKlingElements((previous) => {
            previous.forEach((element) => {
              revokeKlingAssetPreview(element.frontal);
              element.references.forEach((asset) => revokeKlingAssetPreview(asset));
              revokeKlingAssetPreview(element.video);
            });
            return nextElements;
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
          | {
              ok?: boolean;
              settingsSnapshot?: unknown;
              videoUrl?: string;
              previewVideoUrl?: string;
              thumbUrl?: string;
              aspectRatio?: string;
              progress?: number;
              status?: string;
            }
          | null;
        if (!payload?.ok) return;
        if (payload.settingsSnapshot) {
          applyVideoSettingsSnapshot(payload.settingsSnapshot);
        }

        const nextVideoUrl = typeof payload.videoUrl === 'string' && payload.videoUrl.length ? payload.videoUrl : null;
        const nextPreviewVideoUrl =
          typeof payload.previewVideoUrl === 'string' && payload.previewVideoUrl.length ? payload.previewVideoUrl : null;
        const nextThumbUrl = typeof payload.thumbUrl === 'string' && payload.thumbUrl.length ? payload.thumbUrl : null;
        if (!nextVideoUrl && !nextThumbUrl) return;

        setSelectedPreview((current) => {
          if (!current || (current.id !== jobId && current.localKey !== jobId)) return current;
          return {
            ...current,
            videoUrl: nextVideoUrl ?? current.videoUrl,
            previewVideoUrl: nextPreviewVideoUrl ?? current.previewVideoUrl,
            thumbUrl: nextThumbUrl ?? current.thumbUrl,
            aspectRatio: payload.aspectRatio ?? current.aspectRatio,
            progress: typeof payload.progress === 'number' ? payload.progress : current.progress,
            status: payload.status === 'failed' ? 'failed' : payload.status === 'pending' ? 'pending' : current.status,
          };
        });

        setCompositeOverride((current) => {
          if (!current) return current;
          let changed = false;
          const items = current.items.map((item) => {
            if (item.id !== jobId && item.jobId !== jobId) return item;
            changed = true;
            return {
              ...item,
              url: nextVideoUrl ?? item.url,
              previewUrl: nextPreviewVideoUrl ?? item.previewUrl,
              thumb: nextThumbUrl ?? item.thumb,
              aspect: payload.aspectRatio === '9:16' || payload.aspectRatio === '1:1' ? payload.aspectRatio : item.aspect,
            };
          });
          return changed ? { ...current, items } : current;
        });
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
    if (!sharedVideoSettings) return;
    const durationSec =
      typeof sharedVideoSettings.durationSec === 'number' && sharedVideoSettings.durationSec > 0
        ? sharedVideoSettings.durationSec
        : null;
    const aspectRatio =
      typeof sharedVideoSettings.aspectRatio === 'string' && sharedVideoSettings.aspectRatio.trim().length
        ? sharedVideoSettings.aspectRatio.trim()
        : '16:9';
    const promptValue = sharedVideoSettings.prompt ?? sharedVideoSettings.promptExcerpt ?? '';
    applyVideoSettingsSnapshot({
      schemaVersion: 1,
      surface: 'video',
      engineId: sharedVideoSettings.engineId,
      engineLabel: sharedVideoSettings.engineLabel,
      inputMode: 't2v',
      prompt: promptValue,
      negativePrompt: null,
      core: {
        durationSec,
        durationOption: null,
        numFrames: null,
        aspectRatio,
        resolution: null,
        fps: null,
        iterationCount: 1,
        audio: null,
      },
      advanced: { cfgScale: null, loop: null },
      refs: { imageUrl: null, referenceImages: null, firstFrameUrl: null, lastFrameUrl: null, inputs: null },
      meta: { derived: true },
    });
    void hydrateVideoSettingsFromJob(sharedVideoSettings.id);
  }, [applyVideoSettingsSnapshot, hydrateVideoSettingsFromJob, sharedVideoSettings]);

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
              previewVideoUrl?: string;
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
          const previewVideoUrl =
            typeof payload.previewVideoUrl === 'string' && payload.previewVideoUrl.length
              ? payload.previewVideoUrl
              : undefined;
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
                  previewVideoUrl,
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
              previewVideoUrl,
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

  const referenceInputStatus = useMemo(() => {
    let hasImage = false;
    let hasVideo = false;
    let hasAudio = false;
    Object.values(inputAssets).forEach((entries) => {
      entries.forEach((asset) => {
        if (!asset) return;
        if (asset.kind === 'image') {
          hasImage = true;
        }
        if (asset.kind === 'video') {
          hasVideo = true;
        }
        if (asset.kind === 'audio') {
          hasAudio = true;
        }
      });
    });
    return { hasImage, hasVideo, hasAudio };
  }, [inputAssets]);
  const seedanceAssetState = useMemo(() => getSeedanceAssetState(inputAssets), [inputAssets]);
  const hasPrimaryImageInput = useMemo(() => {
    return PRIMARY_IMAGE_SLOT_IDS.some((fieldId) =>
      (inputAssets[fieldId] ?? []).some((asset) => asset?.kind === 'image')
    );
  }, [inputAssets]);
  const hasLastFrameInput = useMemo(() => {
    return (inputAssets['last_frame_url'] ?? []).some((asset) => asset?.kind === 'image');
  }, [inputAssets]);

  const implicitMode = useMemo<Mode>(() => {
    if (!selectedEngine) return form?.mode ?? 't2v';
    if (isUnifiedSeedance) {
      return getUnifiedSeedanceMode(inputAssets);
    }
    if (isUnifiedHappyHorse && (form?.mode === 't2v' || !form?.mode)) {
      return getUnifiedHappyHorseMode(inputAssets);
    }
    const modes = selectedEngine.modes;
    if (referenceInputStatus.hasAudio && modes.includes('a2v')) return 'a2v';
    if (referenceInputStatus.hasVideo && modes.includes('v2v')) return 'v2v';
    if (referenceInputStatus.hasVideo && modes.includes('r2v')) return 'r2v';
    if (referenceInputStatus.hasVideo && modes.includes('reframe')) return 'reframe';
    if (referenceInputStatus.hasImage && modes.includes('i2v')) return 'i2v';
    if (modes.includes('t2v')) return 't2v';
    return modes[0] ?? 't2v';
  }, [form?.mode, inputAssets, isUnifiedHappyHorse, isUnifiedSeedance, referenceInputStatus.hasAudio, referenceInputStatus.hasImage, referenceInputStatus.hasVideo, selectedEngine]);

  const audioToVideoSupported = Boolean(selectedEngine?.modes.includes('a2v'));
  const audioWorkflowLocked = referenceInputStatus.hasAudio && audioToVideoSupported;
  const audioWorkflowUnsupported =
    referenceInputStatus.hasAudio &&
    Boolean(selectedEngine) &&
    !audioToVideoSupported &&
    !(isUnifiedSeedance && seedanceAssetState.hasReferenceAudio);

  const activeManualMode = useMemo<Mode | null>(() => {
    if (!selectedEngine) return null;
    if (isUnifiedSeedance) return null;
    if (referenceInputStatus.hasAudio && !isUnifiedSeedance) return null;
    const currentMode = form?.mode ?? null;
    if (
      (currentMode === 'v2v' ||
        currentMode === 'reframe' ||
        currentMode === 'ref2v' ||
        currentMode === 'extend' ||
        currentMode === 'retake') &&
        selectedEngine.modes.includes(currentMode)
    ) {
      return currentMode;
    }
    return null;
  }, [form?.mode, isUnifiedSeedance, referenceInputStatus.hasAudio, selectedEngine]);

  const activeMode: Mode = activeManualMode ?? implicitMode;
  const allowsUnifiedVeoFirstLast = useMemo(() => {
    return Boolean(
      selectedEngine &&
        UNIFIED_VEO_FIRST_LAST_ENGINE_IDS.has(selectedEngine.id) &&
        activeManualMode === null &&
        (activeMode === 't2v' || activeMode === 'i2v')
    );
  }, [activeManualMode, activeMode, selectedEngine]);
  const submissionMode = useMemo<Mode>(() => {
    if (allowsUnifiedVeoFirstLast && hasPrimaryImageInput && hasLastFrameInput) {
      return 'fl2v';
    }
    return activeMode;
  }, [activeMode, allowsUnifiedVeoFirstLast, hasLastFrameInput, hasPrimaryImageInput]);
  const showSafetyCheckerControl = useMemo(() => {
    const schema = selectedEngine?.inputSchema;
    if (!schema) return false;
    return [...(schema.required ?? []), ...(schema.optional ?? [])].some((field) => {
      if (field.id !== 'enable_safety_checker') return false;
      return !field.modes || field.modes.includes(submissionMode);
    });
  }, [selectedEngine, submissionMode]);
  const effectiveDurationSec = useMemo(() => {
    if (multiPromptActive) return multiPromptTotalSec;
    if (submissionMode === 'a2v' && typeof primaryAudioDurationSec === 'number') return primaryAudioDurationSec;
    if ((submissionMode === 'v2v' || submissionMode === 'reframe') && typeof primaryVideoDurationSec === 'number') {
      return primaryVideoDurationSec;
    }
    return form?.durationSec ?? 0;
  }, [multiPromptActive, multiPromptTotalSec, submissionMode, primaryAudioDurationSec, primaryVideoDurationSec, form?.durationSec]);

  useEffect(() => {
    if (!selectedEngine || !form) return;
    if (activeManualMode) return;
    if (form.mode === implicitMode) return;
    setForm((current) => {
      if (!current || current.mode === implicitMode) return current;
      return coerceFormState(selectedEngine, implicitMode, { ...current, mode: implicitMode });
    });
  }, [activeManualMode, form, implicitMode, selectedEngine, setForm]);

  useEffect(() => {
    if (!supportsKlingV3Controls) return;
    if (activeMode !== 'i2v') return;
    if (shotType !== 'customize') {
      setShotType('customize');
    }
  }, [activeMode, supportsKlingV3Controls, shotType]);

  const capability = useMemo(() => {
    if (!selectedEngine) return undefined;
    return getModeCaps(selectedEngine, submissionMode);
  }, [selectedEngine, submissionMode]);

  const generateAudioField = useMemo(() => {
    if (!selectedEngine) return null;
    return findGenerateAudioField(selectedEngine, submissionMode);
  }, [selectedEngine, submissionMode]);

  const supportsAudioToggle =
    Boolean(selectedEngine && capability?.audioToggle && generateAudioField && supportsAudioPricingToggle(selectedEngine));

  useEffect(() => {
    if (!voiceControlEnabled) return;
    setForm((current) => {
      if (!current || current.audio) return current;
      return { ...current, audio: true };
    });
  }, [voiceControlEnabled]);

  const handleEngineChange = useCallback(
    (engineId: string) => {
      const nextEngine = engines.find((entry) => entry.id === engineId);
      if (!nextEngine) return;
      requestedEngineOverrideIdRef.current = null;
      requestedEngineOverrideTokenRef.current = null;
      requestedModeOverrideRef.current = null;
      preserveStoredDraftRef.current = false;
      setForm((current) => {
        const candidate = current ?? null;
        const nextMode = getPreferredEngineMode(nextEngine, candidate?.mode ?? null);
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
      const preferredMode = getPreferredEngineMode(engineOverride, candidate?.mode ?? null);
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
    const pinnedToken = requestedEngineOverrideTokenRef.current;
    if (!pinnedToken) return;
    if (!authChecked) return;
    if (hydratedForScope !== storageScope) return;
    if (!selectedEngine) return;
    if (matchesEngineToken(selectedEngine, pinnedToken)) return;
    const pinnedEngine = engines.find((engine) => matchesEngineToken(engine, pinnedToken));
    if (!pinnedEngine) return;
    setForm((current) => {
      const candidate = current ?? null;
      const nextMode = getPreferredEngineMode(pinnedEngine, candidate?.mode ?? null);
      const normalizedPrevious = candidate ? { ...candidate, engineId: pinnedEngine.id, mode: nextMode } : null;
      return coerceFormState(pinnedEngine, nextMode, normalizedPrevious);
    });
  }, [authChecked, hydratedForScope, storageScope, selectedEngine, engines]);

  const handleModeChange = useCallback(
    (mode: Mode) => {
      if (!selectedEngine) return;
      const nextMode = getPreferredEngineMode(selectedEngine, mode);
      setForm((current) => coerceFormState(selectedEngine, nextMode, current ? { ...current, mode: nextMode } : null));
    },
    [selectedEngine]
  );

  const composerModeToggles = useMemo(() => {
    if (!selectedEngine) return undefined;
    const explicitModes =
      isLumaRay2EngineId(selectedEngine.id)
        ? (['v2v', 'reframe'] as const)
        : selectedEngine.id === 'ltx-2-3'
        ? (['extend'] as const)
        : selectedEngine.id === 'veo-3-1'
          ? (['ref2v', 'extend'] as const)
          : selectedEngine.id === 'veo-3-1-fast'
            ? (['extend'] as const)
            : selectedEngine.id === 'veo-3-1-lite'
              ? ([] as const)
            : UNIFIED_SEEDANCE_ENGINE_IDS.has(selectedEngine.id)
              ? ([] as const)
              : null;
    if (!explicitModes) return undefined;
    const disabledReason = audioWorkflowLocked
      ? workflowCopy.removeAudioToUnlock
      : undefined;
    return [
      { mode: null, label: workflowCopy.generateVideo },
      ...explicitModes
        .filter((mode) => selectedEngine.modes.includes(mode))
        .map((mode) => ({
          mode,
          label: getEngineModeLabel(selectedEngine.id, mode, uiLocale),
          disabled: audioWorkflowLocked,
          disabledReason,
        })),
    ];
  }, [audioWorkflowLocked, selectedEngine, uiLocale, workflowCopy]);

  const showRetakeWorkflowAction = Boolean(selectedEngine?.id === 'ltx-2-3' && selectedEngine.modes.includes('retake'));

  const composerWorkflowNotice = useMemo(() => {
    if (!selectedEngine || !referenceInputStatus.hasAudio) return null;
    if (audioWorkflowUnsupported) {
      return workflowCopy.audioUnsupported;
    }
    if (
      selectedEngine.id === 'ltx-2-3' ||
      selectedEngine.id === 'veo-3-1' ||
      selectedEngine.id === 'veo-3-1-fast' ||
      selectedEngine.id === 'veo-3-1-lite'
    ) {
      return workflowCopy.audioLocked;
    }
    return workflowCopy.audioLockedFallback;
  }, [audioWorkflowUnsupported, referenceInputStatus.hasAudio, selectedEngine, workflowCopy]);

  const handleComposerModeToggle = useCallback(
    (mode: Mode | null) => {
      if (!selectedEngine) return;
      if (
        referenceInputStatus.hasAudio &&
        !isUnifiedSeedance &&
        (mode === 'v2v' || mode === 'reframe' || mode === 'extend' || mode === 'retake')
      ) {
        showNotice(workflowCopy.removeAudioToUseEdit);
        return;
      }
      const nextMode = mode ?? implicitMode;
      setForm((current) =>
        coerceFormState(selectedEngine, nextMode, current ? { ...current, mode: nextMode } : null)
      );
    },
    [implicitMode, isUnifiedSeedance, referenceInputStatus.hasAudio, selectedEngine, showNotice, workflowCopy]
  );

  const handleDurationChange = useCallback(
    (raw: number | string) => {
      if (multiPromptActive) return;
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
    },
    [multiPromptActive]
  );

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
    if (id.includes('first_frame') || id.includes('last_frame') || id.includes('end_image')) return 'frame';
    if (id === 'image_urls' || id.endsWith('_image_urls')) return 'reference';
    if (id === 'video_urls' || id.endsWith('_video_urls')) return 'reference';
    if (id === 'audio_urls' || id.endsWith('_audio_urls')) return 'reference';
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
        promotedFields: [] as Array<{ field: EngineInputField; required: boolean }>,
        secondaryFields: [] as Array<{ field: EngineInputField; required: boolean }>,
        promptField: undefined as EngineInputField | undefined,
        promptRequired: true,
        negativePromptField: undefined as EngineInputField | undefined,
        negativePromptRequired: false,
      };
    }

    const allowsCrossModeAssets =
      activeMode === 't2v' &&
      Boolean(
        selectedEngine?.modes?.some(
          (mode) => mode === 'i2v' || mode === 'v2v' || mode === 'reframe' || mode === 'r2v' || mode === 'a2v'
        )
      );
    const appliesToMode = (field: EngineInputField) => {
      if (!field.modes || field.modes.includes(activeMode)) return true;
      if (
        isUnifiedSeedance &&
        (field.type === 'image' || field.type === 'video' || field.type === 'audio') &&
        (field.modes.includes('i2v') || field.modes.includes('ref2v'))
      ) {
        return true;
      }
      if (
        isUnifiedHappyHorse &&
        activeMode === 't2v' &&
        (field.type === 'image' || field.type === 'video') &&
        (field.modes.includes('i2v') || field.modes.includes('ref2v') || field.modes.includes('v2v'))
      ) {
        return true;
      }
      if (allowsUnifiedVeoFirstLast && field.id === 'last_frame_url' && field.modes.includes('fl2v')) return true;
      if (allowsUnifiedVeoFirstLast && field.id === 'first_frame_url' && field.modes.includes('fl2v')) return false;
      if (!allowsCrossModeAssets) return false;
      if (field.type === 'image' && field.modes.includes('i2v')) return true;
      if (field.type === 'video' && (field.modes.includes('r2v') || field.modes.includes('v2v') || field.modes.includes('reframe'))) {
        return true;
      }
      if (field.type === 'audio' && field.modes.includes('a2v')) return true;
      return false;
    };
    const isRequired = (field: EngineInputField, origin: 'required' | 'optional') => {
      if (field.requiredInModes) {
        return field.requiredInModes.includes(activeMode);
      }
      return origin === 'required';
    };

    const assetFields: AssetFieldConfig[] = [];
    const promotedFields: Array<{ field: EngineInputField; required: boolean }> = [];
    const secondaryFields: Array<{ field: EngineInputField; required: boolean }> = [];
    let promptField: EngineInputField | undefined;
    let promptFieldOrigin: 'required' | 'optional' | undefined;
    let negativePromptField: EngineInputField | undefined;
    let negativePromptOrigin: 'required' | 'optional' | undefined;

    const ingest = (fields: EngineInputField[] | undefined, origin: 'required' | 'optional') => {
      if (!fields) return;
      fields.forEach((field) => {
        if (!appliesToMode(field)) return;
        const localizedField = localizeLtxField(field, uiLocale, selectedEngine?.id);
        const normalizedId = normalizeFieldId(localizedField.id);
        if (localizedField.type === 'text') {
          const normalizedIdValue = (localizedField.id ?? '').toLowerCase();
          const normalizedIdCompact = normalizedIdValue.replace(/[^a-z0-9]/g, '');
          const normalizedLabel = (localizedField.label ?? '').toLowerCase();
          const normalizedLabelCompact = normalizedLabel.replace(/\s+/g, '');
          const hasNegativePromptCue = (value: string) =>
            value.includes('negativeprompt') ||
            (value.includes('negative') && value.includes('prompt')) ||
            value.includes('negprompt');
          const isNegative =
            normalizedIdValue === 'negative_prompt' ||
            hasNegativePromptCue(normalizedIdCompact) ||
            normalizedLabel.includes('negative prompt') ||
            hasNegativePromptCue(normalizedLabelCompact);
          if (isNegative) {
            if (!negativePromptField) {
              negativePromptField = localizedField;
              negativePromptOrigin = origin;
            }
            return;
          }
          const isPrompt = normalizedIdValue === 'prompt';
          if (!promptField || isPrompt) {
            promptField = localizedField;
            promptFieldOrigin = origin;
          }
          return;
        }
        const required = isRequired(localizedField, origin);
        if (localizedField.type === 'image' || localizedField.type === 'video' || localizedField.type === 'audio') {
          const role = resolveAssetFieldRole(localizedField, required);
          assetFields.push({ field: localizedField, required, role });
          return;
        }
        if (!STANDARD_ENGINE_FIELD_IDS.has(normalizedId)) {
          const isPromotedBooleanToggle =
            PROMOTED_WORKFLOW_FIELD_IDS.has(normalizedId) &&
            localizedField.type === 'enum' &&
            Array.isArray(localizedField.values) &&
            localizedField.values.includes('true') &&
            localizedField.values.includes('false');
          if (isPromotedBooleanToggle) {
            promotedFields.push({ field: localizedField, required });
            return;
          }
          secondaryFields.push({ field: localizedField, required });
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
      promotedFields,
      secondaryFields,
      promptField,
      promptRequired,
      negativePromptField,
      negativePromptRequired,
    };
  }, [selectedEngine, activeMode, allowsUnifiedVeoFirstLast, isUnifiedHappyHorse, isUnifiedSeedance, uiLocale]);

  const extraInputFields = useMemo(
    () => [...inputSchemaSummary.promotedFields, ...inputSchemaSummary.secondaryFields],
    [inputSchemaSummary.promotedFields, inputSchemaSummary.secondaryFields]
  );

  useEffect(() => {
    setForm((current) => {
      if (!current) return current;
      const allowedFieldIds = new Set(extraInputFields.map(({ field }) => field.id));
      const nextExtraInputValues = Object.entries(current.extraInputValues).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (allowedFieldIds.has(key)) {
          acc[key] = value;
        }
        return acc;
      }, {});
      if (JSON.stringify(nextExtraInputValues) === JSON.stringify(current.extraInputValues)) {
        return current;
      }
      return { ...current, extraInputValues: nextExtraInputValues };
    });
  }, [extraInputFields]);

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
  const referenceAudioFieldIds = useMemo(() => {
    const ids = inputSchemaSummary.assetFields
      .filter((entry) => entry.field.type === 'audio' && typeof entry.field.id === 'string')
      .map((entry) => entry.field.id as string)
      .filter((fieldId) => SEEDANCE_REFERENCE_AUDIO_FIELD_IDS.has(fieldId));
    return new Set(ids);
  }, [inputSchemaSummary.assetFields]);

  const primaryAssetFieldLabel = useMemo(() => {
    const primaryField = inputSchemaSummary.assetFields.find((entry) => entry.role === 'primary')?.field;
    return primaryField?.label ?? 'Reference image';
  }, [inputSchemaSummary.assetFields]);
  const guestUploadLockedReason = !authChecked || (!authLoading && !user?.id) ? workspaceCopy.authGate.uploadLocked : null;
  const composerAssetFields = useMemo(() => {
    return inputSchemaSummary.assetFields.map((entry) => {
      const fieldHasOwnAssets = (inputAssets[entry.field.id] ?? []).some((asset) => asset !== null);
      const blockKey = isUnifiedSeedance
        ? getSeedanceFieldBlockKey(entry.field.id, inputAssets, fieldHasOwnAssets)
        : null;
      const workflowDisabledReason =
        blockKey === 'clearReferences'
          ? workflowCopy.clearReferencesToUseStartEnd
          : blockKey === 'clearStartEnd'
            ? workflowCopy.clearStartEndToUseReferences
            : null;
      const disabledReason = workflowDisabledReason ?? guestUploadLockedReason;
      return {
        ...entry,
        disabled: Boolean(disabledReason),
        disabledReason,
      };
    });
  }, [
    guestUploadLockedReason,
    inputAssets,
    inputSchemaSummary.assetFields,
    isUnifiedSeedance,
    workflowCopy.clearReferencesToUseStartEnd,
    workflowCopy.clearStartEndToUseReferences,
  ]);

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
  const handleExtraInputValueChange = useCallback((field: EngineInputField, value: unknown) => {
    setForm((current) => {
      if (!current) return current;
      const normalized = normalizeExtraInputValue(field, value);
      const next = { ...current.extraInputValues };
      if (normalized === undefined) {
        delete next[field.id];
      } else {
        next[field.id] = normalized;
      }
      return { ...current, extraInputValues: next };
    });
  }, []);

  const composerPromotedActions = useMemo<ComposerPromotedAction[]>(() => {
    if (!form) return [];
    return inputSchemaSummary.promotedFields.map(({ field }) => {
      const normalizedId = normalizeFieldId(field.id);
      const currentValue = parseBooleanInput(form.extraInputValues[field.id] ?? field.default);
      const active = currentValue ?? false;
      const promotedCopy =
        normalizedId === 'enhanceprompt'
          ? uiLocale === 'fr'
            ? {
                label: 'Améliorer',
                tooltip: 'Réécrit le prompt avant envoi pour un résultat plus propre.',
              }
            : uiLocale === 'es'
              ? {
                  label: 'Mejorar',
                  tooltip: 'Reescribe el prompt antes de enviarlo para un resultado más limpio.',
                }
              : {
                  label: 'Improve',
                  tooltip: 'Rewrites your prompt before sending it for a cleaner result.',
                }
          : normalizedId === 'autofix'
            ? uiLocale === 'fr'
              ? {
                  label: 'Corriger si bloqué',
                  tooltip: 'Si le prompt est bloqué, réessaie automatiquement avec une version sûre.',
                }
              : uiLocale === 'es'
                ? {
                    label: 'Corregir si bloquea',
                    tooltip: 'Si el prompt es bloqueado, reintenta automáticamente con una versión segura.',
                  }
                : {
                    label: 'Fix if blocked',
                    tooltip: 'If the prompt is blocked, retry automatically with a safe rewrite.',
                  }
            : {
                label: field.label,
                tooltip: field.description ?? field.label,
              };
      return {
        id: field.id,
        label: promotedCopy.label,
        tooltip: promotedCopy.tooltip,
        active,
        icon: normalizedId === 'autofix' ? 'shield' : 'sparkles',
        onToggle: () => handleExtraInputValueChange(field, active ? 'false' : 'true'),
      };
    });
  }, [form, handleExtraInputValueChange, inputSchemaSummary.promotedFields, uiLocale]);

  const startRender = useCallback(async () => {
    if (!form || !selectedEngine) return;
    const { supabase } = await import('@/lib/supabaseClient');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) {
      setAuthModalOpen(true);
      return;
    }
    setPreflightError(undefined);
    if (audioWorkflowUnsupported) {
      showComposerError(workflowCopy.audioUnsupported);
      return;
    }
    const trimmedPrompt = effectivePrompt.trim();
    const trimmedNegativePrompt = negativePrompt.trim();
    const supportsNegativePrompt = Boolean(inputSchemaSummary.negativePromptField);
    const isLumaRay2 = isLumaRay2EngineId(selectedEngine.id);
    const isLumaRay2GenerateWorkflow = isLumaRay2 && isLumaRay2GenerateMode(submissionMode);
    const isLumaRay2ReframeWorkflow = isLumaRay2 && submissionMode === 'reframe';
    const lumaDuration = isLumaRay2
      ? getLumaRay2DurationInfo(form.durationOption ?? form.durationSec)
      : null;
    const lumaResolution = isLumaRay2 ? getLumaRay2ResolutionInfo(form.resolution) : null;
    const lumaAspectOk =
      !isLumaRay2 || isLumaRay2AspectRatio(form.aspectRatio, { includeSquare: isLumaRay2ReframeWorkflow });

    if (multiPromptActive && multiPromptInvalid) {
      showComposerError(multiPromptError ?? 'Multi-prompt requires a prompt per scene and a valid total duration.');
      return;
    }

    if (promptCharLimitExceeded && typeof promptMaxChars === 'number') {
      const overflow = prompt.length - promptMaxChars;
      showComposerError(
        `Prompt is ${overflow} character${overflow === 1 ? '' : 's'} over the ${promptMaxChars}-character limit for ${selectedEngine.label}.`
      );
      return;
    }

    if (inputSchemaSummary.promptRequired && !trimmedPrompt) {
      showComposerError('A prompt is required for this engine and mode.');
      return;
    }

    if (
      supportsNegativePrompt &&
      inputSchemaSummary.negativePromptRequired &&
      !trimmedNegativePrompt
    ) {
      const label = inputSchemaSummary.negativePromptField?.label ?? 'Negative prompt';
      showComposerError(`${label} is required before generating.`);
      return;
    }

    const missingAssetField = inputSchemaSummary.assetFields.find(({ field, required }) => {
      if (!required) return false;
      const minCount = field.minCount ?? 1;
      const current = (inputAssets[field.id]?.filter((asset) => asset !== null).length) ?? 0;
      return current < minCount;
    });

    if (missingAssetField) {
      showComposerError(`${missingAssetField.field.label} is required before generating.`);
      return;
    }

    const missingGenericField = extraInputFields.find(({ field, required }) => {
      if (!required) return false;
      const value = normalizeExtraInputValue(field, form.extraInputValues[field.id] ?? field.default);
      return value === undefined;
    });

    if (missingGenericField) {
      showComposerError(`${missingGenericField.field.label} is required before generating.`);
      return;
    }

    if (
      (isLumaRay2GenerateWorkflow && (!lumaDuration || !lumaResolution || !lumaAspectOk)) ||
      (isLumaRay2ReframeWorkflow && !lumaAspectOk)
    ) {
      showComposerError(LUMA_RAY2_ERROR_UNSUPPORTED);
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

      setTopUpModal({
        message: friendlyNotice,
        amountLabel: formattedShortfall,
        shortfallCents: typeof normalizedShortfall === 'number' ? normalizedShortfall : undefined,
      });
      showComposerError(friendlyNotice);
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
      kind: 'image' | 'video' | 'audio';
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
          showComposerError('Please wait for uploads to finish before generating.');
          return;
        }
        if (asset.status === 'error' || !asset.url) {
          showComposerError('One of your reference files is unavailable. Remove it and try again.');
          return;
        }
        collected.push({
          name: asset.name,
          type: asset.type || (asset.kind === 'image' ? 'image/*' : asset.kind === 'audio' ? 'audio/*' : 'video/*'),
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
    const activeReferenceSlots =
      selectedEngine.id === 'happy-horse-1-0'
        ? submissionMode === 'v2v'
          ? new Set(['reference_image_urls'])
          : submissionMode === 'ref2v'
            ? new Set(['image_urls'])
            : referenceSlots
        : referenceSlots;
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
            if (!slotId) return activeReferenceSlots.size === 0;
            if (activeReferenceSlots.size === 0) {
              return !primaryAssetFieldIds.has(slotId);
            }
            return activeReferenceSlots.has(slotId);
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
    const referenceAudioUrls = inputsPayload
      ? inputsPayload
          .filter(
            (attachment) =>
              attachment.kind === 'audio' &&
              typeof attachment.url === 'string' &&
              typeof attachment.slotId === 'string' &&
              referenceAudioFieldIds.has(attachment.slotId)
          )
          .map((attachment) => attachment.url)
          .filter((url, index, self) => self.indexOf(url) === index)
      : [];

    const primaryImageUrl =
      primaryAttachment?.url ?? (activeMode === 'i2v' || activeMode === 'i2i' ? referenceImageUrls[0] : undefined);
    const primaryAudioUrl =
      inputsPayload?.find(
        (attachment) =>
          attachment.kind === 'audio' &&
          typeof attachment.url === 'string' &&
          !(typeof attachment.slotId === 'string' && referenceAudioFieldIds.has(attachment.slotId))
      )?.url ?? undefined;
    const endImageUrl =
      inputsPayload?.find((attachment) => attachment.slotId === 'end_image_url' && typeof attachment.url === 'string')
        ?.url ?? undefined;
    const extraInputValues = extraInputFields.reduce<Record<string, unknown>>((acc, { field }) => {
      const normalized = normalizeExtraInputValue(field, form.extraInputValues[field.id] ?? field.default);
      if (normalized !== undefined) {
        acc[field.id] = normalized;
      }
      return acc;
    }, {});

    let klingElementsPayload:
      | Array<{ frontalImageUrl?: string; referenceImageUrls?: string[]; videoUrl?: string }>
      | undefined;
    if (supportsKlingV3Controls && form.mode === 'i2v') {
      let videoCount = 0;
      const collected: Array<{ frontalImageUrl?: string; referenceImageUrls?: string[]; videoUrl?: string }> = [];
      for (const element of klingElements) {
        const frontal = element.frontal;
        const references = element.references.filter((asset): asset is KlingElementAsset => Boolean(asset));
        const video = element.video;
        const hasAnyAsset = Boolean(frontal || references.length || video);
        if (!hasAnyAsset) {
          continue;
        }

        const assetsToCheck = [frontal, ...references, video].filter(Boolean) as KlingElementAsset[];
        for (const asset of assetsToCheck) {
          if (asset.status === 'uploading') {
            showComposerError('Please wait for element uploads to finish before generating.');
            return;
          }
          if (asset.status === 'error' || !asset.url) {
            showComposerError('One of your element assets failed to upload. Remove it and try again.');
            return;
          }
        }

        const frontalUrl = frontal?.url;
        const referenceUrls = references
          .map((asset) => asset.url)
          .filter((url): url is string => Boolean(url));
        const videoUrl = video?.url;
        if (videoUrl) {
          videoCount += 1;
        }
        const hasImageSet = Boolean(frontalUrl && referenceUrls.length > 0);
        const hasVideoReference = Boolean(videoUrl);
        if (!hasImageSet && !hasVideoReference) {
          showComposerError('Each Kling element needs a frontal image plus at least one reference image, or one video reference.');
          return;
        }
        collected.push({
          frontalImageUrl: frontalUrl,
          referenceImageUrls: referenceUrls.length ? referenceUrls : undefined,
          videoUrl,
        });
      }
      if (videoCount > 1) {
        showComposerError('Only one Kling element can include a video reference.');
        return;
      }
      if (collected.length) {
        klingElementsPayload = collected;
      }
    }

    const multiPromptPayload = multiPromptActive
      ? multiPromptScenes
          .filter((scene) => scene.prompt.trim().length)
          .map((scene) => ({ prompt: scene.prompt.trim(), duration: Math.round(scene.duration || 0) }))
      : undefined;

    const runIteration = async (iterationIndex: number) => {
      const isImageDrivenMode = submissionMode === 'i2v' || submissionMode === 'i2i';
      const isReferenceImageMode = submissionMode === 'ref2v';
      const isFirstLastMode = submissionMode === 'fl2v';
      const firstFrameAttachment = isFirstLastMode
        ? (inputsPayload?.find((attachment) => attachment.slotId === 'first_frame_url') ?? primaryAttachment)
        : null;
      const lastFrameAttachment = isFirstLastMode
        ? inputsPayload?.find((attachment) => attachment.slotId === 'last_frame_url')
        : null;

      if (allowsUnifiedVeoFirstLast && hasLastFrameInput && !primaryImageUrl) {
        showComposerError('Add a start image before using Last frame with Veo.');
        return;
      }
      if (isImageDrivenMode && !primaryImageUrl) {
        const guardMessage = selectedEngine.id.startsWith('sora-2')
          ? 'Ajoutez une image (URL ou fichier) pour lancer Image → Video avec Sora.'
          : `Add at least one ${primaryAssetFieldLabel.toLowerCase()} (URL or upload) before running this mode.`;
        showComposerError(guardMessage);
        return;
      }
      if (isReferenceImageMode) {
        if (isUnifiedSeedance) {
          if (referenceImageUrls.length === 0 && referenceVideoUrls.length === 0) {
            showComposerError(
              referenceAudioUrls.length > 0
                ? workflowCopy.addReferenceMediaBeforeAudio
                : 'Add at least one reference image or reference video before running Seedance Reference → Video.'
            );
            return;
          }
        } else if (referenceImageUrls.length === 0) {
          showComposerError(
            selectedEngine.id === 'happy-horse-1-0'
              ? 'Add 1–9 reference images before running Happy Horse R2V.'
              : 'Add 1–4 reference images before running Reference → Video.'
          );
          return;
        }
      }
      const isVideoDrivenMode = submissionMode === 'r2v';
      if (isVideoDrivenMode && referenceVideoUrls.length === 0) {
        showComposerError('Add 1–3 reference videos (MP4/MOV) before running Reference → Video.');
        return;
      }
      const isAudioDrivenMode = submissionMode === 'a2v';
      if (isAudioDrivenMode && !primaryAudioUrl) {
        showComposerError('Add an audio file before running Audio → Video.');
        return;
      }
      const isExtendOrRetakeMode = submissionMode === 'extend' || submissionMode === 'retake';
      if (isExtendOrRetakeMode && referenceVideoUrls.length === 0) {
        showComposerError(workflowCopy.addSourceVideo(getLocalizedModeLabel(submissionMode, uiLocale)));
        return;
      }
      if (isFirstLastMode) {
        if (!firstFrameAttachment || !lastFrameAttachment) {
          showComposerError('Upload both a start image and last frame before generating with Veo.');
          return;
        }
        const sameSource =
          firstFrameAttachment.assetId && lastFrameAttachment.assetId
            ? firstFrameAttachment.assetId === lastFrameAttachment.assetId
            : firstFrameAttachment.url === lastFrameAttachment.url;
        if (sameSource) {
          showComposerError('First and last frames must be two different images for this engine.');
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

      const { seconds: etaSeconds, label: etaLabel } = getRenderEta(selectedEngine, effectiveDurationSec);
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
        durationSec: effectiveDurationSec,
        prompt: effectivePrompt,
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
        prompt: effectivePrompt,
        status: initial.status,
      });

      startProgressTracking();

      try {
        const shouldSendAspectRatio = !capability || (capability.aspectRatio?.length ?? 0) > 0;
        const resolvedDurationSeconds = isLumaRay2GenerateWorkflow && lumaDuration ? lumaDuration.seconds : effectiveDurationSec;
        const durationOptionLabel: LumaRay2DurationLabel | undefined =
          typeof form.durationOption === 'string'
            ? (['5s', '9s'].includes(form.durationOption) ? (form.durationOption as LumaRay2DurationLabel) : undefined)
            : undefined;
        const resolvedDurationLabel =
          isLumaRay2GenerateWorkflow && lumaDuration
            ? lumaDuration.label
            : toLumaRay2DurationLabel(effectiveDurationSec, durationOptionLabel) ??
              durationOptionLabel ??
              effectiveDurationSec;
        const shouldSendDuration = !capability || Boolean(capability.duration || capability.frames);
        const shouldSendResolution = !capability || (capability.resolution?.length ?? 0) > 0;
        const resolvedResolution = isLumaRay2GenerateWorkflow && lumaResolution ? lumaResolution.value : form.resolution;
        const shouldSendFps =
          !capability ||
          (Array.isArray(capability.fps) ? capability.fps.length > 0 : typeof capability.fps === 'number');
        const seedNumber =
          typeof form.seed === 'number' && Number.isFinite(form.seed) ? Math.trunc(form.seed) : undefined;
        const cameraFixed =
          typeof form.cameraFixed === 'boolean' ? form.cameraFixed : undefined;
        const safetyChecker =
          typeof form.safetyChecker === 'boolean' ? form.safetyChecker : undefined;

        const generatePayload: Parameters<typeof runGenerate>[0] = {
          engineId: selectedEngine.id,
          prompt: trimmedPrompt,
          mode: submissionMode,
          durationSec: resolvedDurationSeconds,
          membershipTier: memberTier,
          payment: { mode: paymentMode },
          cfgScale: typeof cfgScale === 'number' ? cfgScale : undefined,
          ...(selectedEngine.id.startsWith('sora-2')
            ? { variant: selectedEngine.id === 'sora-2-pro' ? 'sora2pro' : 'sora2' }
            : {}),
          ...(shouldSendDuration ? { durationOption: resolvedDurationLabel } : {}),
          ...(form.numFrames != null ? { numFrames: form.numFrames } : {}),
          ...(shouldSendResolution ? { resolution: resolvedResolution } : {}),
          ...(shouldSendFps ? { fps: form.fps } : {}),
          ...(shouldSendAspectRatio ? { aspectRatio: form.aspectRatio } : {}),
          ...(supportsNegativePrompt && trimmedNegativePrompt ? { negativePrompt: trimmedNegativePrompt } : {}),
          ...(supportsAudioToggle ? { audio: form.audio } : {}),
          ...(inputsPayload ? { inputs: inputsPayload } : {}),
          ...(primaryImageUrl ? { imageUrl: primaryImageUrl } : {}),
          ...(primaryAudioUrl ? { audioUrl: primaryAudioUrl } : {}),
          ...(referenceImageUrls.length ? { referenceImages: referenceImageUrls } : {}),
          ...(endImageUrl ? { endImageUrl } : {}),
          ...(Object.keys(extraInputValues).length ? { extraInputValues } : {}),
          ...(multiPromptPayload && multiPromptPayload.length ? { multiPrompt: multiPromptPayload } : {}),
          ...(supportsKlingV3Controls
            ? {
                shotType: activeMode === 'i2v' ? 'customize' : shotType,
                ...(supportsKlingV3VoiceControl && voiceIds.length ? { voiceIds } : {}),
                ...(voiceControlEnabled ? { voiceControl: true } : {}),
                ...(klingElementsPayload ? { elements: klingElementsPayload } : {}),
              }
            : {}),
          ...(isSeedance
            ? {
                ...(typeof seedNumber === 'number' ? { seed: seedNumber } : {}),
                ...(typeof cameraFixed === 'boolean' ? { cameraFixed } : {}),
                ...(typeof safetyChecker === 'boolean' ? { safetyChecker } : {}),
              }
            : {}),
          idempotencyKey: id,
          batchId,
          groupId: batchId,
          iterationIndex,
          iterationCount,
          localKey,
          message: friendlyMessage,
          etaSeconds,
          etaLabel,
          visibility: 'private',
          indexable: false,
          ...(isLumaRay2GenerateWorkflow ? { loop: Boolean(form.loop) } : {}),
        };

        emitClientMetric('generation_started', {
          local_key: localKey,
          batch_id: batchId,
          group_id: batchId,
          iteration_index: iterationIndex,
          iteration_count: iterationCount,
          batch_size: iterationCount,
          engine: selectedEngine.id,
          mode: submissionMode,
          duration_sec: resolvedDurationSeconds,
          payment_mode: paymentMode,
          has_audio: Boolean(form.audio),
        });

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
              ? (() => {
                  const nextFailedAt =
                    resolvedStatus === 'failed' && isRefundedPaymentStatus(resolvedPaymentStatus)
                      ? render.failedAt ?? now
                      : undefined;
                  return {
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
                  failedAt: nextFailedAt,
                  etaSeconds: resolvedEtaSeconds,
                  etaLabel: resolvedEtaLabel,
                  renderIds: resolvedRenderIds,
                  heroRenderId: resolvedHeroRenderId,
                  readyVideoUrl: resolvedVideoUrl ?? render.readyVideoUrl,
                  videoUrl: gatingActive ? render.videoUrl : resolvedVideoUrl ?? render.videoUrl,
                  previewVideoUrl: render.previewVideoUrl,
                  };
                })()
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
                previewVideoUrl: cur.previewVideoUrl,
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
            const hasThumb = Boolean(status.thumbUrl && !isPlaceholderMediaUrl(status.thumbUrl));
            setRenders((prev) =>
              prev.map((r) =>
                r.id === jobId
                  ? (() => {
                      const nextStatus = status.status ?? r.status;
                      const nextPaymentStatus = status.paymentStatus ?? r.paymentStatus;
                      const nextFailedAt =
                        nextStatus === 'failed' && isRefundedPaymentStatus(nextPaymentStatus)
                          ? r.failedAt ?? now
                          : undefined;
                      return {
                      ...r,
                      status: nextStatus,
                      progress: status.progress ?? r.progress,
                      readyVideoUrl: status.videoUrl ?? r.readyVideoUrl,
                      videoUrl: status.videoUrl ?? r.videoUrl ?? r.readyVideoUrl,
                      previewVideoUrl: status.previewVideoUrl ?? r.previewVideoUrl,
                      thumbUrl: resolvePolledThumbUrl(r.thumbUrl, status.thumbUrl),
                      priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? r.priceCents,
                      currency: status.currency ?? status.pricing?.currency ?? r.currency,
                      pricingSnapshot: status.pricing ?? r.pricingSnapshot,
                      paymentStatus: nextPaymentStatus,
                      failedAt: nextFailedAt,
                    };
                  })()
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
                    previewVideoUrl: status.previewVideoUrl ?? cur.previewVideoUrl,
                    thumbUrl: resolvePolledThumbUrl(cur.thumbUrl, status.thumbUrl),
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
        emitClientMetric('generation_failed', {
          local_key: localKey,
          batch_id: batchId,
          group_id: batchId,
          iteration_index: iterationIndex,
          iteration_count: iterationCount,
          engine: selectedEngine.id,
          mode: submissionMode,
          error_code:
            error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
              ? (error as { code: string }).code
              : 'generation_request_failed',
          error_message: error instanceof Error ? error.message : 'Generation failed',
        });
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
              : `The provider rejected this ${primaryAssetFieldLabel.toLowerCase()}. Please try with a different one.`;
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
          showComposerError(composed);
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
        showComposerError(fallbackMessage);
      }
    };

    for (let iterationIndex = 0; iterationIndex < iterationCount; iterationIndex += 1) {
      void runIteration(iterationIndex);
    }
  }, [
    audioWorkflowUnsupported,
    form,
    activeMode,
    submissionMode,
    effectivePrompt,
    effectiveDurationSec,
    negativePrompt,
    selectedEngine,
    preflight,
    memberTier,
    showComposerError,
    writeScopedStorage,
    mutateLatestJobs,
    inputSchemaSummary,
    extraInputFields,
    inputAssets,
    setActiveGroupId,
    uiLocale,
    workflowCopy,
    capability,
    workspaceCopy.wallet.insufficient,
    workspaceCopy.wallet.insufficientWithAmount,
    cfgScale,
    formatTakeLabel,
    primaryAssetFieldLabel,
    primaryAssetFieldIds,
    referenceAssetFieldIds,
    referenceAudioFieldIds,
    genericImageFieldIds,
    frameAssetFieldIds,
    allowsUnifiedVeoFirstLast,
    hasLastFrameInput,
    supportsAudioToggle,
    multiPromptActive,
    multiPromptInvalid,
    multiPromptError,
    multiPromptScenes,
    supportsKlingV3Controls,
    supportsKlingV3VoiceControl,
    isSeedance,
    isUnifiedSeedance,
    prompt.length,
    promptCharLimitExceeded,
    promptMaxChars,
    voiceIds,
    voiceControlEnabled,
    shotType,
    klingElements,
  ]);

  useEffect(() => {
    if (!selectedEngine || !authChecked) return;
    setForm((current) => {
      const candidate = current ?? null;
      if (!candidate) return candidate;
      const nextMode = getPreferredEngineMode(selectedEngine, candidate?.mode ?? null);
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
          candidate.audio !== nextState.audio ||
          candidate.seed !== nextState.seed ||
          candidate.cameraFixed !== nextState.cameraFixed ||
          candidate.safetyChecker !== nextState.safetyChecker;
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
      mode: submissionMode,
      durationSec: effectiveDurationSec,
      resolution: form.resolution as PreflightRequest['resolution'],
      aspectRatio: form.aspectRatio as PreflightRequest['aspectRatio'],
      fps: form.fps,
      seedLocked: Boolean(form.seedLocked),
      loop: form.loop,
      ...(supportsAudioToggle ? { audio: form.audio } : {}),
      ...(voiceControlEnabled ? { voiceControl: true } : {}),
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
          if (!response.ok) {
            const message =
              (typeof response.error?.message === 'string' && response.error.message.trim().length
                ? response.error.message.trim()
                : undefined) ??
              response.messages?.find((entry) => typeof entry === 'string' && entry.trim().length)?.trim() ??
              'Unable to compute pricing';
            setPreflightError(message);
            return;
          }
          setPreflightError(undefined);
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
  }, [form, selectedEngine, memberTier, authChecked, supportsAudioToggle, effectiveDurationSec, voiceControlEnabled, submissionMode]);

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
            previewVideoUrl: tile.previewVideoUrl,
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
    (group: GroupSummary, action: GroupedJobAction, options?: { autoPlayPreview?: boolean }) => {
      if (action === 'remove') {
        return;
      }
      if (group.source === 'active') {
        setActiveGroupId(group.id);
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
          if (options?.autoPlayPreview) {
            setPreviewAutoPlayRequestId((current) => current + 1);
          }
          handleQuadTileAction('open', tile);
          setCompositeOverride(null);
          setCompositeOverrideSummary(null);
          setSharedPrompt(null);
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
        previewVideoUrl: member.previewVideoUrl ?? undefined,
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
        if (options?.autoPlayPreview) {
          setPreviewAutoPlayRequestId((current) => current + 1);
        }
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
          previewVideoUrl: tile.previewVideoUrl,
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
      setPreviewAutoPlayRequestId,
      provider,
      setCompositeOverride,
      setCompositeOverrideSummary,
      applyVideoSettingsFromTile,
      hydrateVideoSettingsFromJob,
      writeScopedStorage,
    ]
  );

  const handleGalleryFeedStateChange = useCallback((state: GalleryFeedState) => {
    setGuidedSampleFeed((prev) => {
      if (prev.sampleOnly === state.sampleOnly && haveSameGroupOrder(prev.visibleGroups, state.visibleGroups)) {
        return prev;
      }
      return state;
    });
  }, []);

  useEffect(() => {
    if (isGuidedSamplesActive) return;
    if (compositeOverrideSummary?.hero.job?.curated) {
      setCompositeOverride(null);
      setCompositeOverrideSummary(null);
    }
  }, [compositeOverrideSummary, isGuidedSamplesActive]);

  useEffect(() => {
    if (!isGuidedSamplesActive || guidedSampleGroups.length === 0) return;
    const currentGroupId = compositeOverrideSummary?.id ?? null;
    if (currentGroupId && guidedSampleGroups.some((group) => group.id === currentGroupId)) {
      return;
    }
    handleGalleryGroupAction(guidedSampleGroups[0], 'open');
  }, [compositeOverrideSummary?.id, guidedSampleGroups, handleGalleryGroupAction, isGuidedSamplesActive]);

  const currentGuidedSampleIndex = useMemo(() => {
    if (!isGuidedSamplesActive || guidedSampleGroups.length === 0) return -1;
    const currentGroupId = compositeOverrideSummary?.id ?? null;
    if (!currentGroupId) return -1;
    return guidedSampleGroups.findIndex((group) => group.id === currentGroupId);
  }, [compositeOverrideSummary?.id, guidedSampleGroups, isGuidedSamplesActive]);

  const openGuidedSampleAt = useCallback(
    (index: number) => {
      const target = guidedSampleGroups[index];
      if (!target) return;
      handleGalleryGroupAction(target, 'open', { autoPlayPreview: true });
    },
    [guidedSampleGroups, handleGalleryGroupAction]
  );

  const guidedNavigation = useMemo(() => {
    if (!isGuidedSamplesActive || guidedSampleGroups.length === 0) return null;
    const activeIndex = currentGuidedSampleIndex >= 0 ? currentGuidedSampleIndex : 0;
    return {
      currentIndex: activeIndex,
      total: guidedSampleGroups.length,
      canPrev: activeIndex > 0,
      canNext: activeIndex < guidedSampleGroups.length - 1,
      onPrev: () => openGuidedSampleAt(activeIndex - 1),
      onNext: () => openGuidedSampleAt(activeIndex + 1),
    };
  }, [currentGuidedSampleIndex, guidedSampleGroups, isGuidedSamplesActive, openGuidedSampleAt]);

  const openGroupViaGallery = useCallback(
    (group: GroupSummary) => {
      handleGalleryGroupAction(group, 'open', { autoPlayPreview: true });
    },
    [handleGalleryGroupAction]
  );
  const handleActiveGroupOpen = useCallback(
    (group: GroupSummary) => {
      handleGalleryGroupAction(group, 'open', { autoPlayPreview: true });
    },
    [handleGalleryGroupAction]
  );
  const handleActiveGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      if (action === 'remove') return;
      handleGalleryGroupAction(group, action, { autoPlayPreview: action === 'open' });
    },
    [handleGalleryGroupAction]
  );

  const singlePriceCents = typeof preflight?.total === 'number' ? preflight.total : null;
  const singlePrice =
    typeof singlePriceCents === 'number' ? singlePriceCents / 100 : null;
  const price =
    typeof singlePrice === 'number' && form?.iterations
      ? singlePrice * form.iterations
      : singlePrice;
  const currency = preflight?.currency ?? 'USD';

  if (isLoading && engines.length === 0) {
    return (
      <>
        <WorkspaceChrome
          isDesktopLayout={isDesktopLayout}
          desktopRail={<GalleryRailSkeleton />}
          mobileRail={<GalleryRailSkeleton />}
        >
          <WorkspaceBootContent initialPreviewGroup={initialPreviewFallbackGroup} initialPreviewPosterSrc={compositePreviewPosterSrc} />
        </WorkspaceChrome>
      </>
    );
  }

  if (enginesError && engines.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-state-warning">
        {workspaceCopy.errors.loadEngines}: {enginesError.message}
      </main>
    );
  }

  if (!selectedEngine || !form) {
    if (engines.length > 0) {
      return (
        <>
          <WorkspaceChrome
            isDesktopLayout={isDesktopLayout}
            desktopRail={<GalleryRailSkeleton />}
            mobileRail={<GalleryRailSkeleton />}
          >
            <WorkspaceBootContent initialPreviewGroup={initialPreviewFallbackGroup} initialPreviewPosterSrc={compositePreviewPosterSrc} />
          </WorkspaceChrome>
        </>
      );
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-text-secondary">
        {workspaceCopy.errors.noEngines}
      </main>
    );
  }

  return (
    <>
      <WorkspaceChrome
        isDesktopLayout={isDesktopLayout}
        desktopRail={
          <GalleryRail
            engine={selectedEngine}
            engineRegistry={engines}
            activeGroups={normalizedPendingGroups}
            onOpenGroup={openGroupViaGallery}
            onGroupAction={handleGalleryGroupAction}
            onFeedStateChange={handleGalleryFeedStateChange}
            variant="desktop"
          />
        }
        mobileRail={
          <GalleryRail
            engine={selectedEngine}
            engineRegistry={engines}
            activeGroups={normalizedPendingGroups}
            onOpenGroup={openGroupViaGallery}
            onGroupAction={handleGalleryGroupAction}
            onFeedStateChange={handleGalleryFeedStateChange}
            variant="mobile"
          />
        }
      >
            {notice && (
              <div className="rounded-card border border-warning-border bg-warning-bg px-4 py-2 text-sm text-warning shadow-card">
                {notice}
              </div>
            )}
            <div className="stack-gap-lg">
              {showCenterGallery ? (
                normalizedPendingGroups.length === 0 && !isGenerationLoading ? (
                  <div className="rounded-card border border-border bg-surface-glass-80 p-5 text-center text-sm text-text-secondary">
                    {workspaceCopy.gallery.empty}
                  </div>
                ) : (
                  <div className="grid grid-gap-sm sm:grid-cols-2">
                    {normalizedPendingGroups.map((group, index) => {
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
                          eagerPreview={index === 0}
                        />
                      );
                    })}
                    {isGenerationLoading &&
                      Array.from({ length: normalizedPendingGroups.length ? 0 : generationSkeletonCount }).map((_, index) => (
                        <div key={`workspace-gallery-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
                          <div className="relative overflow-hidden rounded-card">
                            <div className="relative" style={{ aspectRatio: '16 / 9' }}>
                              <div className="skeleton absolute inset-0" />
                            </div>
                          </div>
                          <div className="border-t border-border bg-surface-glass-70 px-3 py-2">
                            <div className="h-3 w-24 rounded-full bg-skeleton" />
                          </div>
                        </div>
                      ))}
                  </div>
                )
              ) : null}
              <CompositePreviewDock
                group={displayCompositeGroup}
                isLoading={isGenerationLoading && !displayCompositeGroup}
                autoPlayRequestId={previewAutoPlayRequestId}
                copyPrompt={sharedVideoSettings ? null : sharedPrompt}
                onCopyPrompt={sharedVideoSettings ? undefined : sharedPrompt ? handleCopySharedPrompt : undefined}
                showTitle={false}
                guidedNavigation={guidedNavigation}
                engineSettings={
                  <EngineSettingsBar
                    engines={engines}
                    engineId={form.engineId}
                    onEngineChange={handleEngineChange}
                    mode={activeMode}
                    onModeChange={handleModeChange}
                    modeOptions={engineModeOptions}
                    modeLabel={getEngineModeLabel(selectedEngine?.id, activeMode, uiLocale)}
                    showModeBadge={false}
                  />
                }
                onOpenModal={(group) => {
                  if (!group) return;
                  if (renderGroups.has(group.id)) {
                    setViewerTarget({ kind: 'pending', id: group.id });
                    return;
                  }
                  if (compositeOverrideSummary && compositeOverrideSummary.id === group.id) {
                    setViewerTarget({ kind: 'summary', summary: compositeOverrideSummary });
                    return;
                  }
                  setViewerTarget({ kind: 'group', group });
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
                messages={preflight?.ok ? preflight.messages : undefined}
                textareaRef={composerRef}
                onGenerate={startRender}
                preflight={preflight}
                promptField={inputSchemaSummary.promptField}
                promptRequired={inputSchemaSummary.promptRequired}
                negativePromptField={inputSchemaSummary.negativePromptField}
                negativePromptRequired={inputSchemaSummary.negativePromptRequired}
                modeToggles={composerModeToggles}
                activeManualMode={activeManualMode}
                onModeToggle={handleComposerModeToggle}
                workflowNotice={composerWorkflowNotice}
                promotedActions={composerPromotedActions}
                assetFields={composerAssetFields}
                assets={composerAssets}
                onAssetAdd={handleAssetAdd}
                onAssetRemove={handleAssetRemove}
                onNotice={showNotice}
                onOpenLibrary={handleOpenAssetLibrary}
                multiPrompt={
                  supportsKlingV3Controls
                    ? {
                        enabled: multiPromptEnabled,
                        scenes: multiPromptScenes,
                        totalDurationSec: multiPromptTotalSec,
                        minDurationSec: MULTI_PROMPT_MIN_SEC,
                        maxDurationSec: MULTI_PROMPT_MAX_SEC,
                        onToggle: setMultiPromptEnabled,
                        onAddScene: handleMultiPromptAddScene,
                        onRemoveScene: handleMultiPromptRemoveScene,
                        onUpdateScene: handleMultiPromptUpdateScene,
                        error: multiPromptError,
                      }
                    : null
                }
                disableGenerate={multiPromptInvalid || audioWorkflowUnsupported}
                extraFields={
                  <>
                    {showRetakeWorkflowAction ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Edit workflow</p>
                          <p className="text-xs text-text-secondary">Use retake when you want to reinterpret an existing clip.</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={form.mode === 'retake' ? 'primary' : 'outline'}
                          onClick={() => handleComposerModeToggle(form.mode === 'retake' ? null : 'retake')}
                          disabled={audioWorkflowLocked}
                          title={audioWorkflowLocked ? workflowCopy.removeAudioToUnlock : undefined}
                          className="min-h-0 h-auto rounded-full px-3 py-2 text-[11px] font-semibold tracking-micro"
                        >
                          {getLocalizedModeLabel('retake', uiLocale)}
                        </Button>
                      </div>
                    ) : null}
                    {supportsKlingV3Controls && activeMode === 'i2v' ? (
                      <KlingElementsBuilder
                        elements={klingElements}
                        onAddElement={handleKlingElementAdd}
                        onRemoveElement={handleKlingElementRemove}
                        onAddAsset={handleKlingElementAssetAdd}
                        onRemoveAsset={handleKlingElementAssetRemove}
                        onOpenLibrary={handleOpenKlingAssetLibrary}
                      />
                    ) : null}
                    <SettingsControls
                      engine={selectedEngine}
                      caps={capability}
                      durationSec={multiPromptActive ? multiPromptTotalSec : form.durationSec}
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
                      mode={submissionMode}
                      showAudioControl={supportsAudioToggle}
                      audioEnabled={form.audio}
                      audioControlDisabled={voiceControlEnabled}
                      audioControlNote={voiceControlEnabled ? 'Audio locked by voice control' : undefined}
                      onAudioChange={(audio) => setForm((current) => (current ? { ...current, audio } : current))}
                      showLoopControl={isLumaRay2EngineId(selectedEngine.id) && isLumaRay2GenerateMode(submissionMode)}
                      loopEnabled={
                        isLumaRay2EngineId(selectedEngine.id) && isLumaRay2GenerateMode(submissionMode)
                          ? Boolean(form.loop)
                          : undefined
                      }
                      onLoopChange={(next) =>
                        setForm((current) => (current ? { ...current, loop: next } : current))
                      }
                      showExtendControl={false}
                      seedLocked={form.seedLocked}
                      onSeedLockedChange={(seedLocked) =>
                        setForm((current) => (current ? { ...current, seedLocked } : current))
                      }
                      cfgScale={cfgScale}
                      onCfgScaleChange={(value) => setCfgScale(value)}
                      durationManaged={multiPromptActive}
                      durationManagedLabel={`Duration managed by multi-prompt · ${multiPromptTotalSec}s`}
                      showKlingV3Controls={supportsKlingV3Controls}
                      showKlingV3VoiceControls={supportsKlingV3VoiceControl}
                      klingShotType={shotType}
                      onKlingShotTypeChange={(value) => setShotType(value)}
                      voiceIdsValue={voiceIdsInput}
                      onVoiceIdsChange={(value) => setVoiceIdsInput(value)}
                      voiceControlActive={voiceControlEnabled}
                      showSeedanceControls={isSeedance}
                      seedValue={seedValue}
                      onSeedChange={handleSeedChange}
                      cameraFixed={cameraFixedValue}
                      onCameraFixedChange={handleCameraFixedChange}
                      safetyChecker={safetyCheckerValue}
                      onSafetyCheckerChange={handleSafetyCheckerChange}
                      showSafetyCheckerControl={showSafetyCheckerControl}
                      advancedFields={inputSchemaSummary.secondaryFields}
                      advancedFieldValues={form.extraInputValues}
                      onAdvancedFieldChange={handleExtraInputValueChange}
                      variant="advanced"
                    />
                  </>
                }
                settingsBar={
                  <CoreSettingsBar
                    engine={selectedEngine}
                    mode={submissionMode}
                    caps={capability}
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
                    durationSec={multiPromptActive ? multiPromptTotalSec : form.durationSec}
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
                    showAudioControl={supportsAudioToggle}
                    audioEnabled={form.audio}
                    audioControlDisabled={voiceControlEnabled}
                    audioControlNote={voiceControlEnabled ? 'Audio locked by voice control' : undefined}
                    onAudioChange={(audio) => setForm((current) => (current ? { ...current, audio } : current))}
                    durationManaged={multiPromptActive}
                    durationManagedLabel={`Duration managed by multi-prompt · ${multiPromptTotalSec}s`}
                  />
                }
              />
            </div>
      </WorkspaceChrome>
      {viewerGroup ? (
        <GroupViewerModal
          group={viewerGroup}
          onClose={() => setViewerTarget(null)}
          onRefreshJob={handleRefreshJob}
        />
      ) : null}
      {topUpModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-surface-on-media-dark-40 px-4">
          <div className="absolute inset-0" role="presentation" onClick={closeTopUpModal} />
          <form
            className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float"
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
                        <Button
                          key={value}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectPresetAmount(value)}
                          className={clsx(
                            'min-h-0 h-8 px-3 py-1.5 text-sm font-medium',
                            isActive
                              ? 'border-brand bg-surface-2 text-brand hover:border-brand'
                              : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
                          )}
                        >
                          {formatted}
                        </Button>
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
                        <Input
                          id="custom-topup"
                          type="number"
                          min={10}
                          step={1}
                          value={Math.max(10, Math.round(topUpAmount / 100))}
                          onChange={handleCustomAmountChange}
                          className="h-10 pl-6 pr-3"
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeTopUpModal}
                className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
                aria-label={workspaceCopy.topUp.close}
              >
                {workspaceCopy.topUp.close}
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={closeTopUpModal} className="px-4">
                {workspaceCopy.topUp.maybeLater}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isTopUpLoading}
                className={clsx('px-4', !isTopUpLoading && 'hover:brightness-105')}
              >
                {isTopUpLoading ? workspaceCopy.topUp.submitting : workspaceCopy.topUp.submit}
              </Button>
            </div>
          </form>
        </div>
      )}
      {authModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-surface-on-media-dark-40 px-4">
          <div className="absolute inset-0" role="presentation" onClick={() => setAuthModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-text-primary">{workspaceCopy.authGate.title}</h2>
                <p className="mt-2 text-sm text-text-secondary">{workspaceCopy.authGate.body}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAuthModalOpen(false)}
                className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
                aria-label={workspaceCopy.authGate.close}
              >
                {workspaceCopy.authGate.close}
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ButtonLink href={`/login?next=${encodeURIComponent(loginRedirectTarget)}`} size="sm" className="px-4">
                {workspaceCopy.authGate.primary}
              </ButtonLink>
              <ButtonLink
                href={`/login?mode=signin&next=${encodeURIComponent(loginRedirectTarget)}`}
                variant="outline"
                size="sm"
                className="px-4"
              >
                {workspaceCopy.authGate.secondary}
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
      {assetPickerTarget && (
        <AssetLibraryModal
          fieldLabel={
            assetPickerTarget.kind === 'field'
              ? assetPickerTarget.field.label ?? workspaceCopy.assetLibrary.fieldFallback
              : assetPickerTarget.slot === 'frontal'
                ? 'Kling frontal image'
                : `Kling reference ${typeof assetPickerTarget.slotIndex === 'number' ? assetPickerTarget.slotIndex + 1 : ''}`.trim()
          }
          assetType={assetLibraryKind}
          assets={visibleAssetLibrary}
          isLoading={isAssetLibraryLoading}
          error={assetLibraryError}
          source={assetLibrarySource}
          onSourceChange={(nextSource) => {
            if (nextSource === assetLibrarySource) return;
            setAssetLibrarySource(nextSource);
            setAssetLibraryError(null);
            setAssetLibrary([]);
            setAssetLibraryLoadedKey(null);
          }}
          onClose={() => setAssetPickerTarget(null)}
          onRefresh={(sourceOverride) => fetchAssetLibrary({ source: sourceOverride ?? assetLibrarySource, kind: assetLibraryKind })}
          onSelect={(asset) => {
            if (assetPickerTarget.kind === 'field') {
              void handleSelectLibraryAsset(assetPickerTarget.field, asset, assetPickerTarget.slotIndex);
              return;
            }
            handleSelectKlingLibraryAsset(assetPickerTarget, asset);
          }}
          onDelete={handleDeleteLibraryAsset}
          deletingAssetId={assetDeletePendingId}
        />
      )}
    </>
  );
}
const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);
