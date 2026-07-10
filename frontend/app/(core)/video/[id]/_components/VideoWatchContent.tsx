import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, Box, Clock3, ExternalLink, Film, Monitor, Sparkles, Tag, TextCursorInput, Volume2, type LucideIcon } from 'lucide-react';
import { CopyPromptButton } from '@/components/CopyPromptButton';
import { ButtonLink } from '@/components/ui/Button';
import { WatchKeyFrames } from '@/components/watch/WatchKeyFrames';
import { WatchVideoPlayer } from '@/components/watch/WatchVideoPlayer';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { FALLBACK_POSTER, FALLBACK_THUMB, SITE, formatWatchDate, getDetailValue, humanizeTag, parseAspectRatio, serializeJsonLd, toAbsoluteUrl, toDurationIso, type WatchPageData } from '../_lib/video-watch-page-utils';
import { VideoWatchCard } from './VideoWatchCard';
import { VideoWatchRelatedExamples } from './VideoWatchRelatedExamples';
import { VideoWatchSidebar } from './VideoWatchSidebar';
import { VideoWatchSourceImages } from './VideoWatchSourceImages';

const PROMPT_CONTEXT_PREVIEW_MAX_CHARS = 280;

export function VideoWatchContent({ page }: { page: WatchPageData }) {
  const { video, signals, related, isEligible } = page;
  const canonical = signals.canonicalUrl;
  const playbackPoster =
    buildOptimizedPosterUrl(video.thumbUrl ?? FALLBACK_POSTER, { width: 1200, quality: 72 }) ??
    video.thumbUrl ??
    FALLBACK_POSTER;
  const videoUrl = toAbsoluteUrl(video.videoUrl) ?? video.videoUrl ?? canonical;
  const thumbnailUrl = toAbsoluteUrl(video.thumbUrl) ?? FALLBACK_THUMB;
  const aspect = parseAspectRatio(signals.aspectRatio ?? video.aspectRatio);
  const hasControls = Boolean(signals.promptRows.length || signals.inputRows.length);

  const containerStyle: CSSProperties = {
    maxHeight: '62vh',
    width: '100%',
  };
  if (aspect) {
    containerStyle.aspectRatio = `${aspect.width} / ${aspect.height}`;
    const maxWidth = 54 * (aspect.width / aspect.height);
    containerStyle.maxWidth = `${maxWidth.toFixed(2)}vh`;
    containerStyle.margin = '0 auto';
  }

  const videoJsonLd = isEligible
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        url: canonical,
        mainEntityOfPage: canonical,
        name: signals.videoObjectName,
        description: signals.metaDescription,
        thumbnailUrl: [thumbnailUrl],
        uploadDate: new Date(page.entry?.publishedAt ?? video.createdAt).toISOString(),
        duration: toDurationIso(signals.durationSec ?? video.durationSec),
        contentUrl: videoUrl,
        publisher: {
          '@type': 'Organization',
          name: 'MaxVideoAI',
          url: SITE,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE}/favicon-512.png`,
          },
        },
      }
    : null;

  const breadcrumbJsonLd = isEligible
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: signals.breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.label,
          ...(item.href ? { item: `${SITE}${item.href === '/' ? '' : item.href}` } : {}),
        })),
      }
    : null;

  const detailRows = signals.detailRows;
  const workflowLabel = getDetailValue(detailRows, 'mode') ?? signals.modeLabel;
  const durationLabel = getDetailValue(detailRows, 'duration') ?? (signals.durationSec ? `${signals.durationSec} seconds` : null);
  const aspectLabel = getDetailValue(detailRows, 'aspectRatio') ?? signals.aspectRatio;
  const resolutionLabel = getDetailValue(detailRows, 'resolution') ?? signals.resolution;
  const audioLabel = getDetailValue(detailRows, 'audio') ?? (signals.hasAudio ? 'Enabled' : 'Off');
  const costLabel = getDetailValue(detailRows, 'cost');
  const createdLabel = formatWatchDate(video.createdAt);
  const promptContextText = signals.seoPromptContext ?? signals.promptPreview;
  const promptContextTitle = signals.seoPromptContext ? 'Visual workflow context' : 'Prompt breakdown';
  const promptContextDescription = signals.seoPromptContext
    ? 'Editorial notes for the source images and visual reference workflow.'
    : 'Prompt used to generate this render.';
  const sourceImagesTitle = signals.seoPromptContext?.toLowerCase().includes('storyboard') ? 'Storyboard inputs' : 'Source images';
  const cameraHighlights = signals.capabilityTags
    .filter((tag) => ['push-in', 'tracking', 'drone', 'close-up', 'transition', 'camera-lock'].includes(tag))
    .map(humanizeTag);
  const promptBreakdownRows = [
    { label: 'Workflow', value: workflowLabel },
    { label: 'Camera', value: cameraHighlights.length ? cameraHighlights.join(', ') : humanizeTag(signals.primaryIntent) },
    { label: 'Output', value: [durationLabel, aspectLabel, resolutionLabel].filter(Boolean).join(' · ') },
    ...(costLabel ? [{ label: 'Recorded render cost', value: costLabel }] : []),
    { label: 'Audio', value: audioLabel },
    { label: 'Constraints', value: signals.negativePrompt ?? signals.capabilityTags.slice(0, 3).map(humanizeTag).join(', ') },
  ].filter((row) => row.value);
  const heroChips = [
    { key: 'engine', label: signals.engineLabel, Icon: Film },
    { key: 'workflow', label: workflowLabel, Icon: TextCursorInput },
    { key: 'duration', label: durationLabel, Icon: Clock3 },
    { key: 'aspect', label: aspectLabel, Icon: Monitor },
    { key: 'audio', label: audioLabel, Icon: Volume2 },
    { key: 'cost', label: costLabel, Icon: Tag },
  ].filter((chip): chip is { key: string; label: string; Icon: LucideIcon } => Boolean(chip.label));
  const fullPromptId = `video-full-prompt-${video.id}`;
  const promptContextIsLong = promptContextText.length > PROMPT_CONTEXT_PREVIEW_MAX_CHARS;
  const promptContextPreviewText = promptContextIsLong ? `${promptContextText.slice(0, PROMPT_CONTEXT_PREVIEW_MAX_CHARS).trimEnd()}...` : promptContextText;
  const promptExpandedText = signals.seoPromptContext || promptContextIsLong ? promptContextText : signals.promptText;
  const promptIsExpandable = promptContextIsLong || Boolean(signals.promptText.trim() && signals.promptText.trim() !== promptContextText.trim());
  const promptCollapsedLabel = signals.seoPromptContext ? 'Show full context' : 'Show full prompt';
  const promptExpandedLabel = signals.seoPromptContext ? 'Hide full context' : 'Hide full prompt';

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-5 sm:px-6 lg:px-8">
      <link rel="preload" as="image" href={playbackPoster} fetchPriority="high" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            {signals.breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">
                {index > 0 ? <span aria-hidden>›</span> : null}
                {crumb.href ? (
                  <Link href={crumb.href} prefetch={false} className="font-medium hover:text-text-primary">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-text-primary">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <ButtonLink href={signals.recreatePath} size="sm" prefetch={false} className="bg-text-primary text-bg shadow-card hover:bg-text-primary/90">
          <Sparkles className="h-4 w-4" aria-hidden />
          Start a render
        </ButtonLink>
      </div>

      <article className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <VideoWatchCard className="overflow-hidden">
            <WatchVideoPlayer
              src={videoUrl}
              poster={playbackPoster}
              title={signals.title}
              engineLabel={signals.engineLabel}
              hasAudio={signals.hasAudio}
              containerStyle={containerStyle}
              videoStyle={aspect ? { aspectRatio: `${aspect.width} / ${aspect.height}` } : undefined}
            />

            <div className="p-5 sm:p-6">
              <div className="max-w-3xl">
                <h1 className="text-[1.75rem] font-semibold tracking-tight text-text-primary sm:text-[2.1rem]">{signals.title}</h1>
                <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-[15px]">{signals.intro}</p>
              </div>

              {heroChips.length ? (
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {heroChips.map(({ key, label, Icon }) => (
                    <span
                      key={key}
                      className="inline-flex min-h-[36px] items-center gap-2 rounded-input border border-hairline bg-surface-2 px-3 text-xs font-semibold text-text-secondary"
                    >
                      <Icon className="h-4 w-4 text-text-muted" aria-hidden />
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}

              {signals.badges.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {signals.badges.map((badge) => (
                    <span key={badge} className="rounded-pill bg-[var(--brand-soft)] px-2.5 py-1 text-[11px] font-semibold text-brand">
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ButtonLink href={signals.recreatePath} size="lg" prefetch={false} className="w-full bg-text-primary text-bg hover:bg-text-primary/90">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Recreate this video
                </ButtonLink>
                {signals.modelPath ? (
                  <ButtonLink href={signals.modelPath} variant="outline" size="lg" prefetch={false} className="w-full">
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open model page
                  </ButtonLink>
                ) : signals.parentPath ? (
                  <ButtonLink href={signals.parentPath} variant="outline" size="lg" prefetch={false} className="w-full">
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open examples
                  </ButtonLink>
                ) : null}
              </div>
            </div>
          </VideoWatchCard>

          <VideoWatchSourceImages title={sourceImagesTitle} sourceImages={signals.sourceImages} />

          <VideoWatchCard className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2">
                  <TextCursorInput className="h-4 w-4 text-brand" aria-hidden />
                  <h2 className="text-lg font-semibold text-text-primary">{promptContextTitle}</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{promptContextDescription}</p>
              </div>
              <CopyPromptButton prompt={signals.promptText} copyLabel="Copy full prompt" copiedLabel="Copied!" />
            </div>

            <div className="mt-5 overflow-hidden rounded-input border border-hairline">
              {promptIsExpandable ? (
                <details className="group border-b border-hairline bg-surface-2">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm leading-6 text-text-primary">
                    <span className="block group-open:hidden">{promptContextPreviewText}</span>
                    <span className="mt-2 inline-flex text-xs font-semibold text-brand transition group-open:hidden hover:text-brandHover">
                      {promptCollapsedLabel}
                    </span>
                    <span className="hidden text-xs font-semibold text-brand transition group-open:inline hover:text-brandHover">
                      {promptExpandedLabel}
                    </span>
                  </summary>
                  <p id={fullPromptId} className="whitespace-pre-line px-4 pb-4 text-sm leading-6 text-text-secondary">{promptExpandedText}</p>
                </details>
              ) : (
                <div id={fullPromptId} className="border-b border-hairline bg-surface-2 px-4 py-3 text-sm leading-6 text-text-primary">{promptContextText}</div>
              )}
              <div className="grid divide-y divide-hairline md:grid-cols-2 md:divide-x md:divide-y-0">
                {promptBreakdownRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[110px_minmax(0,1fr)] divide-x divide-hairline">
                    <p className="bg-surface-2 px-3 py-3 text-[11px] font-semibold uppercase tracking-micro text-text-secondary">{row.label}</p>
                    <p className="px-3 py-3 text-xs leading-5 text-text-secondary">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {hasControls ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[...signals.promptRows, ...signals.inputRows].slice(0, 6).map((row) => (
                  <div key={row.key} className="rounded-input border border-hairline bg-surface-2 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">{row.label}</p>
                    <p className="mt-1 text-xs font-semibold text-text-primary">{row.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </VideoWatchCard>

          {signals.promptImprovementNotes.length ? (
            <VideoWatchCard className="p-5 sm:p-6">
              <div className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand" aria-hidden />
                <h2 className="text-lg font-semibold text-text-primary">Prompt improvement notes</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {signals.promptImprovementNotes.map((note, index) => (
                  <div key={note} className="rounded-input border border-hairline bg-surface-2 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">Note {index + 1}</p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">{note}</p>
                  </div>
                ))}
              </div>
            </VideoWatchCard>
          ) : null}

          {signals.compareLinks.length ? (
            <VideoWatchCard className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Compare this model</h2>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    Review this example beside nearby engines before choosing a render path.
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-text-muted" aria-hidden />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {signals.compareLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={false}
                    className="rounded-input border border-hairline bg-surface-2 px-4 py-3 transition hover:bg-surface-hover"
                  >
                    <span className="block text-sm font-semibold text-text-primary">{link.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-text-secondary">{link.reason}</span>
                  </Link>
                ))}
              </div>
            </VideoWatchCard>
          ) : null}

          <VideoWatchCard className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-text-primary">Why {signals.engineLabel} fits this shot</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{signals.engineDescription}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(signals.engineBadges.length ? signals.engineBadges : signals.whatThisShows).slice(0, 4).map((badge, index) => (
                <div key={`${badge}-${index}`} className="rounded-input border border-hairline bg-surface-2 px-4 py-3">
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-input bg-[var(--brand-soft)] text-brand">
                    <Box className="h-4 w-4" aria-hidden />
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{badge}</p>
                </div>
              ))}
            </div>
          </VideoWatchCard>

          <VideoWatchCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-text-primary">Key frames</h2>
              <ArrowRight className="h-4 w-4 text-text-muted" aria-hidden />
            </div>
            <WatchKeyFrames
              videoUrl={videoUrl}
              posterUrl={thumbnailUrl}
              title={signals.title}
              durationSec={signals.durationSec ?? video.durationSec}
              keyframeUrls={video.keyframeUrls}
            />
          </VideoWatchCard>

          <VideoWatchRelatedExamples related={related} />
        </div>

        <VideoWatchSidebar createdLabel={createdLabel} signals={signals} />
      </article>

      {videoJsonLd ? (
        <script
          id={`video-jsonld-${video.id}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(videoJsonLd) }}
        />
      ) : null}
      {breadcrumbJsonLd ? (
        <script
          id={`video-breadcrumb-jsonld-${video.id}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
        />
      ) : null}
    </div>
  );
}
