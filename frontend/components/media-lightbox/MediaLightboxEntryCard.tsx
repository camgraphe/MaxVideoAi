'use client';

import clsx from 'clsx';
import Image from 'next/image';
import {
  AudioWaveform,
  CalendarDays,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  Link as LinkIcon,
  Monitor,
  RefreshCw,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { CopyPromptButton } from '@/components/CopyPromptButton';
import { Button, ButtonLink } from '@/components/ui/Button';
import { resolveStableMediaUrl } from '@/lib/media';
import {
  formatPromptPreview,
  isUuidLike,
  isVerticalAspect,
  resolveStatusLabel,
  statusBadgeClass,
} from './media-lightbox-helpers';
import type {
  MediaLightboxEntry,
  MediaLightboxLibraryState,
  MediaLightboxLoadingState,
} from './media-lightbox-types';

function MetaItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-r border-hairline pr-3 last:border-r-0">
      <Icon className="h-5 w-5 shrink-0 text-text-muted" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'app-result-action group flex !min-h-14 items-center gap-3 rounded-[16px] border border-hairline bg-surface-2/70 p-3 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled ? 'cursor-not-allowed opacity-55' : 'hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)]'
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-brand">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text-primary">{title}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-brand transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}

type MediaLightboxEntryCardProps = {
  copiedId: string | null;
  detailSpecsBase: Array<{ label: string; value: string }>;
  downloadState?: MediaLightboxLoadingState;
  entry: MediaLightboxEntry;
  index: number;
  libraryState?: MediaLightboxLibraryState;
  prompt?: string | null;
  refreshState?: MediaLightboxLoadingState;
  remixLabel?: string;
  subtitle?: string;
  templateLabel?: string;
  title: string;
  onCopyLink: (entryId: string, url?: string | null) => void;
  onDownloadEntry: (entry: MediaLightboxEntry, url?: string | null) => void;
  onRefreshEntry?: (entry: MediaLightboxEntry) => void;
  onRemixEntry?: (entry: MediaLightboxEntry) => void;
  onSaveEntryToLibrary?: (entry: MediaLightboxEntry, mediaUrl?: string | null) => void;
  onUseTemplate?: (entry: MediaLightboxEntry) => void;
};

export function MediaLightboxEntryCard({
  copiedId,
  detailSpecsBase,
  downloadState,
  entry,
  index,
  libraryState,
  prompt,
  refreshState,
  remixLabel,
  subtitle,
  templateLabel,
  title,
  onCopyLink,
  onDownloadEntry,
  onRefreshEntry,
  onRemixEntry,
  onSaveEntryToLibrary,
  onUseTemplate,
}: MediaLightboxEntryCardProps) {
  const { t } = useI18n();
  const videoUrl = entry.videoUrl ?? undefined;
  const audioUrl = entry.audioUrl ?? undefined;
  const imageUrl = entry.imageUrl ?? undefined;
  const thumbUrl = entry.thumbUrl ?? undefined;
  const stableImageUrl = resolveStableMediaUrl(entry.imageUrl, entry.thumbUrl);
  const mediaUrl = entry.videoUrl ?? entry.audioUrl ?? stableImageUrl ?? entry.thumbUrl ?? null;
  const isProcessing = entry.status === 'pending';
  const progressLabel =
    typeof entry.progress === 'number'
      ? `${Math.max(0, Math.min(100, Math.round(entry.progress)))}%`
      : isProcessing
        ? 'Processing'
        : undefined;
  const statusLabel = entry.status ? t(`workspace.result.status.${entry.status}`, resolveStatusLabel(entry.status)) : resolveStatusLabel(entry.status);

  const isVertical = isVerticalAspect(entry.aspectRatio);
  const isRefreshing = Boolean(refreshState?.loading);
  const refreshError = refreshState?.error ?? null;
  const refreshTarget = entry.jobId ?? entry.id;
  const hasRefreshTarget = typeof refreshTarget === 'string' && refreshTarget.trim().length > 0;
  const canRefresh =
    Boolean(onRefreshEntry) &&
    hasRefreshTarget &&
    (entry.status === 'pending' || (!entry.videoUrl && !entry.audioUrl));
  const canRemix = Boolean(onRemixEntry);
  const canTemplate = Boolean(onUseTemplate) && !entry.curated;
  const isDownloading = Boolean(downloadState?.loading);
  const downloadError = downloadState?.error ?? null;
  const showPrompt = Boolean(prompt) && index === 0;
  const displayTitle = entry.engineLabel ?? subtitle ?? title;
  const detailSpecs = [
    ...(entry.jobId ? [{ label: 'Job ID', value: entry.jobId }] : []),
    ...detailSpecsBase.filter((item) => !['engine', 'created', 'date'].includes(item.label.toLowerCase())),
  ].filter((item) => Boolean(item.value));

  return (
    <article className="app-result-entry">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold text-text-primary sm:text-2xl">{displayTitle}</h3>
            {statusLabel ? (
              <span className={clsx('rounded-pill border px-3 py-1 text-[11px] font-semibold uppercase tracking-micro', statusBadgeClass(entry.status))}>
                {statusLabel}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-primary">
            {typeof entry.durationSec === 'number' ? <MetaItem icon={Clock3} label={t('workspace.result.duration', 'Duration') ?? 'Duration'} value={`${entry.durationSec}s`} /> : null}
            {entry.aspectRatio ? <MetaItem icon={Monitor} label={t('workspace.result.aspect', 'Format') ?? 'Format'} value={entry.aspectRatio} /> : null}
            <MetaItem icon={AudioWaveform} label="Audio" value={entry.hasAudio || audioUrl ? t('workspace.result.audioOn', 'On') ?? 'On' : t('workspace.result.audioOff', 'Off') ?? 'Off'} />

          </div>
        </div>

      </header>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div>
          <div
            className={clsx(
              'relative overflow-hidden rounded-[18px] border border-hairline bg-black shadow-card',
              isVertical ? 'mx-auto aspect-[9/16] max-h-[58vh] max-w-sm' : 'aspect-video'
            )}
          >
            {videoUrl ? (
              <video
                key={videoUrl}
                src={videoUrl}
                poster={thumbUrl}
                className="absolute inset-0 h-full w-full object-contain"
                controls
                playsInline
                autoPlay={index === 0}
                muted
                preload={index === 0 ? 'auto' : 'none'}
              />
            ) : audioUrl ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(124,85,234,0.28),_transparent_52%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.88))] px-6 py-6 text-center">
                {thumbUrl ? <Image src={thumbUrl} alt="" fill className="object-cover opacity-20" sizes="(max-width: 1024px) 100vw, calc(100vw - 360px)" /> : null}
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/icons/audio.svg" alt="" className="h-10 w-10 opacity-95" />
                </div>
                <p className="relative mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                  {t('workspace.result.audioOutput', 'Audio output')}
                </p>
                <div className="relative mt-5 w-full max-w-xl">
                  <audio controls src={audioUrl} className="w-full" />
                </div>
              </div>
            ) : stableImageUrl || imageUrl || thumbUrl ? (
              <Image src={stableImageUrl ?? imageUrl ?? thumbUrl ?? ''} alt="" fill className="object-contain" sizes="(max-width: 1024px) 100vw, calc(100vw - 360px)" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-2 via-surface to-surface-2 text-[12px] font-medium uppercase tracking-micro text-text-muted">
                {t('workspace.result.unavailable', 'Preview unavailable')}
              </div>
            )}
            {entry.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available" /> : null}
            {isProcessing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-on-media-dark-45 px-3 text-center text-[11px] text-on-inverse backdrop-blur-sm">
                <span className="uppercase tracking-micro">{t('workspace.result.processing', 'Processing…')}</span>
                {entry.message ? <span className="mt-1 line-clamp-2 text-on-media-80">{entry.message}</span> : null}
                {progressLabel ? <span className="mt-1 text-[12px] font-semibold text-on-inverse">{progressLabel}</span> : null}
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {canRefresh ? (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => onRefreshEntry?.(entry)}
                disabled={isRefreshing}
                className="min-w-0 border-[var(--brand-border)] px-5 text-brand hover:bg-[var(--brand-soft)]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                {isRefreshing ? t('workspace.result.checking', 'Checking…') : t('workspace.result.refresh', 'Refresh status')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => onDownloadEntry(entry, mediaUrl)}
              disabled={!mediaUrl || isDownloading}
              className="min-w-0 px-3"
            >
              <Download className="h-4 w-4" aria-hidden />
              {isDownloading ? t('workspace.result.downloading', 'Downloading…') : t('workspace.result.download', 'Download')}
            </Button>
            <ButtonLink
              linkComponent="a"
              href={mediaUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
              size="md"
              variant="outline"
              className={clsx('min-w-0 px-3', !mediaUrl && 'pointer-events-none opacity-50')}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {t('workspace.result.openOriginal', 'Open original')}
            </ButtonLink>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => onCopyLink(entry.id, mediaUrl)}
              disabled={!mediaUrl}
              className="min-w-0 border-hairline px-5 text-text-primary hover:bg-surface-2"
            >
              <LinkIcon className="h-4 w-4" aria-hidden />
              {copiedId === entry.id ? t('workspace.result.copied', 'Link copied') : t('workspace.result.copyLink', 'Copy link')}
            </Button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {onRemixEntry ? (
            <ActionCard
              icon={WandSparkles}
              title={remixLabel ?? t('workspace.result.remix', 'Remix') ?? 'Remix'}
              disabled={!canRemix}
              onClick={() => onRemixEntry(entry)}
            />
          ) : null}
          {onUseTemplate ? (
            <ActionCard
              icon={CalendarDays}
              title={templateLabel ?? t('workspace.result.reuse', 'Use settings') ?? 'Use settings'}
              disabled={!canTemplate}
              onClick={() => onUseTemplate(entry)}
            />
          ) : null}
          {onSaveEntryToLibrary ? (
            <ActionCard
              icon={Sparkles}
              title={
                libraryState?.loading
                  ? t('workspace.result.saving', 'Saving…') ?? 'Saving…'
                  : libraryState?.success
                    ? t('workspace.result.saved', 'Saved') ?? 'Saved'
                    : libraryState?.error
                      ? t('workspace.result.retrySave', 'Retry save') ?? 'Retry save'
                      : t('workspace.result.save', 'Save to library') ?? 'Save to library'
              }
              disabled={!mediaUrl || libraryState?.loading}
              onClick={() => onSaveEntryToLibrary(entry, mediaUrl)}
            />
          ) : null}

          </div>
        </div>

        <aside className="app-result-details space-y-0 overflow-hidden rounded-[18px] border border-hairline bg-surface-2/60">
          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{t('workspace.result.details', 'Render details')}</p>
            <dl className="mt-4 space-y-4 text-sm">
              {detailSpecs.length > 0 ? (
                detailSpecs.map((item) => (
                  <div key={`${entry.id}-detail-${item.label}`}>
                    <dt className="text-xs font-medium text-text-muted">{t(`workspace.result.metadata.${item.label.toLowerCase().replaceAll(' ', '_')}`, item.label)}</dt>
                    <dd className="mt-1 break-words font-medium text-text-primary">{item.value}</dd>
                  </div>
                ))
              ) : (
                <div>
                  <dt className="text-xs font-medium text-text-muted">Render</dt>
                  <dd className="mt-1 font-medium text-text-primary">{entry.label || title}</dd>
                </div>
              )}
            </dl>
          </div>

          {showPrompt ? (
            <div className="border-t border-hairline p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Prompt</p>
                <CopyPromptButton prompt={prompt ?? ''} copyLabel={t('workspace.result.copy', 'Copy')} copiedLabel={t('workspace.result.copyDone', 'Copied')} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-text-primary">
                {formatPromptPreview(prompt ?? '')}
              </p>
              {prompt && prompt.trim().length > 220 ? (
                <details className="group mt-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-micro text-brand">
                    <span className="group-open:hidden">{t('workspace.result.more', 'Show more')}</span>
                    <span className="hidden group-open:inline">{t('workspace.result.less', 'Show less')}</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-secondary">{prompt}</p>
                </details>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>


      {entry.message && !isProcessing && !isUuidLike(entry.message.trim()) ? (
        <p className="mt-4 text-sm text-text-secondary">{entry.message}</p>
      ) : null}
      {downloadError ? <p className="mt-2 text-xs text-state-warning">{downloadError}</p> : null}
      {refreshError ? <p className="mt-2 text-xs text-state-warning">{refreshError}</p> : null}
      {libraryState?.error ? <p className="mt-2 text-xs text-state-warning">{libraryState.error}</p> : null}
    </article>
  );
}
