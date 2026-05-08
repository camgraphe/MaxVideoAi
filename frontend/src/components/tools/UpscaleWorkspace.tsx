'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import type { GroupedJobAction } from '@/components/GroupedJobCard';
import { HeaderBar } from '@/components/HeaderBar';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
import { UpscaleRecipePanel, UpscaleSourcePanel } from './upscale/_components/UpscaleInputPanels';
import { UpscaleHeroSummaryCard } from './upscale/_components/UpscaleHeroSummaryCard';
import { UpscaleLibraryModal } from './upscale/_components/UpscaleLibraryModal';
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

  function changeMediaUrl(nextUrl: string) {
    setMediaUrl(nextUrl);
    setSource(null);
    setResult(null);
    setPreviewMode('source');
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
                <UpscaleSourcePanel
                  copy={copy}
                  isAuthenticated={Boolean(user)}
                  mediaType={mediaType}
                  mediaUrl={mediaUrl}
                  onLibraryOpen={openLibraryModal}
                  onMediaTypeChange={changeMediaType}
                  onMediaUrlChange={changeMediaUrl}
                  onUpload={handleUpload}
                  running={running}
                  sourceName={source?.name}
                  uploading={uploading}
                />

                <UpscaleRecipePanel
                  canRun={canRun}
                  copy={copy}
                  engine={engine}
                  engineId={engineId}
                  engines={engines}
                  error={error}
                  message={message}
                  mode={mode}
                  onEngineChange={changeEngine}
                  onModeChange={setMode}
                  onOutputFormatChange={setOutputFormat}
                  onRun={handleRun}
                  onTargetResolutionChange={setTargetResolution}
                  onUpscaleFactorChange={setUpscaleFactor}
                  outputFormat={outputFormat}
                  priceHint={priceHint}
                  priceLabel={priceLabel}
                  running={running}
                  targetResolution={targetResolution}
                  upscaleFactor={upscaleFactor}
                />
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
      <UpscaleLibraryModal
        assets={visibleLibraryAssets}
        copy={copy}
        error={libraryError}
        isLoading={libraryLoading}
        mediaType={mediaType}
        onClose={() => setLibraryModalOpen(false)}
        onRefresh={fetchLibraryAssets}
        onSelectAsset={selectLibraryAsset}
        onSourceChange={resetLibraryState}
        open={libraryModalOpen}
        source={librarySource}
        sourceOptions={librarySourceOptions}
      />
    </div>
  );
}
