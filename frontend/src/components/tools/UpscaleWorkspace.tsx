'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeftRight,
  Coins,
  Download,
  Image as ImageIcon,
  LibraryBig,
  Loader2,
  RefreshCw,
  Save,
  Upload,
  Video,
  WandSparkles,
  ZoomIn,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { HeaderBar } from '@/components/HeaderBar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import {
  AssetLibraryBrowser,
  type AssetBrowserAsset,
  type AssetLibrarySource,
} from '@/components/library/AssetLibraryBrowser';
import { authFetch } from '@/lib/authFetch';
import { getJobStatus, runUpscaleTool, saveAssetToLibrary, useInfiniteJobs } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { normalizeGroupSummaries } from '@/lib/normalize-group-summary';
import { FEATURES } from '@/content/feature-flags';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import {
  DEFAULT_UPSCALE_IMAGE_ENGINE_ID,
  DEFAULT_UPSCALE_VIDEO_ENGINE_ID,
  listUpscaleToolEngines,
} from '@/config/tools-upscale-engines';
import {
  buildUpscalePricingPreview,
  type UpscaleVideoPricingMetadata,
} from '@/lib/tools-upscale';
import type {
  UpscaleMediaType,
  UpscaleMode,
  UpscaleOutputFormat,
  UpscaleTargetResolution,
  UpscaleToolEngineId,
  UpscaleToolOutput,
  UpscaleToolResponse,
} from '@/types/tools-upscale';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';

const SAMPLE_IMAGE_URL =
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp';

const DEFAULT_COPY = {
  disabledTitle: 'Tools are disabled',
  disabledBody: 'Enable `FEATURES.workflows.toolsSection` to access this area.',
  back: 'Back to Tools',
  eyebrow: 'AI Upscale Studio',
  title: 'Upscale images and videos',
  subtitle: 'A clean finishing pass for stills and short clips before they go back into Library, Image, or Video.',
  image: 'Image',
  video: 'Video',
  sourceTitle: 'Source',
  upload: 'Drop or choose file',
  urlPlaceholder: 'Paste an image or video URL',
  uploadFailed: 'Upload failed.',
  settingsTitle: 'Upscale recipe',
  mediaType: 'Media type',
  engine: 'Engine',
  mode: 'Mode',
  factor: 'Factor',
  target: 'Target',
  output: 'Format',
  run: 'Run Upscale',
  running: 'Upscaling...',
  outputTitle: 'Studio preview',
  emptyOutput: 'Add a source and run an upscale to compare the finished asset here.',
  previewSource: 'Source',
  previewResult: 'Result',
  previewCompare: 'Compare',
  previewZoom: 'Pixel zoom',
  previewZoomFit: 'Fit',
  save: 'Save',
  saved: 'Saved to Library.',
  saveFailed: 'Failed to save to Library.',
  download: 'Download',
  recentTitle: 'Recent upscales',
  priceEyebrow: 'Est. price',
  priceLoading: 'Loading price...',
  priceUnavailable: 'Price unavailable',
  priceReady: 'Shown before generation',
  priceVideoLoading: 'Reading video metadata...',
  priceVideoMissing: 'Add a readable video source to estimate.',
  library: 'Library',
  libraryChoose: 'Choose from Library',
  libraryTitle: 'Choose source asset',
  libraryBody: 'Select an image or video already saved in your Library.',
  librarySearch: 'Search assets...',
  librarySourcesTitle: 'Library',
  libraryEmpty: 'No saved assets yet.',
  libraryEmptyImages: 'No saved images yet.',
  libraryEmptyVideos: 'No saved videos yet.',
  libraryEmptySearch: 'No assets match this search.',
  libraryError: 'Failed to load Library assets.',
  libraryRefresh: 'Refresh',
  libraryUse: 'Use',
  libraryCount: '{count} assets',
  libraryTabs: {
    all: 'All assets',
    upload: 'Uploaded',
    generated: 'Generated',
    character: 'Character',
    angle: 'Angle',
    upscale: 'Upscale',
  },
  authTitle: 'Sign in to upscale',
  authBody: 'Uploads, wallet billing, and Library actions require an account.',
  authPrimary: 'Create account',
  authSecondary: 'Sign in',
} as const;

const SOURCE_FALLBACK_WIDTH = 1024;
const SOURCE_FALLBACK_HEIGHT = 1280;

type UploadedAsset = {
  id?: string | null;
  jobId?: string | null;
  url: string;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
  name?: string | null;
};

type PreviewMode = 'source' | 'result' | 'compare';
type PreviewZoom = 'fit' | '100' | '200' | '400';
type RecentUpscaleMedia = {
  url: string;
  thumbUrl?: string | null;
  mediaType: UpscaleMediaType;
  mimeType: string;
  source?: {
    url: string;
    assetId?: string | null;
    jobId?: string | null;
    width?: number | null;
    height?: number | null;
    mimeType: string;
  } | null;
  job: Job;
  engineLabel: string;
  engineId?: string;
  createdAt: string;
  totalCents: number | null;
  currency: string;
};

const PREVIEW_ZOOM_OPTIONS: Array<{ value: PreviewZoom; label: string }> = [
  { value: 'fit', label: 'Fit' },
  { value: '100', label: '100%' },
  { value: '200', label: '200%' },
  { value: '400', label: '400%' },
];

type BillingProductResponse = {
  ok: boolean;
  product?: {
    productKey: string;
    currency: string;
    unitPriceCents: number;
  };
  error?: string;
};

type UserAssetsResponse = {
  ok: boolean;
  assets?: Array<{
    id: string;
    url: string;
    mime?: string | null;
    width?: number | null;
    height?: number | null;
    size?: number | null;
    source?: string | null;
    createdAt?: string;
  }>;
  error?: string;
};

type JobDetailResponse = Partial<Job> & {
  ok?: boolean;
  pricing?: Job['pricingSnapshot'];
  error?: string;
};

type JobsLibraryResponse = {
  ok?: boolean;
  jobs?: Array<{
    jobId: string;
    videoUrl?: string | null;
    readyVideoUrl?: string | null;
    createdAt?: string;
  }>;
  error?: string;
};

function isOutputVideo(output?: UpscaleToolOutput | null) {
  return Boolean(output?.mimeType?.startsWith('video/') || output?.url.match(/\.(mp4|webm|mov)(\?|$)/i));
}

function firstUsableUrl(...values: Array<string | null | undefined>) {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? null;
}

function inferMimeType(url: string, mediaType: UpscaleMediaType) {
  if (mediaType === 'video') {
    if (url.match(/\.webm(\?|$)/i)) return 'video/webm';
    if (url.match(/\.mov(\?|$)/i)) return 'video/quicktime';
    return 'video/mp4';
  }
  if (url.match(/\.jpe?g(\?|$)/i)) return 'image/jpeg';
  if (url.match(/\.webp(\?|$)/i)) return 'image/webp';
  return 'image/png';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseRecentImageVariantIndex(id?: string | null) {
  const match = id?.match(/-image-(\d+)$/);
  if (!match) return 0;
  const index = Number.parseInt(match[1], 10);
  return Number.isFinite(index) && index >= 0 ? index : 0;
}

function resolveRecentUpscaleSource(job: Job): RecentUpscaleMedia['source'] {
  const snapshot = asRecord(job.settingsSnapshot);
  const source = asRecord(snapshot?.source);
  const rawUrl = source?.mediaUrl;
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!url) return null;

  const metadata = asRecord(source?.metadata);
  const mediaType = snapshot?.mediaType === 'video' ? 'video' : 'image';
  return {
    url,
    assetId: typeof source?.sourceAssetId === 'string' ? source.sourceAssetId : null,
    jobId: typeof source?.sourceJobId === 'string' ? source.sourceJobId : null,
    width: finiteNumber(metadata?.width),
    height: finiteNumber(metadata?.height),
    mimeType: inferMimeType(url, mediaType),
  };
}

function resolveRecentUpscaleMedia(job: Job | null | undefined, preferredImageIndex = 0): RecentUpscaleMedia | null {
  if (!job) return null;
  const videoUrl = firstUsableUrl(job.videoUrl, job.readyVideoUrl);
  const totalCents = job.finalPriceCents ?? job.pricingSnapshot?.totalCents ?? null;
  const currency = job.currency ?? job.pricingSnapshot?.currency ?? 'USD';
  const source = resolveRecentUpscaleSource(job);
  if (videoUrl) {
    return {
      url: videoUrl,
      thumbUrl: job.thumbUrl ?? job.previewFrame ?? null,
      mediaType: 'video',
      mimeType: inferMimeType(videoUrl, 'video'),
      source,
      job,
      engineLabel: job.engineLabel,
      engineId: job.engineId,
      createdAt: job.createdAt,
      totalCents,
      currency,
    };
  }

  const renderIds = Array.isArray(job.renderIds)
    ? job.renderIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const renderThumbs = Array.isArray(job.renderThumbUrls)
    ? job.renderThumbUrls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const imageUrl = firstUsableUrl(job.heroRenderId, renderIds[preferredImageIndex], renderIds[0], job.thumbUrl, job.previewFrame);
  if (!imageUrl) return null;
  return {
    url: imageUrl,
    thumbUrl: renderThumbs[preferredImageIndex] ?? renderThumbs[0] ?? job.thumbUrl ?? job.previewFrame ?? imageUrl,
    mediaType: 'image',
    mimeType: inferMimeType(imageUrl, 'image'),
    source,
    job,
    engineLabel: job.engineLabel,
    engineId: job.engineId,
    createdAt: job.createdAt,
    totalCents,
    currency,
  };
}

function resolveRecentUpscaleMediaFromGroup(group: GroupSummary): RecentUpscaleMedia | null {
  const heroJob = group.hero.job ?? null;
  const fallbackJob = group.members.find((member) => member.job)?.job ?? null;
  const variantIndex = parseRecentImageVariantIndex(group.hero.id);
  return resolveRecentUpscaleMedia(heroJob ?? fallbackJob, variantIndex);
}

function resolveRecentUpscaleJobFromGroup(group: GroupSummary): Job | null {
  return group.hero.job ?? group.members.find((member) => member.job)?.job ?? null;
}

function resolveGeneratedImageSource(job: Job | null | undefined): UploadedAsset | null {
  if (!job) return null;
  const renderIds = Array.isArray(job.renderIds)
    ? job.renderIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const imageUrl = firstUsableUrl(job.heroRenderId, renderIds[0], job.thumbUrl, job.previewFrame);
  if (!imageUrl) return null;
  return {
    id: null,
    jobId: job.jobId,
    url: imageUrl,
    mime: inferMimeType(imageUrl, 'image'),
    name: `Generated image · ${job.engineLabel}`,
  };
}

function hasRenderableUpscaleJobMedia(job: Job): boolean {
  const hasImageMedia = Array.isArray(job.renderIds) && job.renderIds.some((value) => typeof value === 'string' && value.trim().length > 0);
  return Boolean(firstUsableUrl(job.videoUrl, job.readyVideoUrl, job.audioUrl) || hasImageMedia);
}

function resolveUpscaleEngineId(value: string | undefined, mediaType: UpscaleMediaType): UpscaleToolEngineId {
  const engines = listUpscaleToolEngines(mediaType);
  return (
    engines.find((entry) => entry.id === value)?.id ??
    (mediaType === 'video' ? DEFAULT_UPSCALE_VIDEO_ENGINE_ID : DEFAULT_UPSCALE_IMAGE_ENGINE_ID)
  );
}

function mediaTypeFromMime(mime?: string | null): UpscaleMediaType | null {
  if (!mime) return null;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

async function uploadSourceFile(file: File, mediaType: UpscaleMediaType): Promise<UploadedAsset> {
  const form = new FormData();
  form.append('file', file);
  const response = await authFetch(mediaType === 'video' ? '/api/uploads/video' : '/api/uploads/image', {
    method: 'POST',
    body: form,
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    asset?: UploadedAsset;
  } | null;
  if (!response.ok || !payload?.ok || !payload.asset?.url) {
    throw new Error(payload?.error ?? `Upload failed (${response.status})`);
  }
  return payload.asset;
}

function formatCurrency(amountCents?: number | null, currency = 'USD', locale?: string): string {
  if (typeof amountCents !== 'number') return '-';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

function readVideoPricingMetadata(url: string): Promise<UpscaleVideoPricingMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanup();
      if (width > 0 && height > 0 && durationSec > 0) {
        resolve({ width, height, durationSec });
        return;
      }
      reject(new Error('Video metadata unavailable'));
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Video metadata unavailable'));
    };
    video.src = url;
  });
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{children}</span>;
}

function clampComparePosition(value: number) {
  return Math.min(92, Math.max(8, value));
}

function buildLibraryCacheKey(kind: UpscaleMediaType, source: AssetLibrarySource) {
  return `${kind}:${source}`;
}

function SegmentButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-input border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'border-brand bg-brand text-on-brand shadow-card'
          : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

export default function UpscaleWorkspace() {
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale, t } = useI18n();
  const copy = {
    ...DEFAULT_COPY,
    ...((t('workspace.upscale') ?? {}) as Partial<typeof DEFAULT_COPY>),
  };
  const [mediaType, setMediaType] = useState<UpscaleMediaType>('image');
  const [engineId, setEngineId] = useState<UpscaleToolEngineId>(DEFAULT_UPSCALE_IMAGE_ENGINE_ID);
  const [source, setSource] = useState<UploadedAsset | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mode, setMode] = useState<UpscaleMode>('factor');
  const [upscaleFactor, setUpscaleFactor] = useState(2);
  const [targetResolution, setTargetResolution] = useState<UpscaleTargetResolution>('1080p');
  const [outputFormat, setOutputFormat] = useState<UpscaleOutputFormat>('jpg');
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<UpscaleToolResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<UpscaleVideoPricingMetadata | null>(null);
  const [videoMetadataLoading, setVideoMetadataLoading] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const [compareDragging, setCompareDragging] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('source');
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>('fit');
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<AssetBrowserAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [librarySource, setLibrarySource] = useState<AssetLibrarySource>('all');
  const [libraryLoadedKey, setLibraryLoadedKey] = useState<string | null>(null);
  const [activeRecentGroupId, setActiveRecentGroupId] = useState<string | null>(null);
  const [savingRecentGroupId, setSavingRecentGroupId] = useState<string | null>(null);
  const previewScrollerRef = useRef<HTMLDivElement | null>(null);
  const defaultGeneratedImageAppliedRef = useRef(false);
  const { stableJobs: recentJobs, mutate } = useInfiniteJobs(12, { surface: 'upscale' });
  const { stableJobs: recentGeneratedImageJobs } = useInfiniteJobs(8, { surface: 'image' });

  const engines = useMemo(() => listUpscaleToolEngines(mediaType), [mediaType]);
  const engine = useMemo(() => engines.find((entry) => entry.id === engineId) ?? engines[0], [engineId, engines]);
  const billingProductKey = engine?.billingProductKey ?? null;
  const {
    data: billingProductData,
    error: billingProductError,
    isLoading: billingProductLoading,
  } = useSWR(
    billingProductKey ? `/api/billing-products?productKey=${encodeURIComponent(billingProductKey)}` : null,
    async (url: string) => {
      const response = await authFetch(url);
      const payload = (await response.json().catch(() => null)) as BillingProductResponse | null;
      if (!response.ok || !payload?.ok || !payload.product) {
        throw new Error(payload?.error ?? copy.priceUnavailable);
      }
      return payload.product;
    },
    { keepPreviousData: true }
  );
  const output = result?.output ?? null;
  const pricePreview = useMemo(
    () =>
      buildUpscalePricingPreview({
        mediaType,
        engineId: engine.id,
        unitPriceCents: billingProductData?.unitPriceCents ?? null,
        currency: billingProductData?.currency ?? 'USD',
        imageWidth: mediaType === 'image' ? source?.width ?? null : null,
        imageHeight: mediaType === 'image' ? source?.height ?? null : null,
        videoMetadata: mediaType === 'video' ? videoMetadata : null,
        targetResolution: mode === 'target' ? targetResolution : null,
        upscaleFactor,
      }),
    [
      billingProductData?.currency,
      billingProductData?.unitPriceCents,
      engine.id,
      mediaType,
      mode,
      source?.height,
      source?.width,
      targetResolution,
      upscaleFactor,
      videoMetadata,
    ]
  );
  const priceLabel = formatCurrency(pricePreview.totalCents, pricePreview.currency, locale);
  const priceHint = billingProductLoading
    ? copy.priceLoading
    : billingProductError
      ? copy.priceUnavailable
      : mediaType === 'video' && videoMetadataLoading
        ? copy.priceVideoLoading
        : mediaType === 'video' && !pricePreview.ready
          ? copy.priceVideoMissing
          : copy.priceReady;
  const canRun = Boolean(user && mediaUrl.trim() && engine && !running && !uploading);
  const hasResult = Boolean(output?.url);
  const hasSourcePreview = Boolean(mediaUrl.trim());
  const canCompare = hasResult && hasSourcePreview && result?.mediaType === mediaType;
  const activePreviewMode: PreviewMode = hasResult ? (previewMode === 'compare' && !canCompare ? 'result' : previewMode) : 'source';
  const sourcePreviewUrl = mediaUrl || SAMPLE_IMAGE_URL;
  const resultPreviewUrl = output?.url || mediaUrl || SAMPLE_IMAGE_URL;
  const sourcePreviewIsVideo = mediaType === 'video' && Boolean(mediaUrl);
  const resultPreviewIsVideo = output ? isOutputVideo(output) : sourcePreviewIsVideo;
  const compareEnabled = activePreviewMode === 'compare' && canCompare;
  const previewZoomScale = previewZoom === 'fit' ? 1 : Number(previewZoom) / 100;
  const isPixelZoom = previewZoom !== 'fit';
  const mediaFitClass = 'object-contain';
  const sourceWidth = source?.width ?? SOURCE_FALLBACK_WIDTH;
  const sourceHeight = source?.height ?? SOURCE_FALLBACK_HEIGHT;
  const previewFactor = mode === 'factor' ? upscaleFactor : 2;
  const outputWidth = output?.width ?? Math.round(sourceWidth * previewFactor);
  const outputHeight = output?.height ?? Math.round(sourceHeight * previewFactor);
  const sourceSizeLabel = `${sourceWidth} x ${sourceHeight}`;
  const outputSizeLabel = `${outputWidth} x ${outputHeight}`;
  const zoomCanvasWidth = activePreviewMode === 'source' ? sourceWidth : outputWidth;
  const zoomCanvasHeight = activePreviewMode === 'source' ? sourceHeight : outputHeight;
  const mediaTypeLabel = mediaType === 'video' ? 'Video' : 'Image';
  const libraryCacheKey = libraryModalOpen ? buildLibraryCacheKey(mediaType, librarySource) : null;
  const librarySourceOptions = useMemo(
    () =>
      mediaType === 'video'
        ? (['all', 'upload', 'generated', 'upscale'] as const)
        : (['all', 'upload', 'generated', 'character', 'angle', 'upscale'] as const),
    [mediaType]
  );
  const visibleLibraryAssets = useMemo(
    () =>
      libraryAssets.filter((asset) =>
        mediaType === 'video'
          ? asset.kind === 'video' || asset.mime?.startsWith('video/')
          : asset.kind === 'image' || !asset.mime || asset.mime.startsWith('image/')
      ),
    [libraryAssets, mediaType]
  );
  const recentGroups = useMemo(() => {
    const jobs = recentJobs.map((job) => (!job.videoUrl && job.readyVideoUrl ? { ...job, videoUrl: job.readyVideoUrl } : job));
    return normalizeGroupSummaries(groupJobsIntoSummaries(jobs, { includeSinglesAsGroups: true }).groups);
  }, [recentJobs]);
  const pendingRecentJobIds = useMemo(
    () =>
      recentJobs
        .filter((job) => {
          const status = typeof job.status === 'string' ? job.status.toLowerCase() : '';
          if (status === 'failed' || status === 'cancelled' || status === 'canceled') return false;
          return status !== 'completed' || !hasRenderableUpscaleJobMedia(job);
        })
        .map((job) => job.jobId)
        .filter((jobId): jobId is string => typeof jobId === 'string' && jobId.length > 0),
    [recentJobs]
  );
  const pendingRecentJobKey = pendingRecentJobIds.join('|');
  const defaultGeneratedImageSource = useMemo(() => {
    const sortedJobs = [...recentGeneratedImageJobs].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
    for (const job of sortedJobs) {
      const candidate = resolveGeneratedImageSource(job);
      if (candidate) return candidate;
    }
    return null;
  }, [recentGeneratedImageJobs]);

  useEffect(() => {
    const url = mediaUrl.trim();
    if (mediaType !== 'video' || !url) {
      setVideoMetadata(null);
      setVideoMetadataLoading(false);
      return;
    }

    let cancelled = false;
    setVideoMetadata(null);
    setVideoMetadataLoading(true);
    readVideoPricingMetadata(url)
      .then((metadata) => {
        if (!cancelled) setVideoMetadata(metadata);
      })
      .catch(() => {
        if (!cancelled) setVideoMetadata(null);
      })
      .finally(() => {
        if (!cancelled) setVideoMetadataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaType, mediaUrl]);

  useEffect(() => {
    if (typeof window === 'undefined' || !pendingRecentJobKey) return undefined;
    let cancelled = false;
    const jobIds = pendingRecentJobKey.split('|').filter(Boolean);
    const pollPendingJobs = async () => {
      await Promise.all(jobIds.map((jobId) => getJobStatus(jobId).catch(() => null)));
      if (!cancelled) {
        void mutate();
      }
    };
    void pollPendingJobs();
    const interval = window.setInterval(() => {
      void pollPendingJobs();
    }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mutate, pendingRecentJobKey]);

  useEffect(() => {
    const url = mediaUrl.trim();
    if (mediaType !== 'image' || !url) return undefined;
    if (source?.url === url && source.width && source.height) return undefined;

    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled || !image.naturalWidth || !image.naturalHeight) return;
      setSource((current) => {
        if (current?.url && current.url !== url) return current;
        return {
          ...(current ?? {}),
          url,
          width: current?.width ?? image.naturalWidth,
          height: current?.height ?? image.naturalHeight,
          mime: current?.mime ?? inferMimeType(url, 'image'),
        };
      });
    };
    image.src = url;
    return () => {
      cancelled = true;
    };
  }, [mediaType, mediaUrl, source?.height, source?.url, source?.width]);

  useEffect(() => {
    if (defaultGeneratedImageAppliedRef.current) return;
    if (!user || mediaType !== 'image' || source || result || mediaUrl.trim() || !defaultGeneratedImageSource) return;
    defaultGeneratedImageAppliedRef.current = true;
    setSource(defaultGeneratedImageSource);
    setMediaUrl(defaultGeneratedImageSource.url);
    setPreviewMode('source');
    setPreviewZoom('100');
    setMessage(defaultGeneratedImageSource.name ?? null);
  }, [defaultGeneratedImageSource, mediaType, mediaUrl, result, source, user]);

  useEffect(() => {
    const scroller = previewScrollerRef.current;
    if (!scroller) return undefined;
    if (!isPixelZoom) {
      scroller.scrollLeft = 0;
      scroller.scrollTop = 0;
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      scroller.scrollLeft = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
      scroller.scrollTop = Math.max(0, (scroller.scrollHeight - scroller.clientHeight) / 2);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePreviewMode, isPixelZoom, previewZoom, resultPreviewUrl, sourcePreviewUrl]);

  const fetchLibraryAssets = useCallback(
    async (options?: { source?: AssetLibrarySource; kind?: UpscaleMediaType }) => {
      const sourceFilter = options?.source ?? librarySource;
      const kind = options?.kind ?? mediaType;
      const requestKey = buildLibraryCacheKey(kind, sourceFilter);
      setLibraryLoading(true);
      setLibraryError(null);
      try {
        if (!user) {
          setLibraryAssets([]);
          setLibraryError(kind === 'video' ? 'Sign in to access your video library.' : 'Sign in to access your image library.');
          setLibraryLoadedKey(requestKey);
          return;
        }

        const assetUrl =
          sourceFilter === 'all'
            ? '/api/user-assets?limit=80'
            : `/api/user-assets?limit=80&source=${encodeURIComponent(sourceFilter)}`;
        const requests: Array<Promise<Response>> = [authFetch(assetUrl)];
        if (kind === 'video' && sourceFilter !== 'upload') {
          const jobsUrl = sourceFilter === 'upscale' ? '/api/jobs?limit=80&surface=upscale' : '/api/jobs?limit=80&type=video';
          requests.push(authFetch(jobsUrl));
        }

        const [assetsResponse, jobsResponse] = await Promise.all(requests);
        if (assetsResponse.status === 401 || jobsResponse?.status === 401) {
          setLibraryAssets([]);
          setLibraryError(kind === 'video' ? 'Sign in to access your video library.' : 'Sign in to access your image library.');
          setLibraryLoadedKey(requestKey);
          return;
        }

        const assetsPayload = (await assetsResponse.json().catch(() => null)) as UserAssetsResponse | null;
        if (!assetsResponse.ok || !assetsPayload?.ok) {
          throw new Error(assetsPayload?.error ?? copy.libraryError);
        }

        const savedAssets = Array.isArray(assetsPayload.assets)
          ? assetsPayload.assets.map((asset) => {
              const mime = asset.mime ?? null;
              return {
                id: asset.id,
                url: asset.url,
                kind: mime?.startsWith('video/') ? 'video' : 'image',
                width: asset.width ?? null,
                height: asset.height ?? null,
                size: asset.size ?? null,
                mime,
                source: asset.source ?? null,
                createdAt: asset.createdAt,
                canDelete: false,
              } satisfies AssetBrowserAsset;
            })
          : [];
        const filteredAssets = savedAssets.filter((asset) =>
          kind === 'video'
            ? asset.kind === 'video' || asset.mime?.startsWith('video/')
            : asset.kind === 'image' || !asset.mime || asset.mime.startsWith('image/')
        );

        let generatedVideos: AssetBrowserAsset[] = [];
        if (kind === 'video' && jobsResponse) {
          const jobsPayload = (await jobsResponse.json().catch(() => null)) as JobsLibraryResponse | null;
          if (jobsResponse.ok && Array.isArray(jobsPayload?.jobs)) {
            generatedVideos = jobsPayload.jobs
              .map((job) => ({
                id: `job:${job.jobId}`,
                url: job.videoUrl ?? job.readyVideoUrl ?? '',
                kind: 'video' as const,
                mime: 'video/mp4',
                source: 'generated',
                createdAt: job.createdAt,
                canDelete: false,
              }))
              .filter((asset) => asset.url.trim().length > 0);
          }
        }

        const combined = kind === 'video' ? [...filteredAssets, ...generatedVideos] : filteredAssets;
        const deduped = combined.filter(
          (asset, index, list) => list.findIndex((entry) => entry.url === asset.url) === index
        );
        setLibraryAssets(deduped);
        setLibraryLoadedKey(requestKey);
      } catch (libraryLoadError) {
        console.error('[upscale] failed to load library assets', libraryLoadError);
        setLibraryAssets([]);
        setLibraryError(libraryLoadError instanceof Error ? libraryLoadError.message : copy.libraryError);
        setLibraryLoadedKey(requestKey);
      } finally {
        setLibraryLoading(false);
      }
    },
    [copy.libraryError, librarySource, mediaType, user]
  );

  useEffect(() => {
    if (!libraryModalOpen || !libraryCacheKey || libraryLoading) return;
    if (libraryLoadedKey === libraryCacheKey) return;
    setLibraryAssets([]);
    setLibraryError(null);
    void fetchLibraryAssets({ kind: mediaType, source: librarySource });
  }, [
    fetchLibraryAssets,
    libraryCacheKey,
    libraryLoadedKey,
    libraryLoading,
    libraryModalOpen,
    librarySource,
    mediaType,
  ]);

  function changeMediaType(next: UpscaleMediaType) {
    setMediaType(next);
    const nextEngine = next === 'video' ? DEFAULT_UPSCALE_VIDEO_ENGINE_ID : DEFAULT_UPSCALE_IMAGE_ENGINE_ID;
    const resolved = listUpscaleToolEngines(next).find((entry) => entry.id === nextEngine) ?? listUpscaleToolEngines(next)[0];
    setEngineId(resolved.id);
    setMode(resolved.defaultMode);
    setUpscaleFactor(resolved.defaultUpscaleFactor);
    setTargetResolution(resolved.defaultTargetResolution ?? '1080p');
    setOutputFormat(resolved.defaultOutputFormat);
    setSource(null);
    setMediaUrl('');
    setResult(null);
    setError(null);
    setMessage(null);
    setPreviewMode('source');
    setLibraryAssets([]);
    setLibraryError(null);
    setLibraryLoadedKey(null);
    setLibrarySource(next === 'video' ? 'generated' : 'all');
  }

  function changeEngine(nextId: UpscaleToolEngineId) {
    const nextEngine = engines.find((entry) => entry.id === nextId);
    if (!nextEngine) return;
    setEngineId(nextEngine.id);
    setMode(nextEngine.defaultMode);
    setUpscaleFactor(nextEngine.defaultUpscaleFactor);
    setTargetResolution(nextEngine.defaultTargetResolution ?? '1080p');
    setOutputFormat(nextEngine.defaultOutputFormat);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const detectedType = mediaTypeFromMime(file.type);
    const nextMediaType = detectedType ?? mediaType;
    if (nextMediaType !== mediaType) changeMediaType(nextMediaType);
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const uploaded = await uploadSourceFile(file, nextMediaType);
      setSource(uploaded);
      setMediaUrl(uploaded.url);
      setResult(null);
      setPreviewMode('source');
      setMessage(uploaded.name ?? file.name);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : copy.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  async function handleRun() {
    if (!canRun || !engine) return;
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const response = await runUpscaleTool({
        mediaType,
        mediaUrl: mediaUrl.trim(),
        engineId: engine.id,
        mode,
        upscaleFactor,
        targetResolution,
        outputFormat,
        sourceJobId: source?.jobId ?? null,
        sourceAssetId: source?.id ?? null,
        imageWidth: source?.width ?? null,
        imageHeight: source?.height ?? null,
      });
      setResult(response);
      setPreviewMode('compare');
      setActiveRecentGroupId(response.jobId ?? null);
      setMessage(`${response.engineLabel} · $${response.pricing.estimatedCostUsd.toFixed(2)}`);
      void mutate();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Upscale failed.');
    } finally {
      setRunning(false);
    }
  }

  async function handleSave() {
    if (!output?.url) return;
    setError(null);
    try {
      await saveAssetToLibrary({
        url: output.url,
        jobId: result?.jobId ?? null,
        label: result?.engineLabel ?? 'Upscale',
        source: 'upscale',
        kind: result?.mediaType ?? mediaType,
      });
      setMessage(copy.saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    }
  }

  function handleDownload() {
    if (!output?.url) return;
    triggerAppDownload(output.url, suggestDownloadFilename(output.url, `upscale-${mediaType}`));
  }

  function openLibraryModal() {
    const nextSource: AssetLibrarySource = mediaType === 'video' ? 'generated' : 'all';
    if (librarySource !== nextSource) {
      setLibrarySource(nextSource);
      setLibraryAssets([]);
      setLibraryError(null);
      setLibraryLoadedKey(null);
    }
    setLibraryModalOpen(true);
  }

  function selectLibraryAsset(asset: AssetBrowserAsset) {
    const nextMediaType: UpscaleMediaType = asset.kind === 'video' || asset.mime?.startsWith('video/') ? 'video' : 'image';
    if (nextMediaType !== mediaType) {
      setMediaType(nextMediaType);
      const nextEngine = nextMediaType === 'video' ? DEFAULT_UPSCALE_VIDEO_ENGINE_ID : DEFAULT_UPSCALE_IMAGE_ENGINE_ID;
      const resolved =
        listUpscaleToolEngines(nextMediaType).find((entry) => entry.id === nextEngine) ??
        listUpscaleToolEngines(nextMediaType)[0];
      setEngineId(resolved.id);
      setMode(resolved.defaultMode);
      setUpscaleFactor(resolved.defaultUpscaleFactor);
      setTargetResolution(resolved.defaultTargetResolution ?? '1080p');
      setOutputFormat(resolved.defaultOutputFormat);
    }
    setSource({
      id: asset.id.startsWith('job:') ? null : asset.id,
      jobId: asset.id.startsWith('job:') ? asset.id.slice(4) : null,
      url: asset.url,
      width: asset.width ?? null,
      height: asset.height ?? null,
      mime: asset.mime ?? (nextMediaType === 'video' ? 'video/mp4' : 'image/png'),
      name: asset.source ? `${asset.source} asset` : copy.library,
    });
    setMediaUrl(asset.url);
    setResult(null);
    setPreviewMode('source');
    setError(null);
    setMessage(asset.source ? `${copy.library}: ${asset.source}` : copy.library);
    setLibraryModalOpen(false);
  }

  function buildRecentUpscaleResult(selection: RecentUpscaleMedia): UpscaleToolResponse {
    const resolvedEngineId = resolveUpscaleEngineId(selection.engineId, selection.mediaType);
    const totalCents = selection.totalCents ?? 0;
    return {
      ok: true,
      jobId: selection.job.jobId,
      engineId: resolvedEngineId,
      engineLabel: selection.engineLabel,
      mediaType: selection.mediaType,
      latencyMs: 0,
      pricing: {
        estimatedCostUsd: totalCents / 100,
        actualCostUsd: selection.totalCents == null ? null : totalCents / 100,
        currency: selection.currency,
        estimatedCredits: totalCents,
        actualCredits: selection.totalCents,
        totalCents: selection.totalCents,
        billingProductKey: selection.job.billingProductKey ?? null,
      },
      output: {
        url: selection.url,
        thumbUrl: selection.thumbUrl ?? null,
        mimeType: selection.mimeType,
        originUrl: selection.url,
        source: 'upscale',
        persisted: true,
      },
    };
  }

  function applyRecentUpscaleMediaType(selection: RecentUpscaleMedia) {
    if (selection.mediaType === mediaType) return;
    const nextEngineId = resolveUpscaleEngineId(selection.engineId, selection.mediaType);
    const resolved =
      listUpscaleToolEngines(selection.mediaType).find((entry) => entry.id === nextEngineId) ??
      listUpscaleToolEngines(selection.mediaType)[0];
    setMediaType(selection.mediaType);
    setEngineId(resolved.id);
    setMode(resolved.defaultMode);
    setUpscaleFactor(resolved.defaultUpscaleFactor);
    setTargetResolution(resolved.defaultTargetResolution ?? '1080p');
    setOutputFormat(resolved.defaultOutputFormat);
    setVideoMetadata(null);
  }

  async function resolveRecentSelectionWithSource(group: GroupSummary): Promise<RecentUpscaleMedia | null> {
    const selection = resolveRecentUpscaleMediaFromGroup(group);
    if (selection?.source?.url) return selection;

    const baseJob = resolveRecentUpscaleJobFromGroup(group);
    if (!baseJob?.jobId) return selection;

    try {
      const response = await authFetch(`/api/jobs/${encodeURIComponent(baseJob.jobId)}`);
      const payload = (await response.json().catch(() => null)) as JobDetailResponse | null;
      if (!response.ok || !payload?.ok) return selection;
      const detailedJob: Job = {
        ...baseJob,
        settingsSnapshot: payload.settingsSnapshot ?? baseJob.settingsSnapshot,
        renderIds: payload.renderIds ?? baseJob.renderIds,
        renderThumbUrls: payload.renderThumbUrls ?? baseJob.renderThumbUrls,
        heroRenderId: payload.heroRenderId ?? baseJob.heroRenderId,
        videoUrl: payload.videoUrl ?? baseJob.videoUrl,
        readyVideoUrl: payload.readyVideoUrl ?? baseJob.readyVideoUrl,
        thumbUrl: payload.thumbUrl ?? baseJob.thumbUrl,
        previewFrame: payload.previewFrame ?? baseJob.previewFrame,
        finalPriceCents: payload.finalPriceCents ?? baseJob.finalPriceCents,
        currency: payload.currency ?? baseJob.currency,
        pricingSnapshot: payload.pricingSnapshot ?? payload.pricing ?? baseJob.pricingSnapshot,
      };
      return resolveRecentUpscaleMedia(detailedJob, parseRecentImageVariantIndex(group.hero.id)) ?? selection;
    } catch {
      return selection;
    }
  }

  async function selectRecentUpscale(group: GroupSummary) {
    setError(null);
    const selection = await resolveRecentSelectionWithSource(group);
    if (!selection) {
      setError('No finished upscale output is available for this job yet.');
      return;
    }
    applyRecentUpscaleMediaType(selection);
    if (selection.source?.url) {
      setSource({
        id: selection.source.assetId ?? null,
        jobId: selection.source.jobId ?? null,
        url: selection.source.url,
        width: selection.source.width ?? null,
        height: selection.source.height ?? null,
        mime: selection.source.mimeType,
        name: 'Recent upscale source',
      });
      setMediaUrl(selection.source.url);
    }
    setResult(buildRecentUpscaleResult(selection));
    setActiveRecentGroupId(group.id);
    setError(null);
    setMessage(
      selection.totalCents == null
        ? selection.engineLabel
        : `${selection.engineLabel} · ${formatCurrency(selection.totalCents, selection.currency, locale)}`
    );
    setPreviewMode(selection.source?.url || (hasSourcePreview && selection.mediaType === mediaType) ? 'compare' : 'result');
  }

  async function saveRecentUpscale(group: GroupSummary) {
    const selection = resolveRecentUpscaleMediaFromGroup(group);
    if (!selection) {
      setError('No finished upscale output is available for this job yet.');
      return;
    }
    setSavingRecentGroupId(group.id);
    setError(null);
    try {
      await saveAssetToLibrary({
        url: selection.url,
        jobId: selection.job.jobId,
        label: selection.engineLabel,
        source: 'upscale',
        kind: selection.mediaType,
      });
      setMessage(copy.saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    } finally {
      setSavingRecentGroupId(null);
    }
  }

  function handleRecentGroupAction(group: GroupSummary, action: GroupedJobAction) {
    const selection = resolveRecentUpscaleMediaFromGroup(group);
    if ((action === 'open' || action === 'view' || action === 'compare' || action === 'continue' || action === 'refine' || action === 'branch') && selection) {
      void selectRecentUpscale(group);
      return;
    }
    if (!selection) {
      setError('No finished upscale output is available for this job yet.');
      return;
    }
    if (action === 'download') {
      triggerAppDownload(selection.url, suggestDownloadFilename(selection.url, `upscale-${selection.job.jobId}`));
      return;
    }
    if (action === 'copy') {
      void navigator.clipboard
        ?.writeText(selection.url)
        .then(() => setMessage('Link copied.'))
        .catch(() => setError('Unable to copy link.'));
      return;
    }
    if (action === 'save-image') {
      void saveRecentUpscale(group);
    }
  }

  function updateComparePosition(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextPosition = ((event.clientX - rect.left) / rect.width) * 100;
    setComparePosition(clampComparePosition(nextPosition));
  }

  function handleComparePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setCompareDragging(true);
    updateComparePosition(event);
  }

  function handleComparePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!compareDragging) return;
    updateComparePosition(event);
  }

  function handleComparePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setCompareDragging(false);
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
            <div className="h-64 animate-pulse rounded-card border border-border bg-surface" />
          </main>
        </div>
      </div>
    );
  }

  if (!FEATURES.workflows.toolsSection) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
            <Card>
              <h1 className="text-2xl font-semibold text-text-primary">{copy.disabledTitle}</h1>
              <p className="mt-2 text-sm text-text-secondary">{copy.disabledBody}</p>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text-primary">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] px-5 py-5 lg:px-8 lg:py-6">
            <div className="mb-4">
              <ButtonLink
                href="/app/tools"
                variant="ghost"
                size="sm"
                linkComponent={Link}
                className="gap-2 text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                {copy.back}
              </ButtonLink>
            </div>
            <section className="relative overflow-hidden rounded-[28px] border border-border bg-[radial-gradient(circle_at_22%_8%,var(--brand-soft),transparent_32%),linear-gradient(90deg,var(--surface)_0%,var(--surface-2)_58%,var(--bg)_100%)] px-6 py-7 lg:px-10 lg:py-9">
              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-text-primary">{copy.eyebrow}</p>
                  <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-text-primary lg:text-[44px] lg:leading-[1.05]">
                    {copy.title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-text-secondary">{copy.subtitle}</p>
                </div>

                <div className="rounded-[20px] border border-border bg-surface-glass-90 p-5 shadow-card backdrop-blur">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand text-on-brand">
                      <WandSparkles className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-text-primary">{engine?.label ?? 'Upscale engine'}</p>
                        <span className="rounded-full border border-success-border bg-success-bg px-2.5 py-1 text-[11px] font-semibold text-success">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Mode</p>
                      <p className="mt-1 text-sm font-semibold text-text-primary">{mode === 'target' ? targetResolution : `${upscaleFactor}x`}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Type</p>
                      <p className="mt-1 text-sm font-semibold text-text-primary">{mediaTypeLabel}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Format</p>
                      <p className="mt-1 text-sm font-semibold text-text-primary">{outputFormat.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Price</p>
                      <p className="mt-1 text-sm font-semibold text-text-primary">{priceLabel}</p>
                    </div>
                  </div>
                  <Button className="mt-5 w-full rounded-[10px] bg-brand py-3 text-on-brand hover:bg-brand-hover" onClick={handleRun} disabled={!canRun}>
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                    {running ? copy.running : copy.run}
                  </Button>
                </div>
              </div>
            </section>

            <div className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <section className="contents xl:sticky xl:top-5 xl:block xl:space-y-4 xl:self-start">
                <Card className="order-1 rounded-[14px] border border-border bg-surface p-5 shadow-card xl:order-none">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-text-secondary">1</span>
                      <div>
                        <h2 className="text-base font-semibold text-text-primary">Source asset</h2>
                        <p className="mt-1 text-xs text-text-muted">Add the asset you want to upscale.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openLibraryModal}
                      disabled={!user || running || uploading}
                      className="h-9 shrink-0 rounded-[10px] border-border bg-surface px-3 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    >
                      <LibraryBig className="h-4 w-4" />
                      {copy.library}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <SegmentButton active={mediaType === 'image'} disabled={running || uploading} onClick={() => changeMediaType('image')}>
                      <ImageIcon className="h-4 w-4" />
                      {copy.image}
                    </SegmentButton>
                    <SegmentButton active={mediaType === 'video'} disabled={running || uploading} onClick={() => changeMediaType('video')}>
                      <Video className="h-4 w-4" />
                      {copy.video}
                    </SegmentButton>
                  </div>

                  <label className="mt-4 block cursor-pointer rounded-[12px] border border-dashed border-border bg-bg p-8 text-center transition hover:border-border-hover hover:bg-surface-hover">
                    <input
                      type="file"
                      accept={mediaType === 'image' ? 'image/*' : 'video/*'}
                      onChange={handleUpload}
                      disabled={!user || uploading || running}
                      className="sr-only"
                    />
                    <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-text-primary shadow-card">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-text-primary">Drop file here</span>
                    <span className="mt-1 block text-xs text-text-muted">{source?.name ?? (mediaType === 'video' ? 'MP4, WebM, MOV' : 'PNG, JPG, WebP up to 200MB')}</span>
                  </label>

                  <div className="my-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-hairline" />
                    <span className="text-[11px] text-text-muted">or</span>
                    <span className="h-px flex-1 bg-hairline" />
                  </div>

                  <label className="block">
                    <Label>Paste image or video URL</Label>
                    <Input
                      value={mediaUrl}
                      onChange={(event) => {
                        setMediaUrl(event.target.value);
                        setSource(null);
                        setResult(null);
                        setPreviewMode('source');
                      }}
                      placeholder="https://example.com/asset.mp4"
                      disabled={running || uploading}
                      className="rounded-[10px] border-border bg-surface text-sm text-text-primary placeholder:text-text-muted"
                    />
                  </label>
                </Card>

                <Card className="order-3 rounded-[14px] border border-border bg-surface p-5 shadow-card xl:order-none">
                  <div className="mb-5 flex items-start gap-3">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-text-secondary">2</span>
                    <div>
                      <h2 className="text-base font-semibold text-text-primary">{copy.settingsTitle}</h2>
                      <p className="mt-1 text-xs text-text-muted">Choose how you want to enhance your asset.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block">
                      <Label>{copy.engine}</Label>
                      <SelectMenu
                        value={engine?.id ?? engineId}
                        onChange={(value) => changeEngine(value as UpscaleToolEngineId)}
                        options={engines.map((entry) => ({ value: entry.id, label: entry.label }))}
                        disabled={running}
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <Label>{copy.mode}</Label>
                        <SelectMenu
                          value={mode}
                          onChange={(value) => setMode(value as UpscaleMode)}
                          options={(engine?.supportedModes ?? ['factor']).map((entry) => ({
                            value: entry,
                            label: entry === 'target' ? copy.target : copy.factor,
                          }))}
                          disabled={running}
                        />
                      </label>
                      <label className="block">
                        <Label>{mode === 'target' ? copy.target : copy.factor}</Label>
                        {mode === 'target' ? (
                          <SelectMenu
                            value={targetResolution}
                            onChange={(value) => setTargetResolution(value as UpscaleTargetResolution)}
                            options={(engine?.supportedTargetResolutions ?? ['1080p']).map((entry) => ({ value: entry, label: entry }))}
                            disabled={running}
                          />
                        ) : (
                          <SelectMenu
                            value={upscaleFactor}
                            onChange={(value) => setUpscaleFactor(Number(value))}
                            options={(engine?.supportedUpscaleFactors ?? [2]).map((entry) => ({ value: entry, label: `${entry}x` }))}
                            disabled={running}
                          />
                        )}
                      </label>
                    </div>

                    <label className="block">
                      <Label>{copy.output}</Label>
                      <SelectMenu
                        value={outputFormat}
                        onChange={(value) => setOutputFormat(value as UpscaleOutputFormat)}
                        options={(engine?.supportedOutputFormats ?? ['jpg']).map((entry) => ({ value: entry, label: entry.toUpperCase() }))}
                        disabled={running}
                      />
                    </label>
                  </div>

                  <div className="mt-5 flex items-center gap-3 rounded-[12px] border border-border bg-bg px-4 py-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-primary shadow-card">
                      <Coins className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-text-muted">{copy.priceEyebrow}</p>
                      <p className="mt-1 text-xl font-semibold leading-none text-text-primary">{priceLabel}</p>
                      <p className="mt-1 text-xs text-text-muted">{priceHint}</p>
                    </div>
                  </div>

                  <Button className="mt-5 w-full rounded-[10px] bg-brand py-3 text-on-brand hover:bg-brand-hover" size="lg" onClick={handleRun} disabled={!canRun}>
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                    {running ? copy.running : copy.run}
                  </Button>
                  {message ? <p className="mt-3 text-sm text-text-muted">{message}</p> : null}
                  {error ? <p className="mt-3 text-sm font-medium text-error">{error}</p> : null}
                </Card>
              </section>

              <section className="contents xl:block xl:space-y-4">
                <Card className="order-2 overflow-hidden rounded-[14px] border border-border bg-surface p-0 shadow-card xl:order-none">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-text-primary">Before / after preview</h2>
                      <p className="mt-1 text-xs text-text-muted">Upload a source, choose a recipe, then compare the upscaled result.</p>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <div className="flex rounded-[10px] border border-border bg-bg p-1">
                        {([
                          ['source', copy.previewSource, false],
                          ['result', copy.previewResult, !hasResult],
                          ['compare', copy.previewCompare, !canCompare],
                        ] as const).map(([modeOption, label, disabled]) => {
                          const active = activePreviewMode === modeOption;
                          return (
                            <button
                              key={modeOption}
                              type="button"
                              disabled={disabled}
                              onClick={() => setPreviewMode(modeOption)}
                              className={`min-h-8 rounded-[8px] px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                                active
                                  ? 'bg-brand text-on-brand shadow-card'
                                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {output?.url ? (
                        <>
                          <Button variant="outline" size="sm" onClick={handleSave} className="rounded-[10px] border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary">
                            <Save className="h-4 w-4" />
                            {copy.save}
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleDownload} className="rounded-[10px] border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary">
                            <Download className="h-4 w-4" />
                            {copy.download}
                          </Button>
                        </>
                      ) : null}
                      <div
                        className={`flex items-center gap-2 rounded-[12px] border px-2 py-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition ${
                          isPixelZoom
                            ? 'border-brand bg-brand text-on-brand'
                            : 'border-border bg-surface text-text-primary ring-1 ring-border'
                        }`}
                      >
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${
                            isPixelZoom
                              ? 'bg-surface text-text-primary'
                              : 'bg-brand text-on-brand'
                          }`}
                        >
                          <ZoomIn className="h-4 w-4" />
                        </span>
                        <span className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] sm:inline">
                          {copy.previewZoom}
                        </span>
                        <select
                          aria-label={copy.previewZoom}
                          value={previewZoom}
                          onChange={(event) => setPreviewZoom(event.currentTarget.value as PreviewZoom)}
                          className="h-8 min-w-[82px] rounded-[8px] border border-border bg-surface px-2 text-xs font-semibold text-text-primary outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {PREVIEW_ZOOM_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.value === 'fit' ? copy.previewZoomFit : option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="px-3 pb-3 sm:px-5 sm:pb-5">
                    <div className="relative aspect-[4/3] min-h-[260px] max-h-[min(72vh,680px)] overflow-hidden rounded-[12px] border border-border bg-surface-3 sm:aspect-[16/9] sm:min-h-[340px] xl:aspect-[16/8] xl:min-h-[420px]">
                      <div ref={previewScrollerRef} className={`absolute inset-0 ${isPixelZoom ? 'overflow-auto' : 'overflow-hidden'}`}>
                        <div
                          className={`relative h-full w-full ${
                            compareEnabled ? 'cursor-ew-resize touch-none select-none' : ''
                          } ${
                            compareDragging ? 'ring-2 ring-ring' : ''
                          }`}
                          style={
                            isPixelZoom
                              ? {
                                  width: `${Math.round(zoomCanvasWidth * previewZoomScale)}px`,
                                  height: `${Math.round(zoomCanvasHeight * previewZoomScale)}px`,
                                }
                              : undefined
                          }
                          role={compareEnabled ? 'slider' : 'img'}
                          aria-label={compareEnabled ? 'Compare source and upscaled preview' : activePreviewMode === 'result' ? 'Upscaled result preview' : 'Source preview'}
                          aria-valuemin={compareEnabled ? 8 : undefined}
                          aria-valuemax={compareEnabled ? 92 : undefined}
                          aria-valuenow={compareEnabled ? Math.round(comparePosition) : undefined}
                          tabIndex={0}
                          onPointerDown={compareEnabled ? handleComparePointerDown : undefined}
                          onPointerMove={compareEnabled ? handleComparePointerMove : undefined}
                          onPointerUp={compareEnabled ? handleComparePointerUp : undefined}
                          onPointerCancel={compareEnabled ? handleComparePointerUp : undefined}
                          onKeyDown={(event) => {
                            if (!compareEnabled) return;
                            if (event.key === 'ArrowLeft') {
                              event.preventDefault();
                              setComparePosition((current) => clampComparePosition(current - 4));
                            }
                            if (event.key === 'ArrowRight') {
                              event.preventDefault();
                              setComparePosition((current) => clampComparePosition(current + 4));
                            }
                            if (event.key === 'Home') {
                              event.preventDefault();
                              setComparePosition(8);
                            }
                            if (event.key === 'End') {
                              event.preventDefault();
                              setComparePosition(92);
                            }
                          }}
                        >
                      {activePreviewMode === 'source' ? (
                        sourcePreviewIsVideo ? (
                          <video className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={sourcePreviewUrl} controls muted playsInline />
                        ) : (
                          <img className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={sourcePreviewUrl} alt="" draggable={false} />
                        )
                      ) : activePreviewMode === 'result' ? (
                        resultPreviewIsVideo ? (
                          <video className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={resultPreviewUrl} controls muted playsInline />
                        ) : (
                          <img className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={resultPreviewUrl} alt="" draggable={false} />
                        )
                      ) : resultPreviewIsVideo ? (
                        <>
                          <video className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={resultPreviewUrl} muted playsInline />
                          <video
                            className={`absolute inset-0 h-full w-full ${mediaFitClass}`}
                            src={sourcePreviewUrl}
                            muted
                            playsInline
                            style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                          />
                        </>
                      ) : (
                        <>
                          <img className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={resultPreviewUrl} alt="" draggable={false} />
                          <img
                            className={`absolute inset-0 h-full w-full ${mediaFitClass}`}
                            src={sourcePreviewUrl}
                            alt=""
                            draggable={false}
                            style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                          />
                        </>
                      )}

                      {activePreviewMode === 'compare' ? (
                        <>
                          <div className="absolute inset-y-0 w-px bg-on-inverse shadow-[0_0_0_1px_var(--surface-on-media-dark-40)]" style={{ left: `${comparePosition}%` }} />
                          <div
                            className="absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-surface-on-media-70 bg-on-inverse text-brand shadow-float transition-transform hover:scale-105"
                            style={{ left: `${comparePosition}%` }}
                            aria-hidden="true"
                          >
                            <ChevronsLeftRight className="h-5 w-5" />
                          </div>
                        </>
                      ) : null}

                      <div className="absolute left-3 top-3 rounded-[8px] bg-surface-on-media-dark-80 px-3 py-2 text-on-inverse shadow-lg backdrop-blur sm:left-6 sm:top-6 sm:px-4 sm:py-3">
                        <p className="text-xs font-semibold">
                          {activePreviewMode === 'result' ? copy.previewResult : copy.previewSource}
                        </p>
                        <p className="mt-1 text-xs text-on-media-85">
                          {activePreviewMode === 'result' ? outputSizeLabel : sourceSizeLabel}
                        </p>
                      </div>
                      {activePreviewMode === 'compare' ? (
                        <div className="absolute right-3 top-3 rounded-[8px] bg-surface-on-media-dark-80 px-3 py-2 text-on-inverse shadow-lg backdrop-blur sm:right-6 sm:top-6 sm:px-4 sm:py-3">
                          <p className="text-xs font-semibold">{copy.previewResult}</p>
                          <p className="mt-1 text-xs text-on-media-85">{outputSizeLabel}</p>
                        </div>
                      ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="order-4 rounded-[14px] border border-border bg-surface p-5 shadow-card xl:order-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-text-primary">{copy.recentTitle}</h2>
                      <p className="mt-1 text-xs text-text-muted">Reuse finished assets in Image, Video, or Library.</p>
                    </div>
                    <Link href="/app/library" className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text-primary">
                      View library
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                    {recentGroups.slice(0, 8).map((group) => {
                      const active = activeRecentGroupId === group.id;
                      return (
                        <div
                          key={group.id}
                          className={`w-[258px] shrink-0 rounded-[14px] transition ${
                            active ? 'ring-2 ring-brand ring-offset-2 ring-offset-bg' : ''
                          }`}
                        >
                          <GroupedJobCard
                            group={group}
                            onOpen={selectRecentUpscale}
                            onAction={handleRecentGroupAction}
                            menuVariant="gallery-image"
                            allowRemove={false}
                            savingToLibrary={savingRecentGroupId === group.id}
                          />
                        </div>
                      );
                    })}
                    {!recentGroups.length ? (
                      <div className="w-full rounded-[12px] border border-dashed border-border bg-bg p-4 text-sm text-text-muted">
                        No upscale runs yet.
                      </div>
                    ) : null}
                  </div>
                </Card>
              </section>
            </div>
          </div>
        </main>
      </div>
      {libraryModalOpen ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-overlay-bg px-3 py-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close library"
            onClick={() => setLibraryModalOpen(false)}
          />
          <AssetLibraryBrowser
            className="relative z-10 h-[88svh] max-w-[1180px]"
            title={copy.libraryTitle}
            subtitle={copy.libraryBody}
            countLabel={copy.libraryCount.replace('{count}', String(visibleLibraryAssets.length))}
            onClose={() => setLibraryModalOpen(false)}
            closeLabel="Close"
            assetType={mediaType}
            assets={visibleLibraryAssets}
            isLoading={libraryLoading}
            error={libraryError}
            source={librarySource}
            availableSources={[...librarySourceOptions]}
            sourceLabels={copy.libraryTabs}
            onSourceChange={(nextSource) => {
              if (nextSource === librarySource) return;
              setLibrarySource(nextSource);
              setLibraryAssets([]);
              setLibraryError(null);
              setLibraryLoadedKey(null);
            }}
            searchPlaceholder={copy.librarySearch}
            sourcesTitle={copy.librarySourcesTitle}
            emptyLabel={mediaType === 'video' ? copy.libraryEmptyVideos : copy.libraryEmptyImages}
            emptySearchLabel={copy.libraryEmptySearch}
            headerActions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                onClick={() => fetchLibraryAssets({ kind: mediaType, source: librarySource })}
                disabled={libraryLoading}
              >
                <RefreshCw className={`h-4 w-4 ${libraryLoading ? 'animate-spin' : ''}`} />
                {copy.libraryRefresh}
              </Button>
            }
            renderAssetActions={(asset) => (
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="min-h-[34px] flex-1 rounded-full border-brand px-2.5 py-1 text-[11px] uppercase tracking-micro sm:min-h-[36px] sm:flex-none sm:px-3 sm:text-[12px]"
                onClick={() => selectLibraryAsset(asset)}
              >
                {copy.libraryUse}
              </Button>
            )}
            renderAssetMeta={(asset) =>
              asset.source ? <span className="capitalize">{asset.source}</span> : null
            }
          />
        </div>
      ) : null}
    </div>
  );
}
