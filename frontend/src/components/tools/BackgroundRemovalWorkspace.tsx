'use client';

import { ToolMediaHandoff } from '@/components/library/ToolMediaHandoff.client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { Card } from '@/components/ui/Card';
import { BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS } from '@/config/tools-background-removal-engines';
import { FEATURES } from '@/content/feature-flags';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { saveAssetToLibrary } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ToolWorkbench, ToolProcessing, ToolAuthNotice } from './ToolWorkbench';
import { ToolboxVideoPreview } from './ToolboxVideoPreview';
import { MediaDestinationActions } from '@/components/library/MediaDestinationActions.client';
import type {
  BackgroundRemovalOutputCodec,
  BackgroundRemovalStudioBackgroundColor,
} from '@/types/tools-background-removal';
import { BackgroundRemovalRecentRail } from './background-removal/_components/BackgroundRemovalRecentRail';
import { BackgroundRemovalSettingsPanel } from './background-removal/_components/BackgroundRemovalSettingsPanel';
import { BackgroundRemovalSourcePanel } from './background-removal/_components/BackgroundRemovalSourcePanel';
import { useBackgroundRemovalGenerationRunner } from './background-removal/_hooks/useBackgroundRemovalGenerationRunner';
import { useBackgroundRemovalPricingPreview } from './background-removal/_hooks/useBackgroundRemovalPricingPreview';
import { useBackgroundRemovalRecentActions } from './background-removal/_hooks/useBackgroundRemovalRecentActions';
import { useBackgroundRemovalRecentJobs } from './background-removal/_hooks/useBackgroundRemovalRecentJobs';
import { useBackgroundRemovalSourceMedia } from './background-removal/_hooks/useBackgroundRemovalSourceMedia';
import { DEFAULT_BACKGROUND_REMOVAL_COPY } from './background-removal/_lib/background-removal-workspace-copy';
import {
  backgroundRemovalRecentToResult,
  getBackgroundRemovalOutputDownloadExtension,
  readBackgroundRemovalControlsFromJob,
} from './background-removal/_lib/background-removal-workspace-helpers';

export default function BackgroundRemovalWorkspace() {
  const auth = useRequireAuth({ redirectIfLoggedOut: false });
  return <BackgroundRemovalSession key={auth.user?.id ?? 'guest'} auth={auth} />;
}
export function BackgroundRemovalSession({ auth }: { auth: ReturnType<typeof useRequireAuth> }) {
  const { loading: authLoading, user } = auth;
  const { locale, t } = useI18n();
  const copy = {
    ...DEFAULT_BACKGROUND_REMOVAL_COPY,
    ...((t('workspace.backgroundRemoval') ?? {}) as Partial<typeof DEFAULT_BACKGROUND_REMOVAL_COPY>),
  };
  const [backgroundColor, setBackgroundColor] = useState<BackgroundRemovalStudioBackgroundColor>('Transparent');
  const [outputCodec, setOutputCodec] = useState<BackgroundRemovalOutputCodec>('webm_vp9');
  const [preserveAudio, setPreserveAudio] = useState(true);
  const [viewMode, setViewMode] = useState<'source' | 'result'>('source');
  const autoSelectedResultJobIdRef = useRef<string | null>(null);

  const sourceMedia = useBackgroundRemovalSourceMedia({
    maxDurationSeconds: BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS,
    onSourceChanged: () => {
      setViewMode('source');
      // Original/result pairs must belong to the same source.
      runner.clearResult();
    },
  });
  const pricing = useBackgroundRemovalPricingPreview({
    userId: user?.id,
    videoUrl: sourceMedia.videoUrl,
    backgroundColor,
    preserveAudio,
    copy,
    locale,
    metadata: sourceMedia.metadata,
    outputCodec,
  });
  const { mutate, recentResults } = useBackgroundRemovalRecentJobs(user);
  const runner = useBackgroundRemovalGenerationRunner({
    acceptedQuote: pricing.acceptedQuote,
    onQuoteInvalidated: pricing.refreshQuote,
    backgroundColor,
    outputCodec,
    preserveAudio,
    source: sourceMedia.source,
    metadata: sourceMedia.metadata,
    videoUrl: sourceMedia.videoUrl,
    onSuccess: () => {
      setViewMode('result');
      void mutate();
    },
  });
  const runnerResult = runner.result;
  const runnerRunning = runner.running;
  const setRunnerResult = runner.setResult;
  const recentActions = useBackgroundRemovalRecentActions({
    onSelectResult: (nextResult) => {
      runner.setResult(nextResult);
      setViewMode('result');
    },
    setError: runner.setError,
    setMessage: runner.setMessage,
  });

  const librarySourceOptions = useMemo(
    () =>
      sourceMedia.librarySourceOptions.map((option) => ({
        ...option,
        label:
          option.value === 'all'
            ? copy.libraryAll
            : option.value === 'upload'
              ? copy.libraryUploaded
              : option.value === 'generated'
                ? copy.libraryGenerated
                : copy.libraryBackgroundRemoval,
      })),
    [copy.libraryAll, copy.libraryBackgroundRemoval, copy.libraryGenerated, copy.libraryUploaded, sourceMedia.librarySourceOptions]
  );

  useEffect(() => {
    if (runnerResult || runnerRunning || sourceMedia.videoUrl) return;
    const latestCompleted = recentResults.find((item) => {
      const status = typeof item.job.status === 'string' ? item.job.status.toLowerCase() : '';
      return status === 'completed';
    });
    if (!latestCompleted || autoSelectedResultJobIdRef.current === latestCompleted.job.jobId) return;

    const controls = readBackgroundRemovalControlsFromJob(latestCompleted.job);
    if (controls.outputCodec) setOutputCodec(controls.outputCodec);
    if (controls.backgroundColor) setBackgroundColor(controls.backgroundColor);
    if (typeof controls.preserveAudio === 'boolean') setPreserveAudio(controls.preserveAudio);

    setRunnerResult(backgroundRemovalRecentToResult(latestCompleted));
    setViewMode('result');
    autoSelectedResultJobIdRef.current = latestCompleted.job.jobId;
  }, [recentResults, runnerResult, runnerRunning, setRunnerResult, sourceMedia.videoUrl]);
  const canRun = Boolean(
    user &&
      sourceMedia.videoUrl.trim() &&
      sourceMedia.metadata &&
      !sourceMedia.sourceError &&
      pricing.pricePreview.ready &&
      !runner.running &&
      !sourceMedia.uploading
  );
  async function handleSaveOutput() {
    const output = runner.result?.output;
    if (!output?.url) return;
    runner.setError(null);
    try {
      await saveAssetToLibrary({
        url: output.url,
        jobId: runner.result?.jobId ?? null,
        label: runner.result?.engineLabel ?? copy.title,
        source: 'background-removal',
        kind: 'video',
        sourceOutputId: runner.result?.jobId ? `${runner.result.jobId}:video:0` : null,
        thumbUrl: output.thumbUrl ?? null,
      });
      runner.setMessage(copy.saved);
    } catch (saveError) {
      runner.setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    }
  }

  function handleDownload() {
    const output = runner.result?.output;
    const resultUrl = output?.url;
    const activeUrl = viewMode === 'result' && resultUrl ? resultUrl : sourceMedia.videoUrl;
    if (!activeUrl) return;
    const fileName =
      viewMode === 'result' && resultUrl
        ? `background-removal-${Date.now()}.${getBackgroundRemovalOutputDownloadExtension(output)}`
        : suggestDownloadFilename(activeUrl, 'background-removal-source');
    triggerAppDownload(activeUrl, fileName);
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

  const output = runner.result?.output;
  return <ToolWorkbench locale={locale} visual="background-removal"
    source={<BackgroundRemovalSourcePanel
                  running={runner.running}
                  copy={copy}
                  isAuthenticated={Boolean(user)}
                  libraryAssets={sourceMedia.libraryAssets}
                  libraryError={sourceMedia.libraryError}
                  libraryLoading={sourceMedia.libraryLoading}
                  libraryOpen={sourceMedia.libraryOpen}
                  librarySource={sourceMedia.librarySource}
                  librarySourceOptions={librarySourceOptions}
                  metadata={sourceMedia.metadata}
                  metadataLoading={sourceMedia.metadataLoading}
                  onFileUpload={sourceMedia.handleUpload}
                  onLibraryOpenChange={sourceMedia.setLibraryOpen}
                  onLibraryRefresh={sourceMedia.refreshLibrary}
                  onLibrarySelect={sourceMedia.selectLibraryAsset}
                  onLibrarySourceChange={(value) => sourceMedia.setLibrarySource(value as never)}
                  onUrlChange={sourceMedia.changeVideoUrl}
                  source={sourceMedia.source}
                  sourceError={sourceMedia.sourceError}
                  uploading={sourceMedia.uploading}
                  videoUrl={sourceMedia.videoUrl}
                />} settings={<BackgroundRemovalSettingsPanel
                  backgroundColor={backgroundColor}
                  canRun={canRun}
                  copy={copy}
                  error={runner.error}
                  message={runner.message}
                  onBackgroundColorChange={setBackgroundColor}
                  onOutputCodecChange={setOutputCodec}
                  onPreserveAudioChange={setPreserveAudio}
                  onRun={() => { if (canRun) void runner.run(); }}
                  outputCodec={outputCodec}
                  preserveAudio={preserveAudio}
                  priceLoading={pricing.priceLoading}
                  quoteError={pricing.quoteError}
                  onRefreshQuote={pricing.refreshQuote}
                  priceHint={pricing.priceHint}
                  priceLabel={pricing.priceLabel}
                  running={runner.running}
                />} recent={recentResults.length ? <BackgroundRemovalRecentRail
                  copy={copy}
                  items={recentResults}
                  locale={locale}
                  onCopy={recentActions.copyUrl}
                  onDownload={recentActions.downloadUrl}
                  onSave={recentActions.saveRecent}
                  onSelect={item => { if (!runner.running && !sourceMedia.uploading) recentActions.selectRecent(item); }}
                  savingJobId={recentActions.savingJobId}
                /> : null}
    preview={<>
      {runner.running ? <ToolProcessing locale={locale} /> : null}
      <ToolboxVideoPreview locale={locale} sourceUrl={sourceMedia.videoUrl} result={runner.result} viewMode={viewMode} onViewModeChange={setViewMode} onSave={handleSaveOutput} onDownload={handleDownload} />
      {output?.url && output.assetId ? <MediaDestinationActions locale={locale} userId={user?.id} asset={{ id: output.assetId, url: output.url, kind: 'video', jobId: runner.result?.jobId, thumbUrl: output.thumbUrl }} /> : null}
    </>}
  >
    {!user ? <ToolAuthNotice locale={locale} path="/app/tools/background-removal" /> : null}
    <ToolMediaHandoff userId={user?.id} destination="background-removal" locale={locale} onSelect={asset => sourceMedia.selectLibraryAsset({ ...asset, id: asset.savedAssetId ?? (asset.sourceOutputId || asset.source === 'recent' ? null : asset.id) })} disabled={runner.running || sourceMedia.uploading} />
  </ToolWorkbench>;
}
