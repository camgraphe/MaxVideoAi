import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  LATEST_SHEET_4,
  SHEET_IMAGE_CLASSNAME,
  USE_CASE_VISUALS,
  type CharacterBuilderLandingContent,
} from './character-builder-landing-assets';
import { LinkChip, SectionHeader } from './CharacterBuilderLandingPrimitives';

export function CharacterBuilderUseCasesSection({ content }: { content: CharacterBuilderLandingContent }) {
  const primaryUseCase = content.useCases.items[0]!;
  const secondaryUseCase = content.useCases.items[1]!;

  return (
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
                  <Image src={visual.src} alt={useCase.imageAlt} fill sizes="(max-width: 1280px) 100vw, 360px" className={visual.imageClassName} />
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
  );
}

export function CharacterBuilderRelatedSection({ content }: { content: CharacterBuilderLandingContent }) {
  return (
    <section className="border-t border-hairline bg-surface section">
      <div className="container-page max-w-6xl stack-gap-lg">
        <SectionHeader eyebrow={content.related.eyebrow} title={content.related.title} body={<p>{content.related.body}</p>} />
        <div className="grid gap-4">
          <Card className="border-hairline bg-bg/90 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{content.related.guidesTitle}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {content.related.guideLinks.map((link) => (
                <LinkChip key={link.href} href={link.href} label={link.label} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function CharacterBuilderFinalCtaSection({ content }: { content: CharacterBuilderLandingContent }) {
  return (
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
                <Image src={LATEST_SHEET_4.url} alt={content.finalCta.panelAlt} fill sizes="420px" className={SHEET_IMAGE_CLASSNAME} />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

export function CharacterBuilderFaqSection({ content }: { content: CharacterBuilderLandingContent }) {
  return (
    <section className="border-t border-hairline bg-bg section">
      <div className="container-page max-w-4xl stack-gap-lg">
        <SectionHeader eyebrow={content.faq.eyebrow} title={content.faq.title} body={<p>{content.faq.body}</p>} />
        <div className="stack-gap-sm">
          {content.faq.items.map((faq) => (
            <details key={faq.question} className="rounded-[24px] border border-hairline bg-surface/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.04)]">
              <summary className="cursor-pointer list-none text-base font-semibold text-text-primary">{faq.question}</summary>
              <p className="mt-4 text-sm leading-7 text-text-secondary">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
