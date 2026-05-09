import Link from 'next/link';
import {
  ArrowRight,
  BadgeDollarSign,
  Box,
  CalendarDays,
  Clock3,
  ExternalLink,
  Film,
  GalleryHorizontal,
  Monitor,
  Sparkles,
  Volume2,
  WandSparkles,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { humanizeTag, type WatchPageData } from '../_lib/video-watch-page-utils';
import { VideoWatchCard } from './VideoWatchCard';

type HighlightTone = 'blue' | 'green' | 'rose' | 'amber' | 'slate';

function getDetailIcon(key: string): LucideIcon {
  switch (key) {
    case 'engine':
      return Film;
    case 'mode':
      return WandSparkles;
    case 'duration':
      return Clock3;
    case 'aspectRatio':
      return Monitor;
    case 'resolution':
      return GalleryHorizontal;
    case 'audio':
      return Volume2;
    case 'cost':
      return BadgeDollarSign;
    case 'created':
      return CalendarDays;
    default:
      return Box;
  }
}

function buildHighlightItems(signals: WatchPageData['signals']): Array<{
  title: string;
  body: string;
  tone: HighlightTone;
  Icon: LucideIcon;
}> {
  const items = signals.whatThisShows.slice(0, 5).map((item) => {
    const lower = item.toLowerCase();
    const isAudio = lower.includes('audio');
    const isCamera = lower.includes('camera') || lower.includes('push') || lower.includes('tracking') || lower.includes('drone');
    const isFrame = lower.includes('frame') || lower.includes('image');
    const isStyle = lower.includes('style') || lower.includes('scene');
    return {
      title: item,
      body: isCamera
        ? 'Camera and movement cue'
        : isAudio
          ? 'Audio-driven atmosphere'
          : isFrame
            ? 'Source or framing control'
            : isStyle
              ? 'Visual direction'
              : 'Generation signal',
      tone: (isCamera ? 'blue' : isAudio ? 'slate' : isFrame ? 'green' : isStyle ? 'amber' : 'rose') as HighlightTone,
      Icon: isCamera ? Waves : isAudio ? Volume2 : isFrame ? GalleryHorizontal : isStyle ? Sparkles : WandSparkles,
    };
  });

  if (items.length) return items;

  return signals.capabilityTags.slice(0, 5).map((tag) => ({
    title: humanizeTag(tag),
    body: 'Detected workflow signal',
    tone: 'blue' as HighlightTone,
    Icon: WandSparkles,
  }));
}

function getHighlightToneClass(tone: HighlightTone): string {
  switch (tone) {
    case 'green':
      return 'bg-success-bg text-success';
    case 'rose':
      return 'bg-error-bg text-error';
    case 'amber':
      return 'bg-warning-bg text-warning';
    case 'slate':
      return 'bg-surface-3 text-text-secondary';
    case 'blue':
    default:
      return 'bg-[var(--brand-soft)] text-brand';
  }
}

export function VideoWatchSidebar({
  createdLabel,
  signals,
}: {
  createdLabel: string;
  signals: WatchPageData['signals'];
}) {
  const sidebarDetailRows = signals.detailRows.some((row) => row.key === 'created')
    ? signals.detailRows
    : [...signals.detailRows, { key: 'created', label: 'Created', value: createdLabel }];
  const highlightItems = buildHighlightItems(signals);

  return (
    <aside className="space-y-5 lg:sticky lg:top-[calc(var(--header-height)+24px)] lg:self-start">
      <VideoWatchCard className="p-5">
        <h2 className="text-lg font-semibold text-text-primary">Render details</h2>
        <div className="mt-5 divide-y divide-hairline">
          {sidebarDetailRows.map((row) => {
            const DetailIcon = getDetailIcon(row.key);
            const label = row.key === 'mode' ? 'Workflow' : row.label;
            const value = row.key === 'created' ? createdLabel : row.value;
            return (
              <div key={row.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="inline-flex min-w-0 items-center gap-3 text-sm text-text-secondary">
                  <DetailIcon className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                  <span>{label}</span>
                </div>
                <span className="text-right text-sm font-semibold text-text-primary">{value}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-5 space-y-2">
          <ButtonLink href={signals.recreatePath} prefetch={false} className="w-full bg-text-primary text-bg hover:bg-text-primary/90">
            <Sparkles className="h-4 w-4" aria-hidden />
            Recreate in workspace
          </ButtonLink>
          <ButtonLink href={signals.recreatePath} variant="outline" prefetch={false} className="w-full">
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open in workspace
          </ButtonLink>
        </div>
      </VideoWatchCard>

      <VideoWatchCard className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-secondary">About this engine</p>
            <h2 className="mt-3 text-lg font-semibold text-text-primary">{signals.engineLabel}</h2>
          </div>
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-input bg-[var(--brand-soft)] text-brand">
            <Film className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-text-secondary">{signals.engineDescription}</p>
        {signals.engineBadges.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {signals.engineBadges.slice(0, 4).map((badge) => (
              <span key={badge} className="rounded-pill border border-hairline bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                {badge}
              </span>
            ))}
          </div>
        ) : null}
        {signals.modelPath ? (
          <Link
            href={signals.modelPath}
            prefetch={false}
            className="mt-5 inline-flex w-full items-center justify-between rounded-input bg-surface-2 px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-surface-hover"
          >
            Learn more about this engine
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </VideoWatchCard>

      <VideoWatchCard className="p-5">
        <h2 className="text-lg font-semibold text-text-primary">Shot highlights</h2>
        <div className="mt-4 space-y-3">
          {highlightItems.map(({ title, body, tone, Icon }) => (
            <div key={title} className="flex gap-3">
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-input ${getHighlightToneClass(tone)}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">{title}</p>
                <p className="mt-0.5 text-xs leading-5 text-text-secondary">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </VideoWatchCard>
    </aside>
  );
}
