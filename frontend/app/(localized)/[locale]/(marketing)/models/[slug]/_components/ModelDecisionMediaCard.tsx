import Image from 'next/image';
import { ExternalLink, Volume2 } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { ModelHeroMedia } from '@/components/marketing/ModelHeroMedia.client';
import { UIIcon } from '@/components/ui/UIIcon';
import { getImageAlt, withAltSuffix } from '@/lib/image-alt';

import type { FeaturedMedia } from '../_lib/model-page-media';

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
  const altText = getImageAlt({
    kind: 'renderThumb',
    engine: media.label ?? label,
    label: media.prompt ?? label,
    prompt: media.prompt ?? label,
    locale,
  });
  const resolvedAltText = altContext ? withAltSuffix(altText, altContext) : altText;
  const [audioBadge, durationBadge, ratioBadge] = badges;

  return (
    <figure className="relative overflow-hidden rounded-[24px] border border-[#cfdaea] bg-[#08172d] shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-white/10 dark:shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
      <div className="relative aspect-video w-full overflow-hidden">
        {media.videoUrl ? (
          <ModelHeroMedia
            posterSrc={posterSrc}
            videoSrc={media.videoUrl}
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

        {media.hasAudio || audioBadge ? (
          <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-xl bg-[#142238]/88 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#34f5d0] shadow-[0_8px_28px_rgba(0,0,0,0.24)] backdrop-blur dark:border dark:border-cyan-300/15">
            <UIIcon icon={Volume2} size={15} strokeWidth={2} />
            {audioBadge ?? audioBadgeLabel}
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

        <figcaption className="absolute bottom-5 left-5 max-w-[min(420px,calc(100%-160px))] rounded-xl border border-white/14 bg-[#07111f]/74 px-5 py-4 text-white shadow-[0_18px_46px_rgba(0,0,0,0.28)] backdrop-blur-md">
          <p className="text-base font-semibold leading-tight">{label}</p>
          <p className="mt-1 text-sm text-white/76">{description}</p>
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
