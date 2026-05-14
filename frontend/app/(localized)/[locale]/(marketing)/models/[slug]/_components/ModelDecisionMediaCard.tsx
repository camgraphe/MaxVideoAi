import Image from 'next/image';
import { ExternalLink, Image as ImageIcon, Volume2 } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { ModelHeroMedia } from '@/components/marketing/ModelHeroMedia.client';
import { UIIcon } from '@/components/ui/UIIcon';

import type { FeaturedMedia } from '../_lib/model-page-media';
import { MODEL_PAGE_ICON_ON_DARK } from '../_lib/model-page-icon-styles';

type ModelDecisionMediaCardProps = {
  media: FeaturedMedia;
  label: string;
  description: string;
  badges: string[];
  renderLinkLabel: string;
  locale: AppLocale;
  audioBadgeLabel: string;
  altContext: string;
};

function getDecisionMediaAlt(locale: AppLocale, altContext: string) {
  if (altContext.trim()) return altContext;
  if (locale === 'fr') return 'Apercu video du modele';
  if (locale === 'es') return 'Vista previa de video del modelo';
  return 'Model video preview';
}

function isPlayableVideoUrl(src: string | null | undefined) {
  return Boolean(src && /\.(?:mp4|webm|mov)(?:[?#].*)?$/i.test(src));
}

export function ModelDecisionMediaCard({
  media,
  label,
  description,
  badges,
  renderLinkLabel,
  locale,
  audioBadgeLabel,
  altContext,
}: ModelDecisionMediaCardProps) {
  const posterSrc = media.posterUrl ?? null;
  const resolvedAltText = getDecisionMediaAlt(locale, altContext);
  const [audioBadge, durationBadge, ratioBadge] = badges;
  const leadingBadge = audioBadge ?? (media.hasAudio ? audioBadgeLabel : null);
  const LeadingBadgeIcon = media.hasAudio ? Volume2 : ImageIcon;
  const videoSrc = isPlayableVideoUrl(media.videoUrl) ? media.videoUrl : null;

  return (
    <figure className="relative overflow-hidden rounded-[24px] border border-[#cfdaea] bg-[#08172d] shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-white/10 dark:shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
      <div className="relative aspect-video w-full overflow-hidden">
        {videoSrc ? (
          <ModelHeroMedia
            posterSrc={posterSrc}
            videoSrc={videoSrc}
            alt={resolvedAltText}
            sizes="(max-width: 768px) 100vw, 760px"
            autoPlayDelayMs={250}
            waitForLcp
            showPlayButton={false}
            priority
            fetchPriority="high"
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
            sizes="(max-width: 768px) 100vw, 760px"
            quality={80}
            priority
            fetchPriority="high"
            loading="eager"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#0b1730] text-sm font-semibold text-white/70">
            Media preview
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,23,45,0.12)_0%,rgba(8,23,45,0)_42%,rgba(8,23,45,0.62)_100%)] dark:bg-[linear-gradient(180deg,rgba(3,7,18,0.20)_0%,rgba(3,7,18,0.06)_42%,rgba(3,7,18,0.72)_100%)]" />

        {leadingBadge ? (
          <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-xl bg-[#142238]/88 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white shadow-[0_8px_28px_rgba(0,0,0,0.24)] backdrop-blur dark:border dark:border-white/10">
            <UIIcon icon={LeadingBadgeIcon} size={15} strokeWidth={2} className={MODEL_PAGE_ICON_ON_DARK} />
            {leadingBadge}
          </span>
        ) : null}

        <div className="absolute right-5 top-5 flex items-center gap-2">
          {durationBadge ? (
            <span className="rounded-xl bg-[#142238]/82 px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_28px_rgba(0,0,0,0.24)] backdrop-blur dark:border dark:border-white/10">
              {durationBadge}
            </span>
          ) : null}
          {ratioBadge ? (
            <span className="rounded-xl bg-[#142238]/82 px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_28px_rgba(0,0,0,0.24)] backdrop-blur dark:border dark:border-white/10">
              {ratioBadge}
            </span>
          ) : null}
        </div>

        <figcaption className="absolute bottom-4 left-4 max-w-[min(310px,calc(100%-150px))] rounded-[10px] border border-white/14 bg-[#07111f]/70 px-4 py-3 text-white shadow-[0_14px_34px_rgba(0,0,0,0.24)] backdrop-blur-md">
          <p className="text-sm font-semibold leading-tight">{label}</p>
          <p className="mt-0.5 text-xs leading-5 text-white/74">{description}</p>
        </figcaption>

        {media.href ? (
          <Link
            href={media.href}
            className="absolute bottom-5 right-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white/14 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(0,0,0,0.24)] backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <span>{renderLinkLabel}</span>
            <UIIcon icon={ExternalLink} size={15} />
          </Link>
        ) : null}
      </div>
    </figure>
  );
}
