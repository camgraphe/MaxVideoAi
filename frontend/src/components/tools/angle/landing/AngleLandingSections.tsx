import Image from 'next/image';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  ANGLE_ALT_THREE_URL,
  ANGLE_LATEST_BATCH_URLS,
  ANGLE_OUTPUT_URL,
  ANGLE_SOURCE_URL,
  ANGLE_STORY_SOURCE_URL,
  ANGLE_WORKSPACE_SCREENSHOT_PATH,
  HOW_IT_WORKS_STEP_STYLES,
  MOBILE_IMAGE_MAX_WIDTH,
  type AngleLandingContent,
  type AngleThumbContent,
} from './angle-landing-assets';
import {
  AngleThumb,
  HeroAngleFlowPanel,
  ProductAngleMock,
  SectionHeader,
  WorkspaceShowcase,
} from './AngleLandingPrimitives';
import { AngleLandingIntentExamplesSection } from './AngleLandingIntentExamplesSection';

function AngleHeroSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className="tool-hero-surface angle-hero relative overflow-hidden border-b border-hairline bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.1),transparent_28%),radial-gradient(circle_at_right,rgba(59,130,246,0.1),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))]">
      <div className="container-page relative max-w-7xl py-8 sm:py-10 lg:py-12">
        <div className="stack-gap-lg">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-10 xl:gap-12">
            <div className="max-w-4xl stack-gap-lg">
              <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
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

              <div className="stack-gap-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand sm:text-xs">{content.hero.eyebrow}</p>
              </div>

              <div className="stack-gap-sm">
                <h1 className="max-w-5xl text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl lg:text-[4.25rem] lg:leading-[0.98]">
                  {content.hero.title}
                </h1>
                <p className="max-w-2xl text-base leading-8 text-text-secondary sm:text-lg">{content.hero.body}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <ButtonLink
                  href="/app/tools/angle"
                  linkComponent={Link}
                  size="lg"
                  data-analytics-event="tool_cta_click"
                  data-analytics-cta-name="angle_try_tool_hero"
                  data-analytics-cta-location="tool_angle_hero"
                  data-analytics-tool-name="angle"
                  data-analytics-tool-surface="public"
                  data-analytics-target-family="app_tools"
                >
                  {content.hero.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </div>

              <p className="max-w-2xl text-sm font-medium leading-7 text-text-secondary">{content.hero.supportText}</p>
            </div>

            <div className="lg:pt-3">
              <HeroAngleFlowPanel content={content.hero.panel} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AngleProblemSolutionSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className="border-t border-hairline bg-bg section">
      <div className="container-page max-w-6xl stack-gap-lg">
        <SectionHeader
          eyebrow={content.problemSolution.eyebrow}
          title={content.problemSolution.title}
          body={<p>{content.problemSolution.body}</p>}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <Card className="overflow-hidden border-slate-800 bg-[linear-gradient(180deg,#0a1320,#101d2d)] p-0 text-white">
            <div className="border-b border-white/10 px-6 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{content.problemSolution.problem.label}</p>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight">{content.problemSolution.problem.title}</h3>
            </div>
            <div className="stack-gap-sm px-6 py-6 text-sm leading-7 text-slate-300">
              <p>{content.problemSolution.problem.body}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {content.problemSolution.problem.items.map((item) => (
                  <div key={item} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-sm font-medium text-white">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="angle-solution-card overflow-hidden border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,248,252,0.98))] p-0">
            <div className="border-b border-hairline px-6 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{content.problemSolution.solution.label}</p>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">{content.problemSolution.solution.title}</h3>
            </div>
            <div className="stack-gap-sm px-6 py-6 text-sm leading-7 text-text-secondary">
              <p>{content.problemSolution.solution.body}</p>
              <div className="mt-3 grid justify-items-center gap-3 sm:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1fr)] sm:items-center sm:justify-items-stretch">
                <div className={`tool-surface-card rounded-[22px] border border-hairline bg-white p-3 ${MOBILE_IMAGE_MAX_WIDTH}`}>
                  <div className="tool-image-matte relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#edf3f8]">
                    <Image src={ANGLE_SOURCE_URL} alt={content.problemSolution.solution.sourceAlt} fill sizes="260px" className="object-cover" />
                  </div>
                </div>
                <ArrowRight className="mx-auto h-5 w-5 text-brand" />
                <div className={`tool-surface-card rounded-[22px] border border-hairline bg-white p-3 ${MOBILE_IMAGE_MAX_WIDTH}`}>
                  <div className="tool-image-matte relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#e8f0f8]">
                    <Image src={ANGLE_OUTPUT_URL} alt={content.problemSolution.solution.outputAlt} fill sizes="360px" className="object-cover" />
                  </div>
                </div>
              </div>
              <p className="text-sm font-medium text-text-primary">{content.problemSolution.solution.caption}</p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function AngleHowItWorksSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className="border-t border-hairline bg-surface section">
      <div className="container-page max-w-6xl stack-gap-lg">
        <SectionHeader eyebrow={content.howItWorks.eyebrow} title={content.howItWorks.title} body={<p>{content.howItWorks.body}</p>} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
          {content.howItWorks.steps.map((step, index) => {
            const style = HOW_IT_WORKS_STEP_STYLES[index] ?? HOW_IT_WORKS_STEP_STYLES[1];
            return (
              <div key={step.title} className="contents">
                <Card
                  id={`step-${index + 1}`}
                  className={`relative overflow-hidden border-hairline p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] ${style.card}`}
                >
                  <div className={`mb-4 h-1.5 w-16 rounded-full bg-gradient-to-r ${style.line}`} />
                  <div className="mb-4 flex items-center gap-3">
                    <div className={`inline-flex h-10 min-w-[40px] items-center justify-center rounded-full px-3 text-sm font-semibold ${style.badge}`}>
                      {index + 1}
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Step {index + 1}</p>
                  </div>
                  <h3 className="max-w-[16ch] text-[1.35rem] font-semibold tracking-tight text-text-primary">{step.title}</h3>
                  <p className="mt-3 max-w-[26ch] text-sm leading-7 text-text-secondary">{step.body}</p>
                </Card>
                {index < content.howItWorks.steps.length - 1 ? (
                  <div className="hidden items-center justify-center px-1 lg:flex">
                    <ArrowRight className="h-4 w-4 text-brand/70" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AngleWorkspaceSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className="border-t border-hairline bg-bg section">
      <div className="container-page max-w-6xl stack-gap-lg">
        <SectionHeader eyebrow={content.workspace.eyebrow} title={content.workspace.title} body={<p>{content.workspace.body}</p>} />
        <WorkspaceShowcase content={content.workspace} />
      </div>
    </section>
  );
}

function AngleBenefitsSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className="border-t border-hairline bg-surface section">
      <div className="container-page max-w-6xl stack-gap-lg">
        <SectionHeader eyebrow={content.benefits.eyebrow} title={content.benefits.title} body={<p>{content.benefits.body}</p>} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {content.benefits.items.map((benefit, index) => (
            <Card key={benefit.title} className="border-hairline bg-bg p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
              <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                {(index + 1).toString().padStart(2, '0')}
              </div>
              <h3 className="text-lg font-semibold text-text-primary">{benefit.title}</h3>
              <p className="mt-3 text-sm leading-7 text-text-secondary">{benefit.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function AngleUseCasesSection({ content }: { content: AngleLandingContent }) {
  const [storyOriginalThumb, storyThreeQuarterThumb, storyWorkspaceThumb] = content.useCases.story.thumbs as [
    AngleThumbContent,
    AngleThumbContent,
    AngleThumbContent,
  ];

  return (
    <section className="border-t border-hairline bg-bg section">
      <div className="container-page max-w-6xl stack-gap-lg">
        <SectionHeader eyebrow={content.useCases.eyebrow} title={content.useCases.title} body={<p>{content.useCases.body}</p>} />

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="overflow-hidden border-hairline bg-surface p-0 lg:col-span-6">
            <div className="angle-showcase-header border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,249,252,0.96))] p-5">
              <div className="grid grid-cols-3 gap-3">
                <AngleThumb label={storyOriginalThumb.label} note={storyOriginalThumb.note} src={ANGLE_STORY_SOURCE_URL} alt={storyOriginalThumb.alt} background="bg-[#edf3f8]" />
                <AngleThumb label={storyThreeQuarterThumb.label} note={storyThreeQuarterThumb.note} src={ANGLE_ALT_THREE_URL} alt={storyThreeQuarterThumb.alt} background="bg-[#e8f0f8]" />
                <AngleThumb
                  label={storyWorkspaceThumb.label}
                  note={storyWorkspaceThumb.note}
                  src={ANGLE_WORKSPACE_SCREENSHOT_PATH}
                  alt={storyWorkspaceThumb.alt}
                  background="bg-[#dce8ff]"
                  imageClassName="object-cover object-top"
                />
              </div>
            </div>
            <div className="stack-gap-sm p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{content.useCases.story.eyebrow}</p>
              <h3 className="text-xl font-semibold text-text-primary">{content.useCases.story.title}</h3>
              <p className="text-sm leading-7 text-text-secondary">{content.useCases.story.body}</p>
            </div>
          </Card>

          <Card className="overflow-hidden border-hairline bg-surface p-0 lg:col-span-6">
            <div className="angle-showcase-header border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(241,247,252,0.96))] p-5">
              <ProductAngleMock beforeLabel={content.useCases.commerce.mockBeforeLabel} afterLabel={content.useCases.commerce.mockAfterLabel} />
            </div>
            <div className="stack-gap-sm p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{content.useCases.commerce.eyebrow}</p>
              <h3 className="text-xl font-semibold text-text-primary">{content.useCases.commerce.title}</h3>
              <p className="text-sm leading-7 text-text-secondary">{content.useCases.commerce.body}</p>
            </div>
          </Card>

          {content.useCases.smallCases.map((useCase) => (
            <Card key={useCase.title} className="border-hairline bg-surface p-6 lg:col-span-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{useCase.eyebrow}</p>
              <h3 className="mt-3 text-xl font-semibold text-text-primary">{useCase.title}</h3>
              <p className="mt-3 text-sm leading-7 text-text-secondary">{useCase.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function AngleRelatedSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className="border-t border-hairline bg-bg section">
      <div className="container-page max-w-6xl stack-gap-lg">
        <SectionHeader eyebrow={content.related.eyebrow} title={content.related.title} body={<p>{content.related.body}</p>} />
        <div className="grid gap-4">
          <Card className="border-hairline bg-surface p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{content.related.guidesTitle}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {content.related.guideLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center rounded-full border border-hairline bg-bg px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-border-hover hover:bg-surface-hover"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function AngleFinalCtaSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className="border-t border-hairline bg-bg section halo-workspace-bottom">
      <div className="container-page max-w-6xl">
        <Card className="overflow-hidden border-hairline bg-[linear-gradient(135deg,rgba(8,17,28,0.98),rgba(20,48,76,0.96))] p-0 text-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]">
          <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div className="stack-gap-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{content.finalCta.eyebrow}</p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{content.finalCta.title}</h2>
              <div className="max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                <p>{content.finalCta.body}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <ButtonLink
                  href="/app/tools/angle"
                  linkComponent={Link}
                  size="lg"
                  className="bg-white text-slate-950 hover:bg-slate-100"
                  data-analytics-event="tool_cta_click"
                  data-analytics-cta-name="angle_try_tool_final"
                  data-analytics-cta-location="tool_angle_final"
                  data-analytics-tool-name="angle"
                  data-analytics-tool-surface="public"
                  data-analytics-target-family="app_tools"
                >
                  {content.finalCta.primaryCta}
                </ButtonLink>
                <ButtonLink href="/tools" linkComponent={Link} variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                  {content.finalCta.secondaryCta}
                </ButtonLink>
              </div>
            </div>
            <div className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4 ${MOBILE_IMAGE_MAX_WIDTH}`}>
              <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                <span>{content.finalCta.panelLeft}</span>
                <span>{content.finalCta.panelRight}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {ANGLE_LATEST_BATCH_URLS.map((src, index) => (
                  <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#dce7f3]">
                    <Image src={src} alt={`${content.finalCta.panelAlt} ${index + 1}`} fill sizes="(max-width: 640px) 140px, 220px" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function AngleFaqSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className="border-t border-hairline bg-surface section">
      <div className="container-page max-w-4xl stack-gap-lg">
        <SectionHeader eyebrow={content.faq.eyebrow} title={content.faq.title} body={<p>{content.faq.body}</p>} />
        <div className="stack-gap-sm">
          {content.faq.items.map((faq) => (
            <details key={faq.question} className="rounded-[24px] border border-hairline bg-bg p-5 shadow-[0_20px_40px_rgba(15,23,42,0.04)]">
              <summary className="cursor-pointer list-none text-base font-semibold text-text-primary">{faq.question}</summary>
              <p className="mt-4 text-sm leading-7 text-text-secondary">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AngleLandingSections({ content }: { content: AngleLandingContent }) {
  return (
    <>
      <AngleHeroSection content={content} />
      <AngleProblemSolutionSection content={content} />
      <AngleHowItWorksSection content={content} />
      <AngleWorkspaceSection content={content} />
      <AngleBenefitsSection content={content} />
      <AngleLandingIntentExamplesSection content={content} />
      <AngleUseCasesSection content={content} />
      <AngleRelatedSection content={content} />
      <AngleFinalCtaSection content={content} />
      <AngleFaqSection content={content} />
    </>
  );
}
