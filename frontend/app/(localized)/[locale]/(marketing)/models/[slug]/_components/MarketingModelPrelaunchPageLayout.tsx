import {
  ArrowRight,
  BadgeCheck,
  CircleDashed,
  ExternalLink,
  FileCheck2,
  Film,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { UIIcon } from '@/components/ui/UIIcon';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';

import { serializeJsonLd } from '../../model-jsonld';
import type { DetailCopy } from '../_lib/model-page-copy';
import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_MUTED, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';
import type { ModelPrelaunchContent } from '../_lib/model-page-prelaunch-content';
import { buildModelPrelaunchSchemaPayloads } from '../_lib/model-page-prelaunch-schema';
import type { ModelPageTemplateConfig } from '../_lib/model-page-template-types';
import { ModelPageToc } from './ModelPageToc';

const HOME_CRUMB: Record<AppLocale, { label: string; href: LocalizedLinkHref }> = {
  en: { label: 'Home', href: '/' },
  fr: { label: 'Accueil', href: '/fr' },
  es: { label: 'Inicio', href: '/es' },
};

const STATUS_ICON = {
  announced: BadgeCheck,
  highlight: Sparkles,
  comingSoon: CircleDashed,
} as const;

const STATUS_TONE = {
  announced: 'bg-cyan-50 text-cyan-800 ring-cyan-200 dark:bg-cyan-300/10 dark:text-cyan-200 dark:ring-cyan-300/20',
  highlight: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-300/10 dark:text-blue-200 dark:ring-blue-300/20',
  comingSoon: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-300/10 dark:text-violet-200 dark:ring-violet-300/20',
} as const;

const CAPABILITY_ICONS = [Film, Sparkles, CircleDashed, FileCheck2, PlayCircle, ShieldCheck] as const;

function SectionHeading({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-3 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f63f6] dark:text-cyan-200">
        {eyebrow}
      </p>
      <h2 className="text-3xl font-semibold tracking-tight text-[#071126] dark:text-white sm:text-4xl">
        {title}
      </h2>
      <p className="text-[15px] leading-7 text-[#52627a] dark:text-white/70 sm:text-base">
        {intro}
      </p>
    </div>
  );
}

export function MarketingModelPrelaunchPageLayout({
  content,
  template,
  locale,
  canonicalUrl,
  localizedModelsPath,
  localizedModelsUrl,
  localizedHomeUrl,
  breadcrumb,
}: {
  content: ModelPrelaunchContent;
  template: ModelPageTemplateConfig;
  locale: AppLocale;
  canonicalUrl: string;
  localizedModelsPath: string;
  localizedModelsUrl: string;
  localizedHomeUrl: string;
  breadcrumb: DetailCopy['breadcrumb'];
}) {
  if (template.intent !== 'prelaunch' || template.pricing.enabled !== false) {
    throw new Error(`Invalid prelaunch template for ${template.slug}`);
  }

  const homeCrumb = HOME_CRUMB[locale] ?? HOME_CRUMB.en;
  const labels = content.custom.prelaunch.labels;
  const canonical = canonicalUrl.replace(/\/+$/, '') || canonicalUrl;
  const schemaPayloads = buildModelPrelaunchSchemaPayloads({
    canonicalUrl: canonical,
    description: content.seo.description,
    inLanguage: localeRegions[locale] ?? 'en-US',
    modelName: content.marketingName,
    homeLabel: homeCrumb.label,
    homeUrl: localizedHomeUrl,
    modelsLabel: breadcrumb.models,
    modelsUrl: localizedModelsUrl,
  });
  const primaryCtaHref = content.hero.ctaPrimary.href as LocalizedLinkHref;
  const secondaryCta = content.hero.secondaryLinks[0];
  const secondaryCtaHref = secondaryCta.href as LocalizedLinkHref;

  return (
    <>
      {schemaPayloads.map((schema, index) => (
        <script
          key={`prelaunch-schema-${index}`}
          id={`model-prelaunch-jsonld-${index}`}
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}

      <div className="container-page model-page max-w-[1400px] overflow-x-clip pb-0 pt-5 sm:pt-7">
        <div className="space-y-5">
          <div id="top" className="space-y-7">
            <nav className="flex flex-wrap items-center gap-2 text-sm text-[#5d6b82] dark:text-white/60">
              <Link
                href={homeCrumb.href}
                prefetch={false}
                className="font-medium transition hover:text-[#071126] dark:hover:text-white"
              >
                {homeCrumb.label}
              </Link>
              <span aria-hidden className="text-text-muted dark:text-white/30">/</span>
              <Link
                href={localizedModelsPath as LocalizedLinkHref}
                prefetch={false}
                className="font-medium transition hover:text-[#071126] dark:hover:text-white"
              >
                {breadcrumb.models}
              </Link>
              <span aria-hidden className="text-text-muted dark:text-white/30">/</span>
              <span className="font-semibold text-[#41516c] dark:text-white/75">
                {content.marketingName}
              </span>
            </nav>

            <section className="space-y-8">
              <div className="grid gap-9 lg:grid-cols-[minmax(440px,0.9fr)_minmax(0,1.1fr)] lg:items-center xl:gap-12">
                <div className="space-y-6">
                  <div className="space-y-5">
                    <p className="inline-flex rounded-full bg-[#edf3ff] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#2f63f6] dark:border dark:border-white/10 dark:bg-white/[0.055] dark:text-cyan-200">
                      {content.hero.badge}
                    </p>
                    <div className="space-y-3">
                      <h1 className="max-w-3xl text-[clamp(3.05rem,9vw,3.55rem)] font-semibold leading-[0.98] text-[#071126] dark:text-white sm:text-[clamp(3.35rem,7.2vw,3.9rem)] lg:text-[clamp(3.1rem,4.1vw,3.45rem)] xl:text-[clamp(3.15rem,4vw,3.5rem)]">
                        {content.hero.title}
                      </h1>
                      <p className="max-w-3xl text-[22px] font-semibold leading-[1.28] text-[#273654] dark:text-white/90 sm:text-[25px]">
                        {content.overview}
                      </p>
                    </div>
                    <p className="max-w-2xl text-[15px] leading-7 text-[#42516c] dark:text-white/70 sm:text-base">
                      {content.hero.intro}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={primaryCtaHref}
                      prefetch={false}
                      className="inline-flex min-h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-[#071126] px-5 py-3 text-[0.84rem] font-semibold text-white shadow-[0_16px_34px_rgba(7,17,38,0.18)] transition hover:bg-[#122340] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:bg-white dark:text-[#071126] dark:hover:bg-white/90 sm:px-6 sm:text-sm"
                    >
                      <UIIcon icon={Sparkles} size={17} />
                      <span>{content.hero.ctaPrimary.label}</span>
                      <UIIcon icon={ArrowRight} size={15} />
                    </Link>
                    <Link
                      href={secondaryCtaHref}
                      prefetch={false}
                      className="inline-flex min-h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-[#d8e0ec] bg-white px-5 py-3 text-[0.84rem] font-semibold text-[#071126] shadow-[0_10px_28px_rgba(15,23,42,0.07)] transition hover:border-[#b8c6db] hover:bg-[#fbfdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:hover:bg-white/[0.085] sm:px-6 sm:text-sm"
                    >
                      <UIIcon icon={PlayCircle} size={18} />
                      <span>{secondaryCta.label}</span>
                      <UIIcon icon={ArrowRight} size={16} />
                    </Link>
                  </div>
                </div>

                <div className="lg:-mr-2 xl:-mr-4">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-[26px] border border-white/10 bg-[#071126] shadow-[0_30px_90px_rgba(7,17,38,0.28)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(95,124,255,0.82),transparent_38%),radial-gradient(circle_at_86%_82%,rgba(37,214,229,0.42),transparent_34%),linear-gradient(135deg,#071126_0%,#10265b_58%,#17317b_100%)]" />
                    <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:48px_48px]" />
                    <div className="absolute -right-12 top-14 h-72 w-72 rounded-full border border-white/15" />
                    <div className="absolute right-10 top-28 h-44 w-44 rounded-full border border-cyan-200/20" />
                    <div className="relative flex h-full flex-col justify-between p-6 sm:p-8">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15 backdrop-blur">
                          <span className="h-2 w-2 rounded-full bg-cyan-300" />
                          {content.custom.prelaunch.statusItems[1].value}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">
                          MaxVideoAI
                        </span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">
                          Seedance
                        </p>
                        <p className="text-[clamp(5rem,15vw,9rem)] font-semibold leading-[0.72] tracking-[-0.08em] text-white/95">
                          2.5
                        </p>
                        <p className="max-w-md pt-5 text-sm leading-6 text-white/70 sm:text-base">
                          {content.custom.prelaunch.statusItems[2].detail}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid overflow-hidden rounded-[24px] border border-[#dce4f0] bg-white shadow-[0_18px_52px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_24px_70px_rgba(0,0,0,0.30)] lg:grid-cols-3">
                {content.custom.prelaunch.statusItems.map((item, index) => {
                  const Icon = STATUS_ICON[item.state];
                  return (
                    <article
                      key={item.label}
                      className={[
                        'flex gap-3 p-5 sm:p-6',
                        index > 0 ? 'border-t border-[#e2e8f3] dark:border-white/10 lg:border-l lg:border-t-0' : '',
                      ].join(' ')}
                    >
                      <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${STATUS_TONE[item.state]}`}>
                        <UIIcon icon={Icon} size={19} strokeWidth={1.9} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#718098] dark:text-white/50">
                          {item.label}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-[#071126] dark:text-white">{item.value}</p>
                        <p className="mt-2 text-sm leading-6 text-[#52627a] dark:text-white/60">{item.detail}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <ModelPageToc
            variant="pill"
            overviewLabel={labels.statusEyebrow}
            items={[
              { id: 'announcements', label: labels.claimsEyebrow },
              { id: 'faq', label: labels.faqTitle },
            ]}
          />

          <section id="announcements" className="scroll-mt-32 space-y-8 py-14 sm:py-20">
            <SectionHeading
              eyebrow={labels.claimsEyebrow}
              title={labels.claimsTitle}
              intro={labels.claimsIntro}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {content.custom.prelaunch.announcedCapabilities.map((item, index) => {
                const Icon = CAPABILITY_ICONS[index] ?? Sparkles;
                return (
                  <article
                    key={item.title}
                    className="rounded-[22px] border border-[#dce4f0] bg-white p-5 shadow-[0_14px_38px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.045] sm:p-6"
                  >
                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${MODEL_PAGE_ICON_WRAP}`}>
                      <UIIcon icon={Icon} size={21} strokeWidth={1.85} className={MODEL_PAGE_ICON} />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-[#071126] dark:text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#52627a] dark:text-white/60">{item.body}</p>
                  </article>
                );
              })}
            </div>
            <div className="flex flex-col gap-4 rounded-[22px] border border-blue-200/70 bg-blue-50/70 p-5 dark:border-cyan-200/15 dark:bg-cyan-200/[0.06] sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-start gap-3">
                <UIIcon icon={ExternalLink} size={20} className="mt-0.5 shrink-0 text-[#2f63f6] dark:text-cyan-200" />
                <div>
                  <p className="font-semibold text-[#071126] dark:text-white">{labels.sourceLabel}</p>
                  <p className="mt-1 text-sm text-[#52627a] dark:text-white/60">{labels.checkedLabel}</p>
                </div>
              </div>
              <a
                href={content.custom.prelaunch.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#2f63f6] transition hover:text-[#194ed0] dark:text-cyan-200 dark:hover:text-cyan-100"
              >
                Dreamina
                <UIIcon icon={ArrowRight} size={15} className={MODEL_PAGE_ICON_MUTED} />
              </a>
            </div>
          </section>

          <section className="py-14 sm:py-20">
            <div className="grid overflow-hidden rounded-[28px] bg-[#071126] shadow-[0_28px_80px_rgba(7,17,38,0.22)] lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4 p-7 sm:p-10 lg:p-12">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                  {labels.alternativesEyebrow}
                </p>
                <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {labels.alternativesTitle}
                </h2>
                <p className="max-w-2xl text-[15px] leading-7 text-white/70 sm:text-base">
                  {labels.alternativesIntro}
                </p>
              </div>
              <div className="flex flex-col justify-center gap-3 border-t border-white/10 bg-white/[0.055] p-7 sm:p-10 lg:border-l lg:border-t-0">
                <Link
                  href={primaryCtaHref}
                  prefetch={false}
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[10px] bg-white px-5 py-3 text-sm font-semibold text-[#071126] transition hover:bg-white/90"
                >
                  {content.hero.ctaPrimary.label}
                  <UIIcon icon={ArrowRight} size={16} />
                </Link>
                <Link
                  href={secondaryCtaHref}
                  prefetch={false}
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                >
                  {secondaryCta.label}
                  <UIIcon icon={ArrowRight} size={16} />
                </Link>
              </div>
            </div>
          </section>

          <section id="faq" className="scroll-mt-32 space-y-8 pb-20 pt-4">
            <SectionHeading
              eyebrow={labels.faqEyebrow}
              title={labels.faqTitle}
              intro={content.seo.description}
            />
            <div className="mx-auto max-w-4xl divide-y divide-[#dce4f0] overflow-hidden rounded-[24px] border border-[#dce4f0] bg-white shadow-[0_18px_52px_rgba(15,23,42,0.07)] dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.045]">
              {content.faqs.map((faq) => (
                <details key={faq.question} className="group px-5 py-1 sm:px-7">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-left font-semibold text-[#071126] marker:hidden dark:text-white">
                    <span>{faq.question}</span>
                    <span className="text-xl font-normal text-[#718098] transition group-open:rotate-45 dark:text-white/50">+</span>
                  </summary>
                  <p className="max-w-3xl pb-6 text-sm leading-7 text-[#52627a] dark:text-white/60 sm:text-[15px]">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
