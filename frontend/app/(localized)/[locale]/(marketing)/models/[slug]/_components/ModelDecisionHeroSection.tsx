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
import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_MUTED, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';
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

const QUICK_LINK_ICONS = [ArrowRightLeft, Tag, PencilLine] as const;

const HOME_CRUMB: Record<AppLocale, { label: string; href: string }> = {
  en: { label: 'Home', href: '/' },
  fr: { label: 'Accueil', href: '/fr' },
  es: { label: 'Inicio', href: '/es' },
};

const HERO_HIGHLIGHT_CLASSES = [
  'text-[#2468ff] dark:text-cyan-300',
  'text-[#2468ff] dark:text-cyan-300',
  'text-[#2468ff] dark:text-blue-300',
] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHeroSubtitle(subtitle: string, highlights: string[]) {
  if (!subtitle.trim()) return subtitle;

  const normalizedHighlights = highlights.map((term) => term.trim()).filter(Boolean);
  if (!normalizedHighlights.length) return subtitle;

  const sortedHighlights = [...normalizedHighlights].sort((left, right) => right.length - left.length);
  const splitPattern = new RegExp(`(${sortedHighlights.map(escapeRegExp).join('|')})`, 'g');
  const highlightIndexByTerm = new Map(normalizedHighlights.map((term, index) => [term, index]));

  return (
    <>
      {subtitle.split(splitPattern).map((part, index) => {
        const highlightIndex = highlightIndexByTerm.get(part);
        if (highlightIndex == null) return part;

        return (
          <span key={`${part}-${index}`} className={HERO_HIGHLIGHT_CLASSES[highlightIndex % HERO_HIGHLIGHT_CLASSES.length]}>
            {part}
          </span>
        );
      })}
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
        <div className="grid gap-9 lg:grid-cols-[minmax(440px,0.9fr)_minmax(0,1.1fr)] lg:items-center xl:gap-12">
          <div className="space-y-6">
            <div className="space-y-5">
              <p className="inline-flex rounded-full bg-[#edf3ff] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#2f63f6] dark:border dark:border-white/10 dark:bg-white/[0.055] dark:text-cyan-200">
                {decision.hero.eyebrow}
              </p>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] text-[#071126] dark:text-white sm:text-6xl lg:whitespace-nowrap lg:text-[clamp(3.75rem,5.2vw,4.35rem)] xl:text-[72px]">
                  {decision.hero.title}
                </h1>
                <p className="max-w-3xl text-[22px] font-semibold leading-[1.28] text-[#273654] dark:text-white/90 sm:text-[25px]">
                  {renderHeroSubtitle(decision.hero.subtitle, decision.hero.subtitleHighlights)}
                </p>
              </div>
              <p className="max-w-2xl text-[15px] leading-7 text-[#42516c] dark:text-white/70 sm:text-base">{decision.hero.paragraph}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={decision.hero.primaryCta.href}
                className="inline-flex min-h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-[#071126] px-5 py-3 text-[0.84rem] font-semibold text-white shadow-[0_16px_34px_rgba(7,17,38,0.18)] transition hover:bg-[#122340] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:bg-white dark:text-[#071126] dark:hover:bg-white/90 sm:px-6 sm:text-sm"
              >
                <UIIcon icon={Sparkles} size={17} />
                <span>{decision.hero.primaryCta.label}</span>
                <UIIcon icon={ArrowRight} size={15} />
              </Link>
              <Link
                href={decision.hero.secondaryCta.href}
                className="inline-flex min-h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-[#d8e0ec] bg-white px-5 py-3 text-[0.84rem] font-semibold text-[#071126] shadow-[0_10px_28px_rgba(15,23,42,0.07)] transition hover:border-[#b8c6db] hover:bg-[#fbfdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:border-white/12 dark:bg-white/[0.055] dark:text-white dark:hover:bg-white/[0.085] sm:px-6 sm:text-sm"
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
                    <UIIcon icon={Icon} size={16} strokeWidth={1.9} className={MODEL_PAGE_ICON_MUTED} />
                    <span>{link.label}</span>
                    <UIIcon icon={ArrowRight} size={13} className={MODEL_PAGE_ICON_MUTED} />
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

        <div className="grid grid-cols-2 overflow-hidden rounded-[24px] border border-[#dce4f0] bg-white shadow-[0_18px_52px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_24px_70px_rgba(0,0,0,0.30)] lg:grid-cols-6">
          {decision.features.map((feature, index) => {
            const Icon = FEATURE_ICON_MAP[feature.tone];
            return (
              <div
                key={feature.title}
                className={[
                  'flex gap-2.5 p-3 sm:gap-3 sm:p-4',
                  index % 2 === 1 ? 'border-l border-[#e2e8f3] dark:border-white/10' : '',
                  index >= 2 ? 'border-t border-[#e2e8f3] dark:border-white/10 lg:border-t-0' : '',
                  index > 0 ? 'lg:border-l lg:border-[#e2e8f3] dark:lg:border-white/10' : 'lg:border-l-0',
                ].join(' ')}
              >
                <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${MODEL_PAGE_ICON_WRAP}`}>
                  <UIIcon icon={Icon} size={19} strokeWidth={1.9} className={MODEL_PAGE_ICON} />
                </div>
                <div>
                  <p className="!text-left text-[0.82rem] font-semibold leading-tight text-[#071126] dark:text-white sm:text-sm">{feature.title}</p>
                  <p className="mt-1 text-[0.72rem] leading-4 text-[#52627a] dark:text-white/60 sm:text-xs sm:leading-5">{feature.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
