'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type PointerEvent } from 'react';
import {
  ArrowRight,
  ChevronsLeftRight,
  Coins,
  Download,
  Image as ImageIcon,
  LibraryBig,
  Loader2,
  Maximize2,
  RefreshCw,
  Save,
  Upload,
  Video,
  WandSparkles,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import {
  AssetLibraryBrowser,
  type AssetBrowserAsset,
  type AssetLibrarySource,
} from '@/components/library/AssetLibraryBrowser';
import { authFetch } from '@/lib/authFetch';
import { runUpscaleTool, saveAssetToLibrary, useInfiniteJobs } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { useI18n } from '@/lib/i18n/I18nProvider';
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

const SAMPLE_IMAGE_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp';

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
  url: string;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
  name?: string | null;
};

type PreviewMode = 'source' | 'result' | 'compare';

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
  return <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-white/55">{children}</span>;
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
          ? 'border-slate-950 bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] dark:border-white dark:bg-white dark:text-slate-950'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-white/14 dark:bg-white/[0.055] dark:text-white/80 dark:hover:border-white/24 dark:hover:bg-white/[0.09] dark:hover:text-white'
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
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<AssetBrowserAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [librarySource, setLibrarySource] = useState<AssetLibrarySource>('all');
  const [libraryLoadedKey, setLibraryLoadedKey] = useState<string | null>(null);
  const { stableJobs: recentJobs, mutate } = useInfiniteJobs(8, { surface: 'upscale' });

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
  const previewUrl = output?.url || mediaUrl || SAMPLE_IMAGE_URL;
  const previewIsVideo = output ? isOutputVideo(output) : mediaType === 'video' && Boolean(mediaUrl);
  const hasResult = Boolean(output?.url);
  const activePreviewMode: PreviewMode = hasResult ? previewMode : 'source';
  const sourcePreviewUrl = mediaUrl || SAMPLE_IMAGE_URL;
  const resultPreviewUrl = output?.url || mediaUrl || SAMPLE_IMAGE_URL;
  const sourcePreviewIsVideo = mediaType === 'video' && Boolean(mediaUrl);
  const resultPreviewIsVideo = output ? isOutputVideo(output) : sourcePreviewIsVideo;
  const compareEnabled = activePreviewMode === 'compare' && hasResult;
  const sourceWidth = source?.width ?? SOURCE_FALLBACK_WIDTH;
  const sourceHeight = source?.height ?? SOURCE_FALLBACK_HEIGHT;
  const previewFactor = mode === 'factor' ? upscaleFactor : 2;
  const outputWidth = output?.width ?? Math.round(sourceWidth * previewFactor);
  const outputHeight = output?.height ?? Math.round(sourceHeight * previewFactor);
  const sourceSizeLabel = `${sourceWidth} x ${sourceHeight}`;
  const outputSizeLabel = `${outputWidth} x ${outputHeight}`;
  const mediaTypeLabel = mediaType === 'video' ? 'Video' : 'Image';
  const libraryCacheKey = libraryModalOpen ? buildLibraryCacheKey(mediaType, librarySource) : null;
  const librarySourceOptions = useMemo(
    () =>
      mediaType === 'video'
        ? (['all', 'upload', 'generated'] as const)
        : (['all', 'upload', 'generated', 'character', 'angle'] as const),
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
          requests.push(authFetch('/api/jobs?limit=80&type=video'));
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
        sourceAssetId: source?.id ?? null,
        imageWidth: source?.width ?? null,
        imageHeight: source?.height ?? null,
      });
      setResult(response);
      setPreviewMode('compare');
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
        kind: mediaType,
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
    <div className="flex min-h-screen flex-col bg-[#f6f8fb] text-slate-950 dark:bg-[#070b12] dark:text-white">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] px-5 py-5 lg:px-8 lg:py-6">
            <section className="relative overflow-hidden rounded-[28px] border border-transparent bg-[radial-gradient(circle_at_22%_8%,rgba(219,234,254,0.88),transparent_32%),linear-gradient(90deg,#f9fbff_0%,#f5f8fc_58%,#f8fafc_100%)] px-6 py-7 dark:border-white/8 dark:bg-[radial-gradient(circle_at_22%_8%,rgba(37,99,235,0.18),transparent_34%),linear-gradient(90deg,#0c1220_0%,#0a101b_58%,#090d15_100%)] lg:px-10 lg:py-9">
              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-900 dark:text-white">{copy.eyebrow}</p>
                  <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white lg:text-[44px] lg:leading-[1.05]">
                    {copy.title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-white/76">{copy.subtitle}</p>
                </div>

                <div className="rounded-[20px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                      <WandSparkles className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-slate-950 dark:text-white">{engine?.label ?? 'Upscale engine'}</p>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Mode</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{mode === 'target' ? targetResolution : `${upscaleFactor}x`}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Type</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{mediaTypeLabel}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Format</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{outputFormat.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Price</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{priceLabel}</p>
                    </div>
                  </div>
                  <Button className="mt-5 w-full rounded-[10px] bg-slate-950 py-3 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90" onClick={handleRun} disabled={!canRun}>
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                    {running ? copy.running : copy.run}
                  </Button>
                </div>
              </div>
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
              <section className="space-y-4 lg:sticky lg:top-5 lg:self-start">
                <Card className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-white/72">1</span>
                      <div>
                        <h2 className="text-base font-semibold text-slate-950 dark:text-white">Source asset</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-white/62">Add the asset you want to upscale.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openLibraryModal}
                      disabled={!user || running || uploading}
                      className="h-9 shrink-0 rounded-[10px] border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/76 dark:hover:bg-white/[0.08]"
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

                  <label className="mt-4 block cursor-pointer rounded-[12px] border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center transition hover:border-slate-500 hover:bg-white dark:border-white/14 dark:bg-white/[0.03] dark:hover:border-white/30 dark:hover:bg-white/[0.06]">
                    <Input
                      type="file"
                      accept={mediaType === 'image' ? 'image/*' : 'video/*'}
                      onChange={handleUpload}
                      disabled={!user || uploading || running}
                      className="sr-only"
                    />
                    <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-950 shadow-sm dark:bg-white/10 dark:text-white">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-slate-950 dark:text-white">Drop file here</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-white/52">{source?.name ?? (mediaType === 'video' ? 'MP4, WebM, MOV' : 'PNG, JPG, WebP up to 200MB')}</span>
                  </label>

                  <div className="my-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                    <span className="text-[11px] text-slate-400 dark:text-white/35">or</span>
                    <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
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
                      className="rounded-[10px] border-slate-200 bg-white text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/28"
                    />
                  </label>
                </Card>

                <Card className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                  <div className="mb-5 flex items-start gap-3">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-white/72">2</span>
                    <div>
                      <h2 className="text-base font-semibold text-slate-950 dark:text-white">{copy.settingsTitle}</h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-white/62">Choose how you want to enhance your asset.</p>
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

                  <div className="mt-5 flex items-center gap-3 rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-slate-950 shadow-sm dark:bg-white/10 dark:text-white">
                      <Coins className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-500 dark:text-white/55">{copy.priceEyebrow}</p>
                      <p className="mt-1 text-xl font-semibold leading-none text-slate-950 dark:text-white">{priceLabel}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-white/52">{priceHint}</p>
                    </div>
                  </div>

                  <Button className="mt-5 w-full rounded-[10px] bg-slate-950 py-3 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90" size="lg" onClick={handleRun} disabled={!canRun}>
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                    {running ? copy.running : copy.run}
                  </Button>
                  {message ? <p className="mt-3 text-sm text-slate-500 dark:text-white/55">{message}</p> : null}
                  {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
                </Card>
              </section>

              <section className="space-y-4">
                <Card className="overflow-hidden rounded-[14px] border border-slate-200 bg-white p-0 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Before / after preview</h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-white/62">Upload a source, choose a recipe, then compare the upscaled result.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex rounded-[10px] border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/[0.04]">
                        {([
                          ['source', copy.previewSource, false],
                          ['result', copy.previewResult, !hasResult],
                          ['compare', copy.previewCompare, !hasResult],
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
                                  ? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
                                  : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-white/64 dark:hover:bg-white/[0.08] dark:hover:text-white'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {output?.url ? (
                        <>
                          <Button variant="outline" size="sm" onClick={handleSave} className="rounded-[10px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/72 dark:hover:bg-white/[0.08]">
                          <Save className="h-4 w-4" />
                          {copy.save}
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleDownload} className="rounded-[10px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/72 dark:hover:bg-white/[0.08]">
                          <Download className="h-4 w-4" />
                          {copy.download}
                          </Button>
                        </>
                      ) : null}
                      <Button variant="outline" size="sm" className="rounded-[10px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/72 dark:hover:bg-white/[0.08]">
                        Fit screen
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="px-5 pb-5">
                    <div
                      className={`relative aspect-[16/8] min-h-[420px] overflow-hidden rounded-[12px] border border-slate-900/10 bg-slate-950 ${
                        compareEnabled ? 'cursor-ew-resize touch-none select-none' : ''
                      } ${
                        compareDragging ? 'ring-2 ring-white/70' : ''
                      }`}
                      role={compareEnabled ? 'slider' : 'img'}
                      aria-label={compareEnabled ? 'Compare source and upscaled preview' : activePreviewMode === 'result' ? 'Upscaled result preview' : 'Source preview'}
                      aria-valuemin={8}
                      aria-valuemax={92}
                      aria-valuenow={Math.round(comparePosition)}
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
                          <video className="absolute inset-0 h-full w-full object-cover" src={sourcePreviewUrl} controls muted playsInline />
                        ) : (
                          <img className="absolute inset-0 h-full w-full object-cover" src={sourcePreviewUrl} alt="" draggable={false} />
                        )
                      ) : activePreviewMode === 'result' ? (
                        resultPreviewIsVideo ? (
                          <video className="absolute inset-0 h-full w-full object-cover" src={resultPreviewUrl} controls muted playsInline />
                        ) : (
                          <img className="absolute inset-0 h-full w-full object-cover" src={resultPreviewUrl} alt="" draggable={false} />
                        )
                      ) : resultPreviewIsVideo ? (
                        <>
                          <video className="absolute inset-0 h-full w-full object-cover" src={resultPreviewUrl} muted playsInline />
                          <video
                            className="absolute inset-0 h-full w-full object-cover brightness-[0.55] saturate-[0.72]"
                            src={sourcePreviewUrl}
                            muted
                            playsInline
                            style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                          />
                        </>
                      ) : (
                        <>
                          <img className="absolute inset-0 h-full w-full object-cover" src={resultPreviewUrl} alt="" draggable={false} />
                          <img
                            className="absolute inset-0 h-full w-full object-cover brightness-[0.55] saturate-[0.72]"
                            src={sourcePreviewUrl}
                            alt=""
                            draggable={false}
                            style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                          />
                        </>
                      )}

                      {activePreviewMode === 'compare' ? (
                        <>
                          <div className="absolute inset-y-0 w-px bg-white/90 shadow-[0_0_0_1px_rgba(15,23,42,0.18)]" style={{ left: `${comparePosition}%` }} />
                          <div
                            className="absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white text-slate-950 shadow-[0_14px_36px_rgba(15,23,42,0.32)] transition-transform hover:scale-105"
                            style={{ left: `${comparePosition}%` }}
                            aria-hidden="true"
                          >
                            <ChevronsLeftRight className="h-5 w-5" />
                          </div>
                        </>
                      ) : null}

                      <div className="absolute left-6 top-6 rounded-[8px] bg-slate-950/82 px-4 py-3 text-white shadow-lg backdrop-blur">
                        <p className="text-xs font-semibold">
                          {activePreviewMode === 'result' ? copy.previewResult : copy.previewSource}
                        </p>
                        <p className="mt-1 text-xs text-white/85">
                          {activePreviewMode === 'result' ? outputSizeLabel : sourceSizeLabel}
                        </p>
                      </div>
                      {activePreviewMode === 'compare' ? (
                        <div className="absolute right-6 top-6 rounded-[8px] bg-slate-950/82 px-4 py-3 text-white shadow-lg backdrop-blur">
                          <p className="text-xs font-semibold">{copy.previewResult}</p>
                          <p className="mt-1 text-xs text-white/85">{outputSizeLabel}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>

                <Card className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-950 dark:text-white">{copy.recentTitle}</h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-white/55">Reuse finished assets in Image, Video, or Library.</p>
                    </div>
                    <Link href="/app/library" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950 dark:text-white/72 dark:hover:text-white">
                      View library
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                    {recentJobs.slice(0, 8).map((job) => {
                      const imageUrl = job.heroRenderId ?? job.renderIds?.[0] ?? job.thumbUrl ?? job.previewFrame ?? null;
                      const videoUrl = job.videoUrl ?? job.readyVideoUrl ?? null;
                      return (
                        <div key={job.jobId} className="w-[118px] shrink-0 overflow-hidden rounded-[10px] bg-slate-50 transition hover:-translate-y-0.5 hover:shadow-card dark:bg-white/[0.045]">
                          <div className="aspect-[1.25] bg-slate-100 dark:bg-white/[0.06]">
                            {videoUrl ? (
                              <video className="h-full w-full object-cover" src={videoUrl} muted />
                            ) : imageUrl ? (
                              <img className="h-full w-full object-cover" src={imageUrl} alt="" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-text-muted">No preview</div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="truncate text-[11px] font-semibold text-slate-950 dark:text-white">{job.engineLabel}</p>
                            <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-white/50">{job.status ?? 'completed'}</p>
                          </div>
                        </div>
                      );
                    })}
                    {!recentJobs.length ? (
                      <div className="w-full rounded-[12px] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-white/12 dark:bg-white/[0.035] dark:text-white/55">
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
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 px-3 py-4 backdrop-blur-sm">
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
