import {
  ArrowRight,
  ArrowRightLeft,
  AudioLines,
  Clock3,
  Film,
  Image as ImageIcon,
  Layers3,
  Mic2,
  PencilLine,
  PlayCircle,
  Sparkles,
  Tag,
  WalletCards,
} from 'lucide-react';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { UIIcon } from '@/components/ui/UIIcon';

import type { ModelDecisionData, ModelDecisionFeature } from '../_lib/model-page-decision-data';
import type { FeaturedMedia } from '../_lib/model-page-media';
import { ModelDecisionMediaCard } from './ModelDecisionMediaCard';

const FEATURE_ICON_MAP: Record<ModelDecisionFeature['tone'], typeof Mic2> = {
  audio: AudioLines,
  continuity: Layers3,
  reference: ImageIcon,
  quality: Film,
  duration: Clock3,
  price: WalletCards,
};

const FEATURE_TONE_STYLES: Record<ModelDecisionFeature['tone'], { iconWrap: string; icon: string }> = {
  audio: { iconWrap: 'bg-[#e8fbf4] dark:bg-emerald-400/10', icon: 'text-[#16b978] dark:text-emerald-300' },
  continuity: { iconWrap: 'bg-[#f1ebff] dark:bg-violet-400/10', icon: 'text-[#8057f5] dark:text-violet-300' },
  reference: { iconWrap: 'bg-[#eaf6ff] dark:bg-sky-400/10', icon: 'text-[#2697ec] dark:text-sky-300' },
  quality: { iconWrap: 'bg-[#f2edff] dark:bg-indigo-400/10', icon: 'text-[#7457f5] dark:text-indigo-300' },
  duration: { iconWrap: 'bg-[#fff2e8] dark:bg-orange-400/10', icon: 'text-[#f97316] dark:text-orange-300' },
  price: { iconWrap: 'bg-[#edf4ff] dark:bg-blue-400/10', icon: 'text-[#316bff] dark:text-blue-300' },
};

const QUICK_LINK_ICONS = [ArrowRightLeft, Tag, PencilLine] as const;

const HOME_CRUMB: Record<AppLocale, { label: string; href: string }> = {
  en: { label: 'Home', href: '/' },
  fr: { label: 'Accueil', href: '/fr' },
  es: { label: 'Inicio', href: '/es' },
};

function renderHeroSubtitle(subtitle: string, locale: AppLocale) {
  if (locale !== 'en') {
    return subtitle;
  }

  return (
    <>
      <span className="text-[#2468ff] dark:text-cyan-300">Native audio</span>
      <span>, </span>
      <span className="text-[#6f58f6] dark:text-violet-300">multi-shot continuity</span>
      <span>, and </span>
      <span className="text-[#2468ff] dark:text-blue-300">reference-guided</span>
      <span> video for polished ads, launches and cinematic branded content.</span>
    </>
  );
}

type ModelDecisionHeroSectionProps = {
  decision: ModelDecisionData;
  localizeModelsPath: (targetSlug?: string) => string;
  resolvedBreadcrumb: { models: string };
  breadcrumbModelLabel: string;
  heroMedia: FeaturedMedia;
  locale: AppLocale;
  audioBadgeLabel: string;
  mediaAltContext: string;
};

export function ModelDecisionHeroSection({
  decision,
  localizeModelsPath,
  resolvedBreadcrumb,
  breadcrumbModelLabel,
  heroMedia,
  locale,
  audioBadgeLabel,
  mediaAltContext,
}: ModelDecisionHeroSectionProps) {
  const homeCrumb = HOME_CRUMB[locale] ?? HOME_CRUMB.en;

  return (
    <div id="top" className="space-y-7">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-[#5d6b82] dark:text-white/60">
        <Link href={homeCrumb.href} className="font-medium transition hover:text-[#071126] dark:hover:text-white">
          {homeCrumb.label}
        </Link>
        <span aria-hidden className="text-text-muted dark:text-white/30">
          /
        </span>
        <Link href={localizeModelsPath()} className="font-medium transition hover:text-[#071126] dark:hover:text-white">
          {resolvedBreadcrumb.models}
        </Link>
        <span aria-hidden className="text-text-muted dark:text-white/30">
          /
        </span>
        <span className="font-semibold text-[#41516c] dark:text-white/75">{breadcrumbModelLabel}</span>
      </nav>

      <section className="space-y-8">
        <div className="grid gap-9 lg:grid-cols-[minmax(420px,0.86fr)_minmax(560px,1.14fr)] lg:items-center xl:gap-12">
          <div className="space-y-6">
            <div className="space-y-5">
              <p className="inline-flex rounded-full bg-[#edf3ff] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#2f63f6] dark:border dark:border-white/10 dark:bg-white/[0.055] dark:text-cyan-200">
                {decision.hero.eyebrow}
              </p>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] text-[#071126] dark:text-white sm:text-6xl lg:text-[72px]">
                  {decision.hero.title}
                </h1>
                <p className="max-w-3xl text-[22px] font-semibold leading-[1.28] text-[#273654] dark:text-white/90 sm:text-[25px]">
                  {renderHeroSubtitle(decision.hero.subtitle, locale)}
                </p>
              </div>
              <p className="max-w-2xl text-[15px] leading-7 text-[#42516c] dark:text-white/70 sm:text-base">{decision.hero.paragraph}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={decision.hero.primaryCta.href}
                className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[10px] bg-[#071126] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(7,17,38,0.18)] transition hover:bg-[#122340] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:bg-white dark:text-[#071126] dark:hover:bg-white/90"
              >
                <UIIcon icon={Sparkles} size={17} />
                <span>{decision.hero.primaryCta.label}</span>
                <UIIcon icon={ArrowRight} size={15} />
              </Link>
              <Link
                href={decision.hero.secondaryCta.href}
                className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[10px] border border-[#d8e0ec] bg-white px-6 py-3 text-sm font-semibold text-[#071126] shadow-[0_10px_28px_rgba(15,23,42,0.07)] transition hover:border-[#b8c6db] hover:bg-[#fbfdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:border-white/12 dark:bg-white/[0.055] dark:text-white dark:hover:bg-white/[0.085]"
              >
                <UIIcon icon={PlayCircle} size={18} />
                <span>{decision.hero.secondaryCta.label}</span>
                <UIIcon icon={ArrowRight} size={16} />
              </Link>
            </div>

            {decision.hero.quickLinks.length ? (
              <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm">
                {decision.hero.quickLinks.map((link, index) => {
                  const Icon = QUICK_LINK_ICONS[index] ?? ArrowRight;
                  return (
                  <Link
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    className="inline-flex items-center gap-2 font-medium text-[#52627a] transition hover:text-[#071126] dark:text-white/60 dark:hover:text-white"
                  >
                    <UIIcon icon={Icon} size={16} strokeWidth={1.9} />
                    <span>{link.label}</span>
                    <UIIcon icon={ArrowRight} size={13} />
                  </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="lg:-mr-2 xl:-mr-4">
            <ModelDecisionMediaCard
              media={heroMedia}
              label={decision.media.caption}
              description={decision.media.description}
              badges={decision.media.badges}
              locale={locale}
              audioBadgeLabel={audioBadgeLabel}
              renderLinkLabel={decision.media.renderLabel}
              altContext={mediaAltContext || decision.media.altContext}
            />
          </div>
        </div>

        <div className="grid overflow-hidden rounded-[24px] border border-[#dce4f0] bg-white shadow-[0_18px_52px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_24px_70px_rgba(0,0,0,0.30)] sm:grid-cols-2 lg:grid-cols-6">
          {decision.features.map((feature) => {
            const Icon = FEATURE_ICON_MAP[feature.tone];
            const tone = FEATURE_TONE_STYLES[feature.tone];
            return (
              <div key={feature.title} className="flex gap-3 p-4 lg:border-l lg:border-[#e2e8f3] lg:first:border-l-0 dark:lg:border-white/10">
                <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}>
                  <UIIcon icon={Icon} size={20} strokeWidth={1.9} className={tone.icon} />
                </div>
                <div>
                  <h2 className="!text-left text-sm font-semibold leading-tight text-[#071126] dark:text-white">{feature.title}</h2>
                  <p className="mt-1 text-xs leading-5 text-[#52627a] dark:text-white/60">{feature.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
