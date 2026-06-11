'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, FileVideo, MonitorUp, WalletCards } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS } from '@/config/tools-background-removal-engines';
import { FEATURES } from '@/content/feature-flags';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { saveAssetToLibrary } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  formatBackgroundRemovalOutputCodecLabel,
  getBackgroundRemovalOutputExtension,
} from '@/lib/tools-background-removal';
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
  readBackgroundRemovalControlsFromJob,
} from './background-removal/_lib/background-removal-workspace-helpers';

export default function BackgroundRemovalWorkspace() {
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
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
    },
  });
  const pricing = useBackgroundRemovalPricingPreview({
    copy,
    locale,
    metadata: sourceMedia.metadata,
    outputCodec,
  });
  const { mutate, recentResults } = useBackgroundRemovalRecentJobs(user);
  const runner = useBackgroundRemovalGenerationRunner({
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
    if (runnerResult || runnerRunning) return;
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
  }, [recentResults, runnerResult, runnerRunning, setRunnerResult]);
  const canRun = Boolean(
    user &&
      sourceMedia.videoUrl.trim() &&
      sourceMedia.metadata &&
      !sourceMedia.sourceError &&
      pricing.pricePreview.ready &&
      !runner.running &&
      !sourceMedia.uploading
  );
  const sourceSummary =
    sourceMedia.metadataLoading
      ? copy.metadataLoading
      : sourceMedia.sourceError
        ? sourceMedia.sourceError
        : sourceMedia.metadata?.durationSec
          ? `${copy.metadataReady} · ${Math.round(sourceMedia.metadata.durationSec)}s`
          : copy.metadataRequired;
  const outputSummary = `${formatBackgroundRemovalOutputCodecLabel(outputCodec)} · ${
    preserveAudio ? copy.audioOn : copy.audioMuted
  }`;

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
    const resultUrl = runner.result?.output?.url;
    const activeUrl = viewMode === 'result' && resultUrl ? resultUrl : sourceMedia.videoUrl;
    if (!activeUrl) return;
    const fileName =
      viewMode === 'result' && resultUrl
        ? `background-removal-${Date.now()}.${getBackgroundRemovalOutputExtension(outputCodec)}`
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

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#f7f8f4] text-text-primary dark:bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full max-w-[1580px] px-4 py-5 max-md:mx-4 max-md:w-auto max-md:max-w-[calc(100vw-2rem)] max-md:px-0 sm:px-5 lg:px-8 lg:py-6">
            <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:items-end">
              <div className="min-w-0">
                <ButtonLink
                  className="gap-2 text-text-secondary hover:text-text-primary"
                  href="/app/tools"
                  linkComponent={Link}
                  size="sm"
                  variant="ghost"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {copy.back}
                </ButtonLink>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand">{copy.eyebrow}</p>
                <h1 className="mt-2 whitespace-normal break-words text-3xl font-semibold leading-tight tracking-normal text-text-primary lg:text-4xl">
                  {copy.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{copy.subtitle}</p>
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-3">
                <HeaderSummaryCard icon={<FileVideo className="h-4 w-4" />} label={copy.sourceTitle} value={sourceSummary} />
                <HeaderSummaryCard icon={<MonitorUp className="h-4 w-4" />} label={copy.outputCodec} value={outputSummary} />
                <HeaderSummaryCard icon={<WalletCards className="h-4 w-4" />} label={copy.priceBeforeGeneration} value={pricing.priceLabel} />
              </div>
            </div>

            {!user ? (
              <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{copy.authTitle}</h2>
                  <p className="mt-1 text-sm text-text-secondary">{copy.authBody}</p>
                </div>
                <ButtonLink href={`/login?next=${encodeURIComponent('/app/tools/background-removal')}`} linkComponent={Link} size="sm">
                  Sign in
                </ButtonLink>
              </Card>
            ) : null}

            <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.25fr)] 2xl:grid-cols-[minmax(340px,0.82fr)_minmax(560px,1.25fr)_minmax(280px,0.6fr)]">
              <aside className="min-w-0 space-y-4 xl:sticky xl:top-5 xl:self-start">
                <BackgroundRemovalSourcePanel
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
                />
              </aside>

              <section className="min-w-0 space-y-4">
                <BackgroundRemovalSettingsPanel
                  backgroundColor={backgroundColor}
                  canRun={canRun}
                  copy={copy}
                  error={runner.error}
                  message={runner.message}
                  onBackgroundColorChange={setBackgroundColor}
                  onDownload={handleDownload}
                  onOutputCodecChange={setOutputCodec}
                  onPreserveAudioChange={setPreserveAudio}
                  onRun={runner.run}
                  onSave={handleSaveOutput}
                  onViewModeChange={setViewMode}
                  outputCodec={outputCodec}
                  preserveAudio={preserveAudio}
                  priceHint={pricing.priceHint}
                  priceLabel={pricing.priceLabel}
                  result={runner.result}
                  running={runner.running}
                  sourceUrl={sourceMedia.videoUrl}
                  viewMode={viewMode}
                />
              </section>

              <aside className="min-w-0 xl:col-span-2 2xl:col-span-1 2xl:sticky 2xl:top-5 2xl:self-start">
                <BackgroundRemovalRecentRail
                  copy={copy}
                  items={recentResults}
                  locale={locale}
                  onCopy={recentActions.copyUrl}
                  onDownload={recentActions.downloadUrl}
                  onSave={recentActions.saveRecent}
                  onSelect={recentActions.selectRecent}
                  savingJobId={recentActions.savingJobId}
                />
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function HeaderSummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[12px] border border-border bg-surface/85 p-3 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-micro text-text-muted">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-slate-950 text-lime-300 dark:bg-white/[0.08]">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-text-primary" title={value}>
        {value}
      </p>
    </div>
  );
}
