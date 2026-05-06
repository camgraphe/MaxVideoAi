import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { ModelHeroMedia } from '@/components/marketing/ModelHeroMedia.client';
import { TextLink } from '@/components/ui/TextLink';
import { getImageAlt, withAltSuffix } from '@/lib/image-alt';
import { PRICE_AUDIO_LABELS } from '../_lib/model-page-specs';
import type { FeaturedMedia } from '../_lib/model-page-media';

export function MediaPreview({
  media,
  label,
  locale,
  audioBadgeLabel,
  renderLinkLabel,
  promptLabel,
  promptLines = [],
  hideLabel = false,
  hidePrompt = false,
  metaLines = [],
  altContext,
  autoPlayDelayMs,
  waitForLcp = false,
  showPlayButton = true,
  priority = false,
  fetchPriority = 'auto',
}: {
  media: FeaturedMedia;
  label: string;
  locale: AppLocale;
  audioBadgeLabel?: string;
  renderLinkLabel?: string;
  promptLabel?: string;
  promptLines?: string[];
  hideLabel?: boolean;
  hidePrompt?: boolean;
  metaLines?: Array<{ label: string; value: string }>;
  altContext?: string;
  autoPlayDelayMs?: number;
  waitForLcp?: boolean;
  showPlayButton?: boolean;
  priority?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
}) {
  const posterSrc = media.posterUrl ?? null;
  const aspect = media.aspectRatio ?? '16:9';
  const [w, h] = aspect.split(':').map(Number);
  const isValidAspect = Number.isFinite(w) && Number.isFinite(h) && h > 0 && w > 0;
  const paddingBottom = isValidAspect ? `${(h / w) * 100}%` : '56.25%';
  const isVertical = isValidAspect ? w < h : false;
  const normalizedPromptLabel = promptLabel?.trim() ?? '';
  const displayPromptLabel = /^prompt\b/i.test(normalizedPromptLabel) ? 'Prompt' : normalizedPromptLabel;
  const altText = getImageAlt({
    kind: 'renderThumb',
    engine: media.label ?? label,
    label: media.prompt ?? label,
    prompt: media.prompt ?? label,
    locale,
  });
  const resolvedAltText = altContext ? withAltSuffix(altText, altContext) : altText;
  const resolvedAudioBadgeLabel = audioBadgeLabel ?? (PRICE_AUDIO_LABELS[locale] ?? PRICE_AUDIO_LABELS.en).on;
  const resolvedRenderLinkLabel =
    renderLinkLabel ?? (locale === 'fr' ? 'Voir le rendu →' : locale === 'es' ? 'Ver render →' : 'View render →');
  const figureClassName = [
    'group relative overflow-hidden rounded-[22px] border border-hairline bg-surface shadow-card',
    isVertical ? 'mx-auto max-w-sm' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <figure className={figureClassName}>
      <div className="relative w-full overflow-hidden rounded-t-[22px] bg-placeholder">
        <div className="relative w-full" style={{ paddingBottom }}>
          <div className="absolute inset-0">
            {media.videoUrl ? (
              <ModelHeroMedia
                posterSrc={posterSrc}
                videoSrc={media.videoUrl}
                alt={resolvedAltText}
                sizes="(max-width: 768px) 100vw, 720px"
                autoPlayDelayMs={autoPlayDelayMs}
                waitForLcp={waitForLcp}
                showPlayButton={showPlayButton}
                priority={priority}
                fetchPriority={fetchPriority}
                quality={80}
                className="absolute inset-0"
                objectClassName="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              />
            ) : posterSrc ? (
              <Image
                src={posterSrc}
                alt={resolvedAltText}
                fill
                className="h-full w-full object-cover"
                sizes="(max-width: 768px) 100vw, 720px"
                quality={80}
                priority={priority}
                fetchPriority={fetchPriority}
                loading={priority ? 'eager' : 'lazy'}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-surface-2 text-sm font-semibold text-text-muted">
                Media preview
              </div>
            )}
            {media.hasAudio ? (
              <span className="absolute left-3 top-3 rounded-full bg-surface-on-media-dark-70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-on-inverse">
                {resolvedAudioBadgeLabel}
              </span>
            ) : null}
            {media.durationSec ? (
              <span className="absolute right-3 top-3 rounded-full bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-primary shadow-card">
                {media.durationSec}s
              </span>
            ) : null}
          </div>
      </div>
    </div>
      <figcaption className="space-y-1 px-4 py-3">
        {!hideLabel ? <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</p> : null}
        {metaLines.length ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-text-secondary">
            {metaLines.map((line) => (
              <li key={line.label} className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">
                  {line.label}
                </span>
                <span>{line.value}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {!hidePrompt &&
        displayPromptLabel &&
        displayPromptLabel.toLowerCase() !== label.trim().toLowerCase() &&
        !/demo/i.test(displayPromptLabel) ? (
          <p className="text-xs font-semibold text-text-secondary">{displayPromptLabel}</p>
        ) : null}
        {!hidePrompt && promptLines.length ? (
          <div className="space-y-2 text-sm text-text-primary">
            {promptLines.map((line) => (
              <p key={line} className="leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {!hidePrompt && promptLines.length === 0 && media.prompt ? (
          <p className="text-sm font-semibold leading-snug text-text-primary">{media.prompt}</p>
        ) : null}
        {media.href ? (
          <TextLink href={media.href} className="gap-1 text-xs" linkComponent={Link}>
            {resolvedRenderLinkLabel}
          </TextLink>
        ) : null}
      </figcaption>
    </figure>
  );
}
