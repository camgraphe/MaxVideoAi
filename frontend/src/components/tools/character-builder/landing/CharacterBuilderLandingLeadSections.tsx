import Image from 'next/image';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  COMPARISON_STYLES,
  LATEST_SHEET_1,
  REFERENCE_ASSET_PORTRAIT_URL,
  SHEET_IMAGE_CLASSNAME,
  type CharacterBuilderLandingContent,
} from './character-builder-landing-assets';
import {
  HeroProofCard,
  HeroScreenshotPreview,
  HowItWorksPill,
  SectionHeader,
} from './CharacterBuilderLandingPrimitives';

export function CharacterBuilderHeroSection({ content }: { content: CharacterBuilderLandingContent }) {
  return (
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
  );
}

export function CharacterBuilderWhySection({ content }: { content: CharacterBuilderLandingContent }) {
  return (
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
  );
}

export function CharacterBuilderHowItWorksSection({ content }: { content: CharacterBuilderLandingContent }) {
  return (
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
  );
}
