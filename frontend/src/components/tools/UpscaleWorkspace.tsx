'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Coins,
  Image as ImageIcon,
  LibraryBig,
  Loader2,
  RefreshCw,
  Upload,
  Video,
  WandSparkles,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import type { GroupedJobAction } from '@/components/GroupedJobCard';
import { HeaderBar } from '@/components/HeaderBar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { AssetLibraryBrowser } from '@/components/library/AssetLibraryBrowser';
import { authFetch } from '@/lib/authFetch';
import { runUpscaleTool, saveAssetToLibrary } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { FEATURES } from '@/content/feature-flags';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import {
  DEFAULT_UPSCALE_IMAGE_ENGINE_ID,
  DEFAULT_UPSCALE_VIDEO_ENGINE_ID,
  listUpscaleToolEngines,
} from '@/config/tools-upscale-engines';
import type {
  UpscaleMediaType,
  UpscaleMode,
  UpscaleOutputFormat,
  UpscaleTargetResolution,
  UpscaleToolEngineId,
  UpscaleToolResponse,
} from '@/types/tools-upscale';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import { Label, SegmentButton } from './upscale/_components/upscale-workspace-controls';
import { UpscaleHeroSummaryCard } from './upscale/_components/UpscaleHeroSummaryCard';
import { UpscalePreviewCard } from './upscale/_components/UpscalePreviewCard';
import { UpscaleRecentRail } from './upscale/_components/UpscaleRecentRail';
import { DEFAULT_UPSCALE_COPY } from './upscale/_lib/upscale-workspace-copy';
import {
  formatCurrency,
  parseRecentImageVariantIndex,
  resolveRecentUpscaleJobFromGroup,
  resolveRecentUpscaleMedia,
  resolveRecentUpscaleMediaFromGroup,
  resolveUpscaleEngineId,
} from './upscale/_lib/upscale-workspace-helpers';
import { useUpscaleLibraryAssets } from './upscale/_hooks/useUpscaleLibraryAssets';
import { useUpscalePricingPreview } from './upscale/_hooks/useUpscalePricingPreview';
import { useUpscalePreviewScroller } from './upscale/_hooks/useUpscalePreviewScroller';
import { useUpscalePreviewState } from './upscale/_hooks/useUpscalePreviewState';
import { useUpscaleRecentJobs } from './upscale/_hooks/useUpscaleRecentJobs';
import { useUpscaleSourceMedia } from './upscale/_hooks/useUpscaleSourceMedia';
import type {
  JobDetailResponse,
  PreviewMode,
  PreviewZoom,
  RecentUpscaleMedia,
  UploadedAsset,
} from './upscale/_lib/upscale-workspace-types';

export default function UpscaleWorkspace() {
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale, t } = useI18n();
  const copy = {
    ...DEFAULT_UPSCALE_COPY,
    ...((t('workspace.upscale') ?? {}) as Partial<typeof DEFAULT_UPSCALE_COPY>),
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
  const [previewMode, setPreviewMode] = useState<PreviewMode>('source');
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>('fit');
  const {
    fetchLibraryAssets,
    libraryError,
    libraryLoading,
    libraryModalOpen,
    librarySource,
    librarySourceOptions,
    openLibraryModal,
    resetLibraryState,
    setLibraryModalOpen,
    visibleLibraryAssets,
  } = useUpscaleLibraryAssets({
    libraryErrorCopy: copy.libraryError,
    mediaType,
    user,
  });
  const [activeRecentGroupId, setActiveRecentGroupId] = useState<string | null>(null);
  const [savingRecentGroupId, setSavingRecentGroupId] = useState<string | null>(null);

  const engines = useMemo(() => listUpscaleToolEngines(mediaType), [mediaType]);
  const engine = useMemo(() => engines.find((entry) => entry.id === engineId) ?? engines[0], [engineId, engines]);
  const {
    priceHint,
    priceLabel,
  } = useUpscalePricingPreview({
    copy,
    engine,
    locale,
    mediaType,
    mediaUrl,
    mode,
    source,
    targetResolution,
    upscaleFactor,
  });
  const canRun = Boolean(user && mediaUrl.trim() && engine && !running && !uploading);
  const {
    activePreviewMode,
    canCompare,
    compareDragging,
    compareEnabled,
    comparePosition,
    handleCompareKeyDown,
    handleComparePointerDown,
    handleComparePointerMove,
    handleComparePointerUp,
    hasResult,
    hasSourcePreview,
    isPixelZoom,
    mediaFitClass,
    mediaTypeLabel,
    output,
    outputSizeLabel,
    previewZoomScale,
    resultPreviewIsVideo,
    resultPreviewUrl,
    sourcePreviewIsVideo,
    sourcePreviewUrl,
    sourceSizeLabel,
    zoomCanvasHeight,
    zoomCanvasWidth,
  } = useUpscalePreviewState({
    mediaType,
    mediaUrl,
    mode,
    previewMode,
    previewZoom,
    result,
    source,
    upscaleFactor,
  });
  const previewScrollerRef = useUpscalePreviewScroller({
    activePreviewMode,
    isPixelZoom,
    previewZoom,
    resultPreviewUrl,
    sourcePreviewUrl,
  });
  const { mutate, recentGroups } = useUpscaleRecentJobs({
    hasResult,
    mediaType,
    mediaUrl,
    setMediaUrl,
    setMessage,
    setPreviewMode,
    setPreviewZoom,
    setSource,
    source,
    user,
  });
  const { handleUpload, selectLibraryAsset } = useUpscaleSourceMedia({
    changeMediaType,
    copy,
    mediaType,
    mediaUrl,
    setError,
    setLibraryModalOpen,
    setMediaUrl,
    setMessage,
    setPreviewMode,
    setResult,
    setSource,
    setUploading,
    source,
  });

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
    resetLibraryState(next === 'video' ? 'generated' : 'all');
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

                <UpscaleHeroSummaryCard
                  canRun={canRun}
                  engineLabel={engine?.label ?? 'Upscale engine'}
                  mediaTypeLabel={mediaTypeLabel}
                  modeLabel={mode === 'target' ? targetResolution : `${upscaleFactor}x`}
                  onRun={handleRun}
                  outputFormatLabel={outputFormat.toUpperCase()}
                  priceLabel={priceLabel}
                  runLabel={copy.run}
                  running={running}
                  runningLabel={copy.running}
                />
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
                <UpscalePreviewCard
                  activePreviewMode={activePreviewMode}
                  canCompare={canCompare}
                  compareDragging={compareDragging}
                  compareEnabled={compareEnabled}
                  comparePosition={comparePosition}
                  copy={copy}
                  hasResult={hasResult}
                  isPixelZoom={isPixelZoom}
                  mediaFitClass={mediaFitClass}
                  onCompareKeyDown={handleCompareKeyDown}
                  onComparePointerDown={handleComparePointerDown}
                  onComparePointerMove={handleComparePointerMove}
                  onComparePointerUp={handleComparePointerUp}
                  onDownload={handleDownload}
                  onPreviewModeChange={setPreviewMode}
                  onPreviewZoomChange={setPreviewZoom}
                  onSave={handleSave}
                  outputSizeLabel={outputSizeLabel}
                  previewScrollerRef={previewScrollerRef}
                  previewZoom={previewZoom}
                  previewZoomScale={previewZoomScale}
                  resultPreviewIsVideo={resultPreviewIsVideo}
                  resultPreviewUrl={resultPreviewUrl}
                  sourcePreviewIsVideo={sourcePreviewIsVideo}
                  sourcePreviewUrl={sourcePreviewUrl}
                  sourceSizeLabel={sourceSizeLabel}
                  zoomCanvasHeight={zoomCanvasHeight}
                  zoomCanvasWidth={zoomCanvasWidth}
                />

                <UpscaleRecentRail
                  activeGroupId={activeRecentGroupId}
                  copy={copy}
                  groups={recentGroups}
                  onAction={handleRecentGroupAction}
                  onOpen={selectRecentUpscale}
                  savingGroupId={savingRecentGroupId}
                />
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
              resetLibraryState(nextSource);
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
