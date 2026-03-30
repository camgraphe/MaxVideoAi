import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n/types';
import { Link } from '@/i18n/navigation';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const REFERENCE_ASSET_PORTRAIT_URL =
  'https://v3b.fal.media/files/b/0a9354bf/6jswQE7mDfBZzcMI6j1hD_AQ2sXgYY.png';

const LATEST_CHARACTER_SHEET_ASSETS = [
  {
    url: 'https://v3b.fal.media/files/b/0a935305/aYrWen8QnYME2LcBPZ33t_w1WcVklb.png',
    alt: 'Recent Character Builder character sheet render showing four full-body angles and four matching close-ups.',
  },
  {
    url: 'https://v3b.fal.media/files/b/0a9352f9/DfeXOJDDOofcJnA_koAKi_ebpLqdWt.png',
    alt: 'Recent coherent character sheet render from MaxVideoAI with multi-angle full-body views and close-ups.',
  },
  {
    url: 'https://v3b.fal.media/files/b/0a9352ee/98KpFe5eSj8ZPHg_DosEg_8ZnLNqP7.png',
    alt: 'Recent MaxVideoAI character sheet render combining four body angles and four close-up identity views.',
  },
  {
    url: 'https://v3b.fal.media/files/b/0a9352e7/vPTrpWNZxJdPCTfIY-wBN_6P7khp0V.png',
    alt: 'Recent reusable character sheet render with stable face, outfit, and silhouette across eight panels.',
  },
] as const;

const [LATEST_SHEET_1, , , LATEST_SHEET_4] = LATEST_CHARACTER_SHEET_ASSETS;

const WORKFLOW_CHARACTER_SHEET_ASSET = {
  url: 'https://v3b.fal.media/files/b/0a935305/aYrWen8QnYME2LcBPZ33t_w1WcVklb.png',
  alt: 'Character Builder sheet used as the reusable reference asset across images and video workflows.',
} as const;
const WORKFLOW_NANO_BANANA_ASSET = {
  url: 'https://v3b.fal.media/files/b/0a93538e/6K9vhOS91LPzVB5aEP9MV_gKcs9ukw.jpg',
  alt: 'Nano Banana still created from the same character sheet reference.',
} as const;
const WORKFLOW_VIDEO_START_FRAME_ASSET = {
  videoUrl: 'https://v3b.fal.media/files/b/0a93539e/DZA2waBj2_15D3zXsFkw3_9yIv4OrO.mp4',
  url: 'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/355c847c-7866-43b9-af28-85d6a64dfec8.jpg',
  alt: 'Video start frame generated from the Nano Banana still and the same character identity.',
} as const;
const COMICS_PREVIZ_USE_CASE_ASSET = {
  url: 'https://v3b.fal.media/files/b/0a93550f/Ikc271a5TYieq_7qBQuVk_4KrRepo5.png',
  alt: 'Reusable character reference prepared for comics panels and animation previz.',
} as const;
const MASCOT_USE_CASE_ASSET = {
  url: 'https://v3b.fal.media/files/b/0a93562e/5o1aO2LCroDg-PWioialv_ujZx2Wou.png',
  alt: 'Brand mascot prepared as a reusable consistent character asset.',
} as const;

const CHARACTER_WORKSPACE_HERO_PATH = '/assets/tools/character-builder-workspace.png?hero=1';
const SHEET_IMAGE_CLASSNAME = 'object-cover object-center scale-[1.08]';

type CharacterBuilderLandingContent = Dictionary['toolMarketing']['characterBuilder'];

const COMPARISON_STYLES = [
  {
    tone: 'character-builder-comparison character-builder-comparison--negative border-rose-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,245,245,0.96))]',
    badgeTone: 'bg-rose-100 text-rose-700',
  },
  {
    tone: 'character-builder-comparison character-builder-comparison--positive border-emerald-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,253,245,0.96))]',
    badgeTone: 'bg-emerald-100 text-emerald-700',
  },
] as const;

const USE_CASE_VISUALS = [
  {
    src: WORKFLOW_VIDEO_START_FRAME_ASSET.url,
    imageClassName: 'object-cover object-center',
    cardClassName: 'border-slate-800 bg-[linear-gradient(135deg,#0b1320,#162235)] text-white shadow-[0_32px_90px_rgba(15,23,42,0.18)]',
    labelClassName: 'border-white/10 bg-white/5 text-slate-200',
    bodyClassName: 'text-slate-300',
  },
  {
    src: REFERENCE_ASSET_PORTRAIT_URL,
    imageClassName: 'object-cover object-[center_18%]',
    cardClassName:
      'character-builder-usecase-card border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,241,236,0.96))]',
    labelClassName: 'character-builder-usecase-label border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
  {
    src: MASCOT_USE_CASE_ASSET.url,
    imageClassName: SHEET_IMAGE_CLASSNAME,
    cardClassName:
      'character-builder-usecase-card border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,246,238,0.96))]',
    labelClassName: 'character-builder-usecase-label border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
  {
    src: 'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/8b29c715-842e-473c-a0d3-5ce8d6d6857f.webp',
    imageClassName: 'object-cover object-center',
    cardClassName:
      'character-builder-usecase-card border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,246,251,0.96))]',
    labelClassName: 'character-builder-usecase-label border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
  {
    src: COMICS_PREVIZ_USE_CASE_ASSET.url,
    imageClassName: SHEET_IMAGE_CLASSNAME,
    cardClassName:
      'character-builder-usecase-card border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,245,250,0.96))]',
    labelClassName: 'character-builder-usecase-label border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
] as const;

function serializeJsonLd(data: object) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function SectionHeader({
  eyebrow,
  title,
  body,
  light = false,
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
  light?: boolean;
}) {
  return (
    <div className="max-w-3xl stack-gap-sm">
      <div
        className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
          light
            ? 'border-white/12 bg-white/6 text-slate-200'
            : 'border-hairline bg-surface text-text-muted shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
        }`}
      >
        {eyebrow}
      </div>
      <h2
        className={`text-3xl font-semibold tracking-tight sm:text-4xl ${
          light ? 'text-white' : 'text-text-primary'
        }`}
      >
        {title}
      </h2>
      <div className={`text-sm leading-7 sm:text-base ${light ? 'text-slate-300' : 'text-text-secondary'}`}>{body}</div>
    </div>
  );
}

function LinkChip({
  href,
  label,
  dark = false,
}: {
  href: string;
  label: string;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
        dark
          ? 'border-white/12 bg-white/6 text-white hover:border-white/20 hover:bg-white/10'
          : 'border-hairline bg-surface text-text-primary hover:border-border-hover hover:bg-surface-hover'
      }`}
    >
      {label}
    </Link>
  );
}

function HeroProofCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-hairline/90 bg-surface/90 px-4 py-3 text-sm leading-6 text-text-primary shadow-[0_18px_42px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <span className="text-text-secondary">{children}</span>
      </div>
    </div>
  );
}

function HeroScreenshotPreview({ content }: { content: CharacterBuilderLandingContent['hero']['showcase'] }) {
  return (
    <div className="overflow-hidden rounded-t-[34px] rounded-b-[30px] border border-slate-900/12 bg-[linear-gradient(180deg,#07101b,#0d1b2d)] text-white shadow-[0_36px_120px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-end gap-3 border-b border-white/10 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 sm:px-6">
        <span>{content.topLabel}</span>
      </div>
      <div className="bg-[#e9eef5] p-4 sm:p-5">
        <div className="overflow-hidden rounded-[28px] border border-slate-300/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-1.5 border-b border-slate-300/70 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{content.windowLabel}</span>
          </div>
          <div className="relative aspect-[16/9] bg-[#eef3f9]">
            <Image
              src={CHARACTER_WORKSPACE_HERO_PATH}
              alt={content.imageAlt}
              fill
              priority
              sizes="(max-width: 1440px) 100vw, 1320px"
              className="object-cover object-[center_12%]"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-px bg-white/10 md:grid-cols-3">
        {content.callouts.map((item) => (
          <div key={item.label} className="bg-[rgba(7,13,21,0.92)] px-5 py-4 sm:px-6 sm:py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
            <p className="mt-2 text-base font-semibold text-white">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorksPill({ children }: { children: ReactNode }) {
  return (
    <span className="character-builder-pill inline-flex items-center rounded-full border border-hairline bg-white/80 px-3 py-2 text-sm text-text-secondary shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      {children}
    </span>
  );
}

export function CharacterBuilderLandingPage({ content }: { content: CharacterBuilderLandingContent }) {
  const canonicalUrl = 'https://maxvideoai.com/tools/character-builder';
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: content.breadcrumb.home,
        item: 'https://maxvideoai.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: content.breadcrumb.tools,
        item: 'https://maxvideoai.com/tools',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: content.breadcrumb.current,
        item: canonicalUrl,
      },
    ],
  };

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': ['SoftwareApplication', 'WebApplication'],
    name: content.meta.schemaName,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: canonicalUrl,
    description: content.meta.schemaDescription,
    featureList: content.meta.schemaFeatures,
    isPartOf: {
      '@type': 'WebSite',
      name: 'MaxVideoAI',
      url: 'https://maxvideoai.com',
    },
  };

  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: content.meta.howToTitle,
    description: content.meta.howToDescription,
    step: content.howItWorks.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.body,
      url: `${canonicalUrl}#step-${index + 1}`,
    })),
  };
  const portraitOutputCard = content.outputsWorkflow.cards[0]!;
  const sheetOutputCard = content.outputsWorkflow.cards[1]!;
  const videoPrepOutputCard = content.outputsWorkflow.cards[2]!;
  const portraitOutputPill = portraitOutputCard.pills[0]!;
  const videoPrepOutputPill = videoPrepOutputCard.pills[0]!;
  const workflowSheetStep = content.outputsWorkflow.workflow.steps[0]!;
  const workflowStillStep = content.outputsWorkflow.workflow.steps[1]!;
  const workflowVideoStep = content.outputsWorkflow.workflow.steps[2]!;
  const primaryUseCase = content.useCases.items[0]!;
  const secondaryUseCase = content.useCases.items[1]!;

  return (
    <div className="character-builder-page">
      <section className="tool-hero-surface character-builder-hero relative overflow-hidden border-b border-hairline bg-[radial-gradient(circle_at_top_left,rgba(244,127,94,0.12),transparent_28%),radial-gradient(circle_at_right,rgba(76,132,255,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))]">
        <div className="container-page relative max-w-[88rem] pb-10 pt-8 sm:pb-12 sm:pt-10 lg:pb-12 lg:pt-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-start lg:gap-12">
            <div className="max-w-4xl stack-gap-lg lg:pt-6">
              <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
                <Link href="/" className="transition hover:text-text-primary">
                  {content.breadcrumb.home}
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link href="/tools" className="transition hover:text-text-primary">
                  {content.breadcrumb.tools}
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-semibold text-text-secondary">{content.breadcrumb.current}</span>
              </nav>

              <div className="flex flex-wrap items-center gap-3">
                <div className="tool-hero-pill inline-flex w-fit items-center rounded-full border border-slate-200/90 bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
                  {content.hero.badge}
                </div>
                <div className="tool-hero-pill tool-hero-pill--accent inline-flex w-fit items-center rounded-full border border-[#e6b99b] bg-[#fff3ea] px-4 py-2 text-[11px] font-semibold text-[#a55a31] shadow-[0_14px_28px_rgba(244,127,94,0.08)]">
                  {content.hero.secondaryBadge}
                </div>
              </div>

              <div className="stack-gap-sm">
                <h1 className="max-w-[13ch] text-[clamp(3rem,5vw,4.8rem)] font-semibold leading-[0.92] tracking-[-0.05em] text-text-primary">
                  {content.hero.title}
                </h1>
                <p className="max-w-2xl text-[1.02rem] leading-8 text-text-secondary sm:text-lg">{content.hero.body}</p>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <ButtonLink
                  href="/app/tools/character-builder"
                  linkComponent={Link}
                  size="lg"
                  data-analytics-event="tool_cta_click"
                  data-analytics-cta-name="character_builder_try_tool_hero"
                  data-analytics-cta-location="tool_character_builder_hero"
                  data-analytics-tool-name="character_builder"
                  data-analytics-tool-surface="public"
                  data-analytics-target-family="app_tools"
                >
                  {content.hero.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </div>

              <div className="grid gap-3 xl:max-w-[40rem]">
                {content.hero.proofs.map((item) => (
                  <HeroProofCard key={item}>{item}</HeroProofCard>
                ))}
              </div>
            </div>

            <div className="lg:pt-12 xl:pt-14">
              <HeroScreenshotPreview content={content.hero.showcase} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl">
          <div className="character-builder-panel overflow-hidden rounded-[34px] border border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,251,254,0.96))] shadow-[0_28px_80px_rgba(15,23,42,0.05)]">
            <div className="grid lg:grid-cols-[minmax(0,0.76fr)_minmax(0,1.24fr)]">
              <div className="border-b border-white/10 bg-[linear-gradient(180deg,#0a1320,#101d2d)] px-6 py-6 text-white lg:border-b-0 lg:border-r lg:border-r-white/10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{content.why.problemLabel}</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">{content.why.problemTitle}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-300">{content.why.problemBody}</p>
                <div className="mt-5 grid gap-3">
                  {content.why.problemItems.map((item) => (
                    <div key={item} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{content.why.solutionLabel}</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">{content.why.solutionTitle}</h2>
                <div className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary">
                  <p>{content.why.solutionBody}</p>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">{content.why.portraitInputLabel}</p>
                    <div className="tool-image-matte tool-image-matte--warm relative aspect-[16/11] overflow-hidden rounded-[24px] border border-hairline bg-[#f6efe8]">
                      <Image
                        src={REFERENCE_ASSET_PORTRAIT_URL}
                        alt={content.why.portraitInputAlt}
                        fill
                        sizes="(min-width: 640px) 320px, 100vw"
                        className="object-cover object-[center_18%]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">{content.why.sheetLabel}</p>
                    <div className="tool-image-matte tool-image-matte--warm relative aspect-[16/11] overflow-hidden rounded-[24px] border border-hairline bg-[#f8f2ea]">
                      <Image
                        src={LATEST_SHEET_1.url}
                        alt={content.why.sheetAlt}
                        fill
                        sizes="(min-width: 640px) 320px, 100vw"
                        className={SHEET_IMAGE_CLASSNAME}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader eyebrow={content.howItWorks.eyebrow} title={content.howItWorks.title} body={<p>{content.howItWorks.body}</p>} />
          <div className="character-builder-panel-soft rounded-[32px] border border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,251,254,0.96))] p-4 shadow-[0_22px_56px_rgba(15,23,42,0.05)] sm:p-5 lg:p-6">
            <div className="grid gap-3 lg:grid-cols-3">
              {content.howItWorks.steps.map((step, index) => (
                <div
                  key={step.title}
                  id={`step-${index + 1}`}
                  className="character-builder-step-card rounded-[24px] border border-hairline bg-white px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                        index === 0
                          ? 'bg-[#f97316]/10 text-[#c45b2d]'
                          : index === 1
                            ? 'bg-brand/10 text-brand'
                            : 'bg-[#4c84ff]/10 text-[#3564cc]'
                      }`}
                    >
                      {(index + 1).toString().padStart(2, '0')}
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{step.stepLabel}</p>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold leading-tight text-text-primary">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{step.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {step.pills.map((item) => (
                      <HowItWorksPill key={item}>{item}</HowItWorksPill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 border-t border-hairline pt-4 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              <div className="max-w-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{content.howItWorks.comparisonLabel}</p>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{content.howItWorks.comparisonBody}</p>
              </div>
              {content.howItWorks.comparisons.map((column, index) => (
                <Card key={column.title} className={`overflow-hidden p-0 ${COMPARISON_STYLES[index].tone}`}>
                  <div className="border-b border-current/10 px-4 py-3">
                    <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${COMPARISON_STYLES[index].badgeTone}`}>
                      {column.eyebrow}
                    </div>
                    <h3 className="mt-2 text-base font-semibold tracking-tight text-text-primary">{column.title}</h3>
                  </div>
                  <div className="grid gap-2 px-4 py-3">
                    {column.items.map((item) => (
                      <div key={item} className="character-builder-inline-chip rounded-[16px] border border-hairline bg-white/80 px-4 py-2 text-sm leading-6 text-text-secondary">
                        {item}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow={content.outputsWorkflow.eyebrow}
            title={content.outputsWorkflow.title}
            body={<p>{content.outputsWorkflow.body}</p>}
          />
          <div className="character-builder-panel-soft rounded-[34px] border border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,252,0.96))] p-4 shadow-[0_28px_80px_rgba(15,23,42,0.05)] sm:p-5 lg:p-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)_minmax(0,0.96fr)] lg:items-stretch">
              <Card className="tool-surface-card overflow-hidden border-hairline bg-white p-0 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
                <div className="p-4">
                  <div className="relative aspect-[4/4.8] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#fff4ec,#ffffff)]">
                    <Image
                      src="https://v3b.fal.media/files/b/0a935655/nJlY0mMASmclDhm6ywMDz_0bzxXv5K.png"
                      alt={portraitOutputCard.imageAlt}
                      fill
                      sizes="(max-width: 1280px) 100vw, 320px"
                      className="object-cover object-center"
                    />
                  </div>
                </div>
                <div className="stack-gap-sm px-5 pb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{portraitOutputCard.eyebrow}</p>
                  <h3 className="text-xl font-semibold text-text-primary">{portraitOutputCard.title}</h3>
                  <p className="text-sm leading-6 text-text-secondary">{portraitOutputCard.body}</p>
                  <div className="pt-1">
                    <HowItWorksPill>{portraitOutputPill}</HowItWorksPill>
                  </div>
                </div>
              </Card>

              <Card className="tool-surface-card tool-surface-card--warm overflow-hidden border-[1.5px] border-[#f1d1bb] bg-[linear-gradient(180deg,#fff8f3,#fffefc)] p-0 shadow-[0_24px_60px_rgba(196,91,45,0.12)]">
                <div className="flex items-center justify-between px-5 pt-5">
                  <div className="inline-flex rounded-full border border-[#f4d8c6] bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b96135]">
                    {sheetOutputCard.badge}
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b96135]">{sheetOutputCard.stats}</span>
                </div>
                <div className="px-5 pb-5 pt-4">
                  <div className="relative aspect-[16/11] overflow-hidden rounded-[24px] bg-[#f7f1ea]">
                    <Image
                      src="https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/5daf21e0-e99a-42e5-891a-eca3ba162344.webp"
                      alt={sheetOutputCard.imageAlt}
                      fill
                      sizes="(max-width: 1280px) 100vw, 480px"
                      className={SHEET_IMAGE_CLASSNAME}
                    />
                  </div>
                </div>
                <div className="stack-gap-sm px-5 pb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{sheetOutputCard.eyebrow}</p>
                  <h3 className="text-2xl font-semibold tracking-tight text-text-primary">{sheetOutputCard.title}</h3>
                  <p className="text-sm leading-6 text-text-secondary">{sheetOutputCard.body}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {sheetOutputCard.pills.map((item) => (
                      <HowItWorksPill key={item}>{item}</HowItWorksPill>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden border-slate-800 bg-[linear-gradient(180deg,#0b1320,#101b2b)] p-0 text-white shadow-[0_26px_64px_rgba(15,23,42,0.16)]">
                <div className="p-4">
                  <div className="relative aspect-[16/11] overflow-hidden rounded-[22px] border border-white/10 bg-black">
                    <Image
                      src="https://v3b.fal.media/files/b/0a935643/1_y_Iw3TbDfMgsI9Kggki_XflHpwqR.jpg"
                      alt={videoPrepOutputCard.imageAlt}
                      fill
                      sizes="(max-width: 1280px) 100vw, 360px"
                      className="object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08111c]/80 via-transparent to-transparent" />
                    <div className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                      {videoPrepOutputCard.badge}
                    </div>
                  </div>
                </div>
                <div className="stack-gap-sm px-5 pb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{videoPrepOutputCard.eyebrow}</p>
                  <h3 className="text-xl font-semibold text-white">{videoPrepOutputCard.title}</h3>
                  <p className="text-sm leading-6 text-slate-300">{videoPrepOutputCard.body}</p>
                  <div className="pt-1">
                    <HowItWorksPill>{videoPrepOutputPill}</HowItWorksPill>
                  </div>
                </div>
              </Card>
            </div>

            <div className="mt-6 rounded-[34px] border border-slate-800 bg-[linear-gradient(180deg,#0a1320,#101d2d)] p-5 text-white shadow-[0_32px_90px_rgba(15,23,42,0.16)] lg:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{content.outputsWorkflow.workflow.label}</p>
                  <p className="mt-2 text-lg font-semibold tracking-[0.1em] text-white">{content.outputsWorkflow.workflow.title}</p>
                </div>
                <p className="text-sm font-semibold tracking-[0.12em] text-slate-200">{content.outputsWorkflow.workflow.chainLabel}</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,0.82fr)_minmax(0,1.36fr)] lg:items-stretch">
                <div className="rounded-[22px] border border-white/10 bg-[#111a28] p-3">
                  <div className="relative aspect-[16/12] overflow-hidden rounded-[18px] bg-[#dfe8f4]">
                    <Image
                      src={WORKFLOW_CHARACTER_SHEET_ASSET.url}
                      alt={workflowSheetStep.imageAlt}
                      fill
                      sizes="(min-width: 1024px) 280px, 100vw"
                      className={SHEET_IMAGE_CLASSNAME}
                    />
                  </div>
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{workflowSheetStep.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{workflowSheetStep.body}</p>
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-[#111a28] p-3">
                  <div className="relative aspect-[16/12] overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_55%),linear-gradient(135deg,rgba(244,127,94,0.26),rgba(76,132,255,0.16))]">
                    <Image
                      src={WORKFLOW_NANO_BANANA_ASSET.url}
                      alt={workflowStillStep.imageAlt}
                      fill
                      sizes="(min-width: 1024px) 280px, 100vw"
                      className="object-cover object-center"
                    />
                  </div>
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{workflowStillStep.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{workflowStillStep.body}</p>
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-[#0f1826] p-3">
                  <div className="overflow-hidden rounded-[18px] border border-white/10 bg-black">
                    <video
                      className="aspect-[16/12] w-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                      poster={WORKFLOW_VIDEO_START_FRAME_ASSET.url}
                    >
                      <source src={WORKFLOW_VIDEO_START_FRAME_ASSET.videoUrl} type="video/mp4" />
                    </video>
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{workflowVideoStep.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{workflowVideoStep.body}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                      {content.outputsWorkflow.workflow.videoBadge}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {content.outputsWorkflow.workflow.links.map((link) => (
                  <LinkChip key={link.href} href={link.href} label={link.label} dark />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader eyebrow={content.useCases.eyebrow} title={content.useCases.title} body={<p>{content.useCases.body}</p>} />
          <div className="grid gap-4 lg:grid-cols-12">
            <Card className={`overflow-hidden p-0 lg:col-span-7 ${USE_CASE_VISUALS[0].cardClassName}`}>
              <div className="grid h-full gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <div className="flex flex-col justify-between p-6 sm:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${USE_CASE_VISUALS[0].labelClassName}`}>
                      {primaryUseCase.eyebrow}
                    </div>
                    <span className="text-sm font-semibold tracking-[0.14em] text-slate-300">{primaryUseCase.number}</span>
                  </div>
                  <div className="mt-10">
                    <h3 className="max-w-md text-3xl font-semibold tracking-tight text-white">{primaryUseCase.title}</h3>
                    <p className={`mt-4 max-w-md text-base leading-8 ${USE_CASE_VISUALS[0].bodyClassName}`}>{primaryUseCase.body}</p>
                  </div>
                </div>
                <div className="relative min-h-[280px] overflow-hidden bg-[#0e1725] lg:min-h-full">
                  <Image
                    src={USE_CASE_VISUALS[0].src}
                    alt={primaryUseCase.imageAlt}
                    fill
                    sizes="(max-width: 1280px) 100vw, 640px"
                    className={USE_CASE_VISUALS[0].imageClassName}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,19,32,0.2),rgba(11,19,32,0)_38%,rgba(11,19,32,0.08))]" />
                </div>
              </div>
            </Card>

            <Card className={`overflow-hidden p-0 lg:col-span-5 ${USE_CASE_VISUALS[1].cardClassName}`}>
              <div className="relative aspect-[4/3] overflow-hidden bg-[#f3ece4]">
                <Image
                  src={USE_CASE_VISUALS[1].src}
                  alt={secondaryUseCase.imageAlt}
                  fill
                  sizes="(max-width: 1280px) 100vw, 480px"
                  className={USE_CASE_VISUALS[1].imageClassName}
                />
              </div>
              <div className="p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${USE_CASE_VISUALS[1].labelClassName}`}>
                    {secondaryUseCase.eyebrow}
                  </div>
                  <span className="text-sm font-semibold tracking-[0.14em] text-brand">{secondaryUseCase.number}</span>
                </div>
                <h3 className="mt-6 text-2xl font-semibold tracking-tight text-text-primary">{secondaryUseCase.title}</h3>
                <p className={`mt-4 text-base leading-8 ${USE_CASE_VISUALS[1].bodyClassName}`}>{secondaryUseCase.body}</p>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            {content.useCases.items.slice(2).map((useCase, index) => {
              const visual = USE_CASE_VISUALS[index + 2]!;
              return (
                <Card key={useCase.title} className={`overflow-hidden p-0 lg:col-span-4 ${visual.cardClassName}`}>
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#f5efe8]">
                    <Image
                      src={visual.src}
                      alt={useCase.imageAlt}
                      fill
                      sizes="(max-width: 1280px) 100vw, 360px"
                      className={visual.imageClassName}
                    />
                  </div>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${visual.labelClassName}`}>
                        {useCase.eyebrow}
                      </div>
                      <span className="text-sm font-semibold tracking-[0.14em] text-brand">{useCase.number}</span>
                    </div>
                    <h3 className="mt-5 text-xl font-semibold tracking-tight text-text-primary">{useCase.title}</h3>
                    <p className={`mt-3 text-sm leading-7 ${visual.bodyClassName}`}>{useCase.body}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader eyebrow={content.related.eyebrow} title={content.related.title} body={<p>{content.related.body}</p>} />
          <div className="grid gap-4">
            <Card className="border-hairline bg-bg/90 p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                {content.related.guidesTitle}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {content.related.guideLinks.map((link) => (
                  <LinkChip key={link.href} href={link.href} label={link.label} />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section halo-workspace-bottom">
        <div className="container-page max-w-6xl">
          <Card className="overflow-hidden border-hairline bg-[linear-gradient(135deg,rgba(8,17,28,0.98),rgba(31,55,82,0.96))] p-0 text-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]">
            <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div className="stack-gap-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{content.finalCta.eyebrow}</p>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{content.finalCta.title}</h2>
                <div className="max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                  <p>{content.finalCta.body}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink
                    href="/app/tools/character-builder"
                    linkComponent={Link}
                    size="lg"
                    className="bg-white text-slate-950 hover:bg-slate-100"
                    data-analytics-event="tool_cta_click"
                    data-analytics-cta-name="character_builder_try_tool_final"
                    data-analytics-cta-location="tool_character_builder_final"
                    data-analytics-tool-name="character_builder"
                    data-analytics-tool-surface="public"
                    data-analytics-target-family="app_tools"
                  >
                    {content.finalCta.primaryCta}
                  </ButtonLink>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4">
                <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  <span>{content.finalCta.panelLeft}</span>
                  <span>{content.finalCta.panelRight}</span>
                </div>
                <div className="relative aspect-[16/11] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#f8f1e9,#fefbf8)]">
                  <Image
                    src={LATEST_SHEET_4.url}
                    alt={content.finalCta.panelAlt}
                    fill
                    sizes="420px"
                    className={SHEET_IMAGE_CLASSNAME}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-4xl stack-gap-lg">
          <SectionHeader eyebrow={content.faq.eyebrow} title={content.faq.title} body={<p>{content.faq.body}</p>} />
          <div className="stack-gap-sm">
            {content.faq.items.map((faq) => (
              <details
                key={faq.question}
                className="rounded-[24px] border border-hairline bg-surface/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.04)]"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-text-primary">{faq.question}</summary>
                <p className="mt-4 text-sm leading-7 text-text-secondary">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <FAQSchema questions={[...content.faq.items]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(howToJsonLd) }} />
    </div>
  );
}
