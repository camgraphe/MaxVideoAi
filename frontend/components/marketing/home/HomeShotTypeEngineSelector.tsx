import Image from 'next/image';
import { Layers3, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { UIIcon } from '@/components/ui/UIIcon';
import { BEST_FOR_CARD_VISUALS } from '@/components/marketing/home/home-redesign-visuals';
import { StartupFameLink } from '@/components/marketing/home/HomeStartupFameLink';
import type { SectionCopy, ShotTypeCard } from '@/components/marketing/home/home-redesign-types';

function renderBestForTitle(title: string) {
  const highlightTargets = ['use case.', 'l’usage.', 'cas d’usage.', 'caso de uso.'];
  const target = highlightTargets.find((candidate) => title.toLowerCase().endsWith(candidate));

  if (!target) return title;

  const start = title.length - target.length;
  return (
    <>
      {title.slice(0, start)}
      <span className="text-brand">{title.slice(start)}</span>
    </>
  );
}

function formatBestForPickLabel(label: string) {
  return label
    .replace(/^Seedance 2\.0 Fast$/i, 'Seedance Fast')
    .replace(/^Seedance 2\.0$/i, 'Seedance')
    .replace(/^Kling 3 (Pro|Standard)$/i, 'Kling')
    .replace(/^Veo 3\.1 Fast$/i, 'Veo Fast')
    .replace(/^Veo 3\.1$/i, 'Veo')
    .replace(/^LTX 2\.3 Fast$/i, 'LTX')
    .replace(/^LTX 2\.3 Pro$/i, 'LTX');
}

export function ShotTypeEngineSelector({
  copy,
  cards,
  startupFameLabel,
}: {
  copy: SectionCopy;
  cards: ShotTypeCard[];
  startupFameLabel?: string;
}) {
  const guideLabel = copy.guideLabel ?? 'Best-for guide';
  const topPicksLabel = copy.topPicksLabel ?? 'Top picks';

  return (
    <section className="dark-section-neon relative overflow-hidden border-b border-hairline bg-bg py-12 sm:py-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(17,24,39,0.08),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,0)_48%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.035),transparent_40%),linear-gradient(180deg,rgba(3,7,18,0.95),rgba(3,7,18,0)_56%)]" />
      <div className="container-page relative max-w-[1360px] stack-gap-lg">
        <div className="mx-auto max-w-4xl text-center">
          {copy.eyebrow ? (
            <span className="inline-flex rounded-full bg-brand/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
              {copy.eyebrow}
            </span>
          ) : null}
          <h2 className="mt-4 text-2xl font-semibold leading-tight text-text-primary sm:text-4xl md:text-5xl">
            {renderBestForTitle(copy.title)}
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:mt-4 sm:text-base sm:leading-7">{copy.subtitle}</p>
        </div>
        <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-5 xl:grid-cols-4">
          {cards.map((card) => {
            const visual = BEST_FOR_CARD_VISUALS[card.slug] ?? {
              imageSrc: '/assets/placeholders/preview-16x9.png',
              icon: Sparkles,
            };

            return (
              <Link
                key={card.id}
                href={card.href}
                className="dark-neon-panel group flex h-full min-h-0 flex-col overflow-hidden rounded-[16px] border border-hairline bg-white/88 shadow-[0_12px_32px_rgba(15,23,42,0.055),0_3px_10px_rgba(15,23,42,0.03)] transition hover:-translate-y-1 hover:border-text-muted/35 hover:shadow-[0_26px_62px_rgba(15,23,42,0.11)] focus:outline-none focus:ring-2 focus:ring-brand/35 dark:bg-surface-glass-80 dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)] dark:hover:border-white/20 dark:hover:bg-surface-glass-70 sm:rounded-[20px]"
                data-analytics-event="shot_type_card_click"
                data-analytics-cta-name={card.id}
                data-analytics-cta-location="shot_type_selector"
                data-analytics-target-family="best-for"
              >
                <div className="relative aspect-[16/9.8] overflow-hidden bg-surface-3 sm:aspect-[16/8.2]">
                  <Image
                    src={visual.imageSrc}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="(max-width: 639px) 50vw, (max-width: 1279px) 50vw, 320px"
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/32 via-black/5 to-black/12" />
                  <span className="absolute left-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/18 bg-[#111827]/90 text-white shadow-[0_12px_28px_rgba(0,0,0,0.28)] backdrop-blur sm:left-4 sm:top-4 sm:h-11 sm:w-11">
                    <UIIcon icon={visual.icon} size={18} strokeWidth={1.75} className="sm:h-[22px] sm:w-[22px]" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <span className="inline-flex w-fit rounded-full bg-brand/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-brand sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.08em]">
                    {guideLabel}
                  </span>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-text-primary sm:mt-3 sm:text-lg">{card.title}</h3>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-text-secondary sm:mt-2 sm:text-sm sm:leading-5">{card.body}</p>
                  <div className="mt-3 border-t border-hairline pt-2 sm:mt-4 sm:pt-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-[10px] sm:tracking-[0.08em]">{topPicksLabel}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1 sm:mt-2 sm:gap-1.5">
                      {card.topPicks.slice(0, 3).map((pick) => (
                        <span
                          key={pick.slug}
                          className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text-primary sm:gap-1.5 sm:px-2 sm:py-1 sm:text-[11px]"
                        >
                          <EngineIcon engine={{ id: pick.slug, label: pick.label, brandId: pick.brandId }} size={16} rounded="full" />
                          <span className="truncate">{formatBestForPickLabel(pick.label)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-auto pt-3 text-xs font-semibold text-brand transition group-hover:text-brandHover sm:pt-4 sm:text-sm">
                    {card.cta} <span aria-hidden="true">→</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
        {copy.cta ? (
          <div className="mx-auto flex max-w-[620px] flex-col items-center gap-2">
            <Link
              href={{ pathname: '/ai-video-engines/best-for' }}
              className="dark-neon-panel group flex w-full items-center gap-4 rounded-[22px] border border-hairline bg-white/82 p-4 text-left shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-text-muted/35 hover:shadow-[0_24px_64px_rgba(15,23,42,0.1)] focus:outline-none focus:ring-2 focus:ring-brand/35 dark:bg-surface-glass-80 dark:hover:bg-surface-glass-70"
              data-analytics-event="shot_type_card_click"
              data-analytics-cta-name="best-for-hub"
              data-analytics-cta-location="shot_type_hub_cta"
              data-analytics-target-family="best-for"
            >
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-brand/10 text-brand">
                <UIIcon icon={Layers3} size={24} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-text-primary">{copy.hubCtaTitle ?? copy.cta}</span>
                {copy.hubCtaBody ? (
                  <span className="mt-1 block text-sm leading-5 text-text-secondary">{copy.hubCtaBody}</span>
                ) : null}
              </span>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-primary transition group-hover:translate-x-1 group-hover:text-brand">
                <span aria-hidden="true">→</span>
              </span>
            </Link>
            {startupFameLabel ? <StartupFameLink label={startupFameLabel} /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
