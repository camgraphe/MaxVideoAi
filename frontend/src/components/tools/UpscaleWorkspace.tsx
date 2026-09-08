'use client';

/* eslint-disable @next/next/no-img-element */

import { useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { Card } from '@/components/ui/Card';
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
import { UpscaleRecipePanel, UpscaleSourcePanel } from './upscale/_components/UpscaleInputPanels';
import { ToolWorkbench, ToolEmptyPreview, ToolProcessing, ToolAuthNotice } from './ToolWorkbench';
import { MediaDestinationActions } from '@/components/library/MediaDestinationActions.client';
import { UpscaleLibraryModal } from './upscale/_components/UpscaleLibraryModal';
import { UpscalePreviewCard } from './upscale/_components/UpscalePreviewCard';
import { UpscaleRecentRail } from './upscale/_components/UpscaleRecentRail';
import { DEFAULT_UPSCALE_COPY } from './upscale/_lib/upscale-workspace-copy';
import { upscaleWorkspaceLabels } from './upscale/_lib/upscale-workspace-labels';
import { useUpscaleRecentActions } from './upscale/_hooks/useUpscaleRecentActions';
import { useUpscaleLibraryAssets } from './upscale/_hooks/useUpscaleLibraryAssets';
import { useUpscalePricingPreview } from './upscale/_hooks/useUpscalePricingPreview';
import { useUpscalePreviewScroller } from './upscale/_hooks/useUpscalePreviewScroller';
import { useUpscalePreviewState } from './upscale/_hooks/useUpscalePreviewState';
import { useUpscaleRecentJobs } from './upscale/_hooks/useUpscaleRecentJobs';
import { useUpscaleSourceMedia } from './upscale/_hooks/useUpscaleSourceMedia';
import type {
  PreviewMode,
  PreviewZoom,
  UploadedAsset,
} from './upscale/_lib/upscale-workspace-types';

export default function UpscaleWorkspace() {
  const auth = useRequireAuth({ redirectIfLoggedOut: false });
  const params = useSearchParams();
  const initialKind = params?.get('kind') === 'video' ? 'video' : 'image';
  return <UpscaleSession key={`${auth.user?.id ?? 'guest'}:${initialKind}`} auth={auth} initialKind={initialKind} />;
}
export function UpscaleSession({ auth, initialKind }: { auth: ReturnType<typeof useRequireAuth>; initialKind: UpscaleMediaType }) {
  const { loading: authLoading, user } = auth;
  const { locale, t } = useI18n();
  const copy = {
    ...DEFAULT_UPSCALE_COPY,
    ...((t('workspace.upscale') ?? {}) as Partial<typeof DEFAULT_UPSCALE_COPY>),
    ...upscaleWorkspaceLabels(locale),
  };
  const [mediaType, setMediaType] = useState<UpscaleMediaType>(initialKind);
  const [engineId, setEngineId] = useState<UpscaleToolEngineId>(initialKind === 'video' ? DEFAULT_UPSCALE_VIDEO_ENGINE_ID : DEFAULT_UPSCALE_IMAGE_ENGINE_ID);
  const [source, setSource] = useState<UploadedAsset | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mode, setMode] = useState<UpscaleMode>(initialKind === 'video' ? 'target' : 'factor');
  const [upscaleFactor, setUpscaleFactor] = useState(2);
  const [targetResolution, setTargetResolution] = useState<UpscaleTargetResolution>('1080p');
  const [outputFormat, setOutputFormat] = useState<UpscaleOutputFormat>(initialKind === 'video' ? 'mp4' : 'jpg');
  const [uploading, setUploading] = useState(false);
  const runningRef = useRef(false);
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

  const engines = useMemo(() => listUpscaleToolEngines(mediaType), [mediaType]);
  const engine = useMemo(() => engines.find((entry) => entry.id === engineId) ?? engines[0], [engineId, engines]);
  const {
    priceHint,
    priceLabel,
    pricePreview,
    acceptedQuote,
    quoteError,
    priceLoading,
    refreshQuote,
  } = useUpscalePricingPreview({
    userId: user?.id,
    outputFormat,
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
  const canRun = Boolean(user && mediaUrl.trim() && engine && pricePreview.ready && !running && !uploading);
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
  const {
    handleRecentGroupAction,
    savingRecentGroupId,
    selectRecentUpscale,
  } = useUpscaleRecentActions({
    copy,
    hasSourcePreview,
    locale,
    mediaType,
    setActiveRecentGroupId,
    setEngineId,
    setError,
    setMediaType,
    setMediaUrl,
    setMessage,
    setMode,
    setOutputFormat,
    setPreviewMode,
    setResult,
    setSource,
    setTargetResolution,
    setUpscaleFactor,
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
    if (!canRun || !engine || runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const response = await runUpscaleTool({
        acceptedQuote: acceptedQuote ?? undefined,
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
      setPreviewMode(mediaType === 'video' ? 'result' : 'compare');
      setActiveRecentGroupId(response.jobId ?? null);
      setMessage(null);
      void mutate();
    } catch (runError) {
      refreshQuote();
      setError(runError instanceof Error ? runError.message : 'Upscale failed.');
    } finally {
      runningRef.current = false;
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

  return <>
    <ToolWorkbench locale={locale} visual={mediaType === 'image' ? 'upscale-image' : 'upscale-video'}
      source={<UpscaleSourcePanel
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
                />}
      settings={<UpscaleRecipePanel
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
                  priceLoading={priceLoading}
                  quoteError={quoteError}
                  onRefreshQuote={refreshQuote}
                  priceHint={priceHint}
                  priceLabel={priceLabel}
                  running={running}
                  targetResolution={targetResolution}
                  upscaleFactor={upscaleFactor}
                />}
      preview={<>
        {running ? <ToolProcessing locale={locale} /> : null}
        {hasSourcePreview || hasResult ? <UpscalePreviewCard
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
                /> : <ToolEmptyPreview locale={locale} visual={mediaType === 'image' ? 'upscale-image' : 'upscale-video'} />}
        {output?.url && output.assetId ? <MediaDestinationActions locale={locale} userId={user?.id} asset={{ id: output.assetId, url: output.url, kind: result?.mediaType ?? mediaType, jobId: result?.jobId, thumbUrl: output.thumbUrl, width: output.width, height: output.height }} /> : null}
      </>}
      recent={recentGroups.length ? <UpscaleRecentRail
                  activeGroupId={activeRecentGroupId}
                  copy={copy}
                  groups={recentGroups}
                  onAction={(group, action) => { if (!running && !uploading) void handleRecentGroupAction(group, action); }}
                  onOpen={group => { if (!running && !uploading) selectRecentUpscale(group); }}
                  savingGroupId={savingRecentGroupId}
                /> : null}
    >{!user ? <ToolAuthNotice locale={locale} path={`/app/tools/upscale?kind=${mediaType}`} /> : null}</ToolWorkbench>
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
  </>;
}
