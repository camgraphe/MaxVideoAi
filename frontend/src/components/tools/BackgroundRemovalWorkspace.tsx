'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, Eraser } from 'lucide-react';
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
import { getBackgroundRemovalOutputExtension } from '@/lib/tools-background-removal';
import type {
  BackgroundRemovalOutputCodec,
  BackgroundRemovalStudioBackgroundColor,
} from '@/types/tools-background-removal';
import { BackgroundRemovalPreviewCard } from './background-removal/_components/BackgroundRemovalPreviewCard';
import { BackgroundRemovalRecentRail } from './background-removal/_components/BackgroundRemovalRecentRail';
import { BackgroundRemovalSettingsPanel } from './background-removal/_components/BackgroundRemovalSettingsPanel';
import { BackgroundRemovalSourcePanel } from './background-removal/_components/BackgroundRemovalSourcePanel';
import { useBackgroundRemovalGenerationRunner } from './background-removal/_hooks/useBackgroundRemovalGenerationRunner';
import { useBackgroundRemovalPricingPreview } from './background-removal/_hooks/useBackgroundRemovalPricingPreview';
import { useBackgroundRemovalRecentActions } from './background-removal/_hooks/useBackgroundRemovalRecentActions';
import { useBackgroundRemovalRecentJobs } from './background-removal/_hooks/useBackgroundRemovalRecentJobs';
import { useBackgroundRemovalSourceMedia } from './background-removal/_hooks/useBackgroundRemovalSourceMedia';
import { DEFAULT_BACKGROUND_REMOVAL_COPY } from './background-removal/_lib/background-removal-workspace-copy';

export default function BackgroundRemovalWorkspace() {
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale, t } = useI18n();
  const copy = {
    ...DEFAULT_BACKGROUND_REMOVAL_COPY,
    ...((t('workspace.backgroundRemoval') ?? {}) as Partial<typeof DEFAULT_BACKGROUND_REMOVAL_COPY>),
  };
  const [backgroundColor, setBackgroundColor] = useState<BackgroundRemovalStudioBackgroundColor>('Transparent');
  const [outputCodec, setOutputCodec] = useState<BackgroundRemovalOutputCodec>('mov_proresks');
  const [preserveAudio, setPreserveAudio] = useState(true);
  const [viewMode, setViewMode] = useState<'source' | 'result'>('source');

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
    <div className="flex min-h-screen flex-col bg-bg text-text-primary">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] px-5 py-5 lg:px-8 lg:py-6">
            <div className="mb-4">
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
            </div>

            <section className="relative overflow-hidden rounded-[28px] border border-border bg-[radial-gradient(circle_at_22%_8%,var(--brand-soft),transparent_32%),linear-gradient(90deg,var(--surface)_0%,var(--surface-2)_58%,var(--bg)_100%)] px-6 py-7 lg:px-10 lg:py-9">
              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-text-primary">{copy.eyebrow}</p>
                  <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-text-primary lg:text-[44px] lg:leading-[1.05]">
                    {copy.title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-text-secondary">{copy.subtitle}</p>
                </div>
                <Card className="border-border/80 bg-bg/72 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-input bg-brand text-white">
                      <Eraser className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.settingsTitle}</p>
                      <p className="text-lg font-semibold text-text-primary">{pricing.priceLabel}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-text-secondary">{pricing.priceHint}</p>
                </Card>
              </div>
            </section>

            {!user ? (
              <Card className="mt-5 flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{copy.authTitle}</h2>
                  <p className="mt-1 text-sm text-text-secondary">{copy.authBody}</p>
                </div>
                <ButtonLink href={`/login?next=${encodeURIComponent('/app/tools/background-removal')}`} linkComponent={Link} size="sm">
                  Sign in
                </ButtonLink>
              </Card>
            ) : null}

            <div className="mt-5 grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
              <section className="contents xl:sticky xl:top-5 xl:block xl:space-y-4 xl:self-start">
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
                <BackgroundRemovalSettingsPanel
                  backgroundColor={backgroundColor}
                  canRun={canRun}
                  copy={copy}
                  error={runner.error}
                  message={runner.message}
                  onBackgroundColorChange={setBackgroundColor}
                  onOutputCodecChange={setOutputCodec}
                  onPreserveAudioChange={setPreserveAudio}
                  onRun={runner.run}
                  outputCodec={outputCodec}
                  preserveAudio={preserveAudio}
                  priceHint={pricing.priceHint}
                  priceLabel={pricing.priceLabel}
                  running={runner.running}
                />
              </section>

              <section className="contents xl:block xl:space-y-4">
                <BackgroundRemovalPreviewCard
                  backgroundColor={backgroundColor}
                  copy={copy}
                  onDownload={handleDownload}
                  onSave={handleSaveOutput}
                  onViewModeChange={setViewMode}
                  outputCodec={outputCodec}
                  preserveAudio={preserveAudio}
                  result={runner.result}
                  sourceUrl={sourceMedia.videoUrl}
                  viewMode={viewMode}
                />
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
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
