import {
  ArrowRight,
  CheckCircle2,
  Download,
  Eraser,
  FileVideo,
  Film,
  Layers3,
  Library,
  Palette,
  Scissors,
  UploadCloud,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { MarketingHeroImage } from '@/components/marketing/MarketingHeroImage';
import { ButtonLink } from '@/components/ui/Button';
import {
  BACKGROUND_REMOVAL_GREEN_SCREEN_EXPORT,
  BACKGROUND_REMOVAL_HERO_BEFORE_AFTER,
  BACKGROUND_REMOVAL_PRODUCT_CUTOUT,
  BACKGROUND_REMOVAL_WORKFLOW_STAGES,
  type BackgroundRemovalLandingContent,
} from './background-removal-landing-assets';

function SectionIntro({ eyebrow, title, body, inverted = false }: { eyebrow: string; title: string; body?: string; inverted?: boolean }) {
  return (
    <div className="max-w-3xl">
      <p className={inverted ? 'text-[11px] font-semibold uppercase tracking-[0.18em] text-lime-300' : 'text-[11px] font-semibold uppercase tracking-[0.18em] text-brand'}>
        {eyebrow}
      </p>
      <h2 className={inverted ? 'mt-3 text-3xl font-semibold text-white sm:text-4xl' : 'mt-3 text-3xl font-semibold text-text-primary sm:text-4xl'}>{title}</h2>
      {body ? <p className={inverted ? 'mt-3 text-sm leading-7 text-slate-300 sm:text-base' : 'mt-3 text-sm leading-7 text-text-secondary sm:text-base'}>{body}</p> : null}
    </div>
  );
}

function HeroVisual({ compact = false, content }: { compact?: boolean; content: BackgroundRemovalLandingContent }) {
  return (
    <div className="relative mx-auto w-full max-w-[760px]">
      <div className="relative overflow-hidden rounded-[8px] border border-white/12 bg-slate-900 shadow-[0_34px_90px_rgba(0,0,0,0.36)]">
        <div className="relative aspect-[16/10]">
          <MarketingHeroImage
            alt={content.meta.imageAlt}
            imageClassName="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 760px"
            src={BACKGROUND_REMOVAL_HERO_BEFORE_AFTER}
          />
          <div className="absolute left-3 top-3 rounded-[8px] border border-white/18 bg-slate-950/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
            Source
          </div>
          <div className="absolute right-3 top-3 rounded-[8px] border border-lime-300/35 bg-lime-300 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-950 shadow-card">
            Alpha matte
          </div>
        </div>
      </div>
      {compact ? null : (
        <div className="-mt-6 ml-auto mr-4 grid max-w-[620px] gap-2 rounded-[8px] border border-slate-950/10 bg-white p-2 shadow-[0_24px_70px_rgba(15,23,42,0.2)] dark:border-white/10 dark:bg-slate-950 sm:grid-cols-3">
          {content.hero.stats.map((stat, index) => {
            const icons = [Film, FileVideo, Library];
            const Icon = icons[index] ?? CheckCircle2;
            return (
              <div key={stat.label} className="flex items-center gap-3 rounded-[8px] bg-slate-50 px-3 py-3 dark:bg-white/[0.055]">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-lime-300/16 text-lime-700 dark:text-lime-200">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-base font-semibold leading-5 text-text-primary">{stat.value}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-text-secondary">{stat.label}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HeroSection({ content }: { content: BackgroundRemovalLandingContent }) {
  const assuranceIcons = [FileVideo, CheckCircle2, Layers3];

  return (
    <section className="border-b border-white/10 bg-slate-950 text-white">
      <div className="container-page grid min-h-[690px] max-w-[1240px] gap-10 py-14 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.08fr)] lg:items-center lg:py-16">
        <div>
          <h1 className="max-w-2xl text-[42px] font-semibold leading-[0.98] tracking-normal text-white sm:text-6xl lg:text-[70px] lg:leading-[0.96]">
            {content.hero.title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">{content.hero.body}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/app/tools/background-removal" linkComponent={Link} size="lg" className="!bg-lime-300 !bg-none !text-slate-950 hover:!bg-lime-200">
              {content.hero.primaryCta}
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/tools" linkComponent={Link} size="lg" variant="outline" className="!border-white/18 !bg-white !text-slate-950 hover:!bg-slate-100">
              {content.hero.secondaryCta}
            </ButtonLink>
          </div>
          <div className="mt-7 lg:hidden">
            <HeroVisual compact content={content} />
          </div>
          <div className="mt-9 grid max-w-xl gap-2 sm:grid-cols-3">
            {content.hero.assurances.map((item, index) => {
              const Icon = assuranceIcons[index] ?? CheckCircle2;
              return (
                <div key={item.label} className="rounded-[8px] border border-white/12 bg-white/[0.045] px-3 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Icon className="h-4 w-4 text-lime-300" />
                    {item.label}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
        <div className="hidden lg:block">
          <HeroVisual content={content} />
        </div>
      </div>
    </section>
  );
}

function UseCasesSection({ content }: { content: BackgroundRemovalLandingContent }) {
  const icons = [Film, Scissors, Layers3, Palette, Library];

  return (
    <section className="bg-bg py-14 sm:py-16">
      <div className="container-page max-w-[1240px]">
        <div className="grid gap-10 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <div className="stack-gap-md">
            <SectionIntro eyebrow={content.useCases.eyebrow} title={content.useCases.title} body={content.useCases.body} />
            <div className="relative overflow-hidden rounded-[8px] border border-hairline bg-surface shadow-card">
              <div className="relative aspect-[4/3]">
                <MarketingHeroImage
                  alt=""
                  imageClassName="object-cover object-center"
                  priority={false}
                  sizes="(max-width: 1024px) 100vw, 360px"
                  src={BACKGROUND_REMOVAL_PRODUCT_CUTOUT}
                />
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {content.useCases.cards.map((card, index) => {
              const Icon = icons[index] ?? Eraser;
              return (
                <article key={card.title} className="group rounded-[8px] border border-hairline bg-surface p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-lime-300/45">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-slate-950 text-lime-300 dark:bg-white/[0.08]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-text-primary">{card.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-text-secondary">{card.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ModelGuideSection({ content }: { content: BackgroundRemovalLandingContent }) {
  const rowIcons = [Scissors, FileVideo, Download];

  return (
    <section className="border-y border-hairline bg-slate-950 py-14 text-white sm:py-16">
      <div className="container-page grid max-w-[1240px] gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] lg:items-start">
        <SectionIntro eyebrow={content.modelGuide.eyebrow} title={content.modelGuide.title} body={content.modelGuide.body} inverted />
        <div className="grid gap-3">
          {content.modelGuide.rows.map((row) => (
            <div key={row.model} className="rounded-[8px] border border-white/12 bg-white/[0.045] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)]">
              <div className="flex flex-col gap-5 sm:flex-row">
                <div className="min-w-[180px]">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-300">{content.modelGuide.columns.model}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{row.model}</h3>
                </div>
                {[row.bestFor, row.price, row.useWhen].map((value, index) => {
                  const Icon = rowIcons[index] ?? CheckCircle2;
                  const labels = [content.modelGuide.columns.bestFor, content.modelGuide.columns.price, content.modelGuide.columns.useWhen];
                  return (
                    <div key={labels[index]} className="flex flex-1 gap-3 border-t border-white/10 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                      <Icon className="mt-1 h-4 w-4 shrink-0 text-lime-300" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{labels[index]}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-300">{value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection({ content }: { content: BackgroundRemovalLandingContent }) {
  const stepIcons = [UploadCloud, Scissors, Download];

  return (
    <section className="bg-bg py-14 sm:py-16">
      <div className="container-page max-w-[1240px]">
        <div className="grid gap-9 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:items-center">
          <div className="relative overflow-hidden rounded-[8px] border border-hairline bg-surface shadow-card">
            <div className="relative aspect-[16/10] overflow-hidden">
              <MarketingHeroImage
                alt=""
                imageClassName="object-cover object-center"
                priority={false}
                sizes="(max-width: 1024px) 100vw, 590px"
                src={BACKGROUND_REMOVAL_WORKFLOW_STAGES}
              />
            </div>
            <div className="grid gap-2 border-t border-hairline bg-bg p-3 sm:grid-cols-3">
              {['Source clip', 'Alpha matte', 'Campaign background'].map((label) => (
                <div key={label} className="rounded-[8px] border border-hairline bg-surface px-3 py-2 text-sm font-medium text-text-primary">
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="stack-gap-md">
            <SectionIntro eyebrow={content.workflow.eyebrow} title={content.workflow.title} body={content.workflow.body} />
            <div className="flex gap-3 rounded-[8px] border border-lime-300/35 bg-lime-300/12 p-4 text-sm leading-7 text-text-primary dark:text-slate-100">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-brand" />
              <p>{content.workflow.priceNote}</p>
            </div>
            <div className="grid gap-3">
              {content.workflow.steps.map((step, index) => {
                const Icon = stepIcons[index] ?? CheckCircle2;
                return (
                  <article id={`step-${index + 1}`} key={step.title} className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 rounded-[8px] border border-hairline bg-surface p-4 shadow-card">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-[8px] bg-slate-950 text-lime-300 dark:bg-white/[0.08]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-base font-semibold text-text-primary">{step.title}</span>
                      <span className="mt-2 block text-sm leading-7 text-text-secondary">{step.body}</span>
                    </span>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductionSection({ content }: { content: BackgroundRemovalLandingContent }) {
  const formats = [
    { icon: FileVideo, label: 'MOV', detail: 'ProRes alpha' },
    { icon: Film, label: 'WebM', detail: 'Transparent web' },
    { icon: Palette, label: 'MP4', detail: 'Green plate' },
  ];

  return (
    <section className="border-y border-hairline bg-surface py-14 sm:py-16">
      <div className="container-page grid max-w-[1240px] gap-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center">
        <div className="stack-gap-md">
          <SectionIntro eyebrow={content.production.eyebrow} title={content.production.title} body={content.production.body} />
          <div className="grid gap-3 sm:grid-cols-3">
            {content.production.items.map((item) => (
              <article key={item.title} className="rounded-[8px] border border-hairline bg-bg p-4">
                <h3 className="text-base font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-text-secondary">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-[8px] border border-hairline bg-bg shadow-card">
          <div className="relative aspect-[4/3] overflow-hidden">
            <MarketingHeroImage
              alt=""
              imageClassName="object-cover object-center"
              priority={false}
              sizes="(max-width: 1024px) 100vw, 460px"
              src={BACKGROUND_REMOVAL_GREEN_SCREEN_EXPORT}
            />
            <div className="absolute inset-x-0 bottom-0 grid gap-2 bg-gradient-to-t from-slate-950/86 to-transparent p-3 sm:grid-cols-3">
              {formats.map(({ icon: Icon, label, detail }) => (
                <div key={label} className="rounded-[8px] border border-white/14 bg-white/10 p-3 text-white backdrop-blur">
                  <Icon className="h-5 w-5 text-lime-300" />
                  <p className="mt-3 text-sm font-semibold">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-200">{detail}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="border-t border-hairline p-4 text-sm leading-7 text-text-secondary">{content.production.panelCaption}</p>
        </div>
      </div>
    </section>
  );
}

function FaqSection({ content }: { content: BackgroundRemovalLandingContent }) {
  return (
    <section className="border-t border-hairline bg-bg py-14 sm:py-16">
      <div className="container-page max-w-4xl stack-gap-lg">
        <SectionIntro eyebrow={content.faqSection.eyebrow} title={content.faqSection.title} body={content.faqSection.body} />
        <div className="stack-gap-sm">
          {content.faq.map((entry) => (
            <details key={entry.q} className="rounded-[22px] border border-hairline bg-surface p-5 shadow-card">
              <summary className="cursor-pointer list-none text-base font-semibold text-text-primary">
                {entry.q}
              </summary>
              <p className="mt-4 text-sm leading-7 text-text-secondary">{entry.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection({ content }: { content: BackgroundRemovalLandingContent }) {
  return (
    <section className="border-t border-hairline bg-bg py-14 sm:py-16">
      <div className="container-page max-w-[1240px]">
        <div className="grid gap-8 rounded-[8px] border border-slate-950/10 bg-slate-950 p-8 text-white shadow-[0_32px_90px_rgba(15,23,42,0.28)] sm:p-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime-300">{content.finalCta.eyebrow}</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold sm:text-4xl">{content.finalCta.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">{content.finalCta.body}</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <ButtonLink href="/app/tools/background-removal" linkComponent={Link} size="lg" variant="outline" className="!border-lime-300 !bg-lime-300 !text-slate-950 hover:!bg-lime-200">
              {content.finalCta.primaryCta}
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/tools" linkComponent={Link} size="lg" variant="outline" className="!border-white/20 !bg-transparent !text-white hover:!bg-white/10">
              {content.finalCta.secondaryCta}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BackgroundRemovalLandingSections({ content }: { content: BackgroundRemovalLandingContent }) {
  return (
    <>
      <HeroSection content={content} />
      <UseCasesSection content={content} />
      <ModelGuideSection content={content} />
      <WorkflowSection content={content} />
      <ProductionSection content={content} />
      <FaqSection content={content} />
      <FinalCtaSection content={content} />
    </>
  );
}
