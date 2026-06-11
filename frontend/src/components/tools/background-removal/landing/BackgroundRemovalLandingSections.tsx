import { ArrowRight, CheckCircle2, Eraser, Film, Layers3, Library } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { MarketingHeroImage } from '@/components/marketing/MarketingHeroImage';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  BACKGROUND_REMOVAL_CHECKERBOARD_CLASS,
  BACKGROUND_REMOVAL_HERO_DARK,
  BACKGROUND_REMOVAL_HERO_LIGHT,
  type BackgroundRemovalLandingContent,
} from './background-removal-landing-assets';

function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">{title}</h2>
      {body ? <p className="mt-3 text-sm leading-7 text-text-secondary sm:text-base">{body}</p> : null}
    </div>
  );
}

function HeroMock({ content }: { content: BackgroundRemovalLandingContent }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] border border-hairline bg-surface shadow-[0_42px_120px_rgba(15,23,42,0.18)]">
      <MarketingHeroImage
        alt={content.meta.imageAlt}
        darkSrc={BACKGROUND_REMOVAL_HERO_DARK}
        imageClassName="object-cover object-top"
        sizes="(max-width: 1024px) 100vw, 620px"
        src={BACKGROUND_REMOVAL_HERO_LIGHT}
      />
      <div className="absolute inset-x-5 bottom-5 grid gap-3 rounded-[20px] border border-white/40 bg-white/80 p-4 shadow-card backdrop-blur dark:border-white/10 dark:bg-slate-950/72 sm:grid-cols-3">
        {content.hero.stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-lg font-semibold text-text-primary">{stat.value}</p>
            <p className="text-xs text-text-secondary">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroSection({ content }: { content: BackgroundRemovalLandingContent }) {
  return (
    <section className="border-b border-hairline bg-[linear-gradient(180deg,#ffffff,#f6f8fb)] dark:bg-[linear-gradient(180deg,#070b12,#0b111c)]">
      <div className="container-page grid min-h-[700px] max-w-6xl gap-10 py-14 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1fr)] lg:items-center lg:py-18">
        <div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-hairline bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted shadow-card dark:bg-white/[0.055]">
            <Eraser className="h-3.5 w-3.5 text-brand" />
            {content.hero.badge}
          </div>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-text-primary sm:text-6xl">{content.hero.title}</h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-text-secondary sm:text-lg">{content.hero.body}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/app/tools/background-removal" linkComponent={Link} size="lg">
              {content.hero.primaryCta}
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/tools" linkComponent={Link} size="lg" variant="outline">
              {content.hero.secondaryCta}
            </ButtonLink>
          </div>
        </div>
        <HeroMock content={content} />
      </div>
    </section>
  );
}

function UseCasesSection({ content }: { content: BackgroundRemovalLandingContent }) {
  const icons = [Film, Eraser, Layers3, CheckCircle2, Library];
  return (
    <section className="section bg-bg">
      <div className="container-page max-w-6xl stack-gap-md">
        <SectionIntro eyebrow={content.useCases.eyebrow} title={content.useCases.title} body={content.useCases.body} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {content.useCases.cards.map((card, index) => {
            const Icon = icons[index] ?? Eraser;
            return (
              <Card key={card.title} className="border-hairline bg-surface p-5 shadow-card">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-input bg-brand/10 text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-text-primary">{card.title}</h3>
                <p className="mt-2 text-sm leading-7 text-text-secondary">{card.body}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ModelGuideSection({ content }: { content: BackgroundRemovalLandingContent }) {
  return (
    <section className="border-y border-hairline bg-surface section">
      <div className="container-page max-w-6xl stack-gap-md">
        <SectionIntro eyebrow={content.modelGuide.eyebrow} title={content.modelGuide.title} body={content.modelGuide.body} />
        <div className="overflow-hidden rounded-[22px] border border-hairline bg-bg shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full border-collapse text-left">
              <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                <tr>
                  <th scope="col" className="px-5 py-4">{content.modelGuide.columns.model}</th>
                  <th scope="col" className="px-5 py-4">{content.modelGuide.columns.bestFor}</th>
                  <th scope="col" className="px-5 py-4">{content.modelGuide.columns.price}</th>
                  <th scope="col" className="px-5 py-4">{content.modelGuide.columns.useWhen}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {content.modelGuide.rows.map((row) => (
                  <tr key={row.model} className="align-top">
                    <th scope="row" className="px-5 py-5 text-sm font-semibold text-text-primary">{row.model}</th>
                    <td className="px-5 py-5 text-sm leading-6 text-text-secondary">{row.bestFor}</td>
                    <td className="px-5 py-5 text-sm leading-6 text-text-secondary">{row.price}</td>
                    <td className="px-5 py-5 text-sm leading-6 text-text-secondary">{row.useWhen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowSection({ content }: { content: BackgroundRemovalLandingContent }) {
  return (
    <section className="section bg-bg">
      <div className="container-page grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] lg:items-center">
        <div className={`relative aspect-[16/11] overflow-hidden rounded-[28px] border border-hairline ${BACKGROUND_REMOVAL_CHECKERBOARD_CLASS} shadow-card`}>
          <div className="absolute inset-6 rounded-[24px] border border-white/70 bg-white/64 p-4 shadow-card backdrop-blur dark:border-white/10 dark:bg-slate-950/62">
            <div className="grid h-full grid-cols-2 gap-4">
              <div className="overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#101827,#36506b)] p-4">
                <div className="h-full rounded-[14px] bg-[radial-gradient(circle_at_50%_20%,#f3d0b5_0_13%,transparent_14%),linear-gradient(180deg,#54708f,#182235)]" />
              </div>
              <div className="flex items-center justify-center rounded-[18px] border border-dashed border-slate-300 bg-white/42">
                <Eraser className="h-14 w-14 text-brand" />
              </div>
            </div>
          </div>
        </div>
        <div className="stack-gap-md">
          <SectionIntro eyebrow={content.workflow.eyebrow} title={content.workflow.title} body={content.workflow.body} />
          <div className="grid gap-3">
            {content.workflow.steps.map((step, index) => (
              <div id={`step-${index + 1}`} key={step.title} className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 rounded-[18px] border border-hairline bg-surface p-4 shadow-sm">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">{step.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-text-secondary">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductionSection({ content }: { content: BackgroundRemovalLandingContent }) {
  return (
    <section className="border-y border-hairline bg-surface section">
      <div className="container-page grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
        <div className="stack-gap-md">
          <SectionIntro eyebrow={content.production.eyebrow} title={content.production.title} body={content.production.body} />
          <div className="grid gap-3 sm:grid-cols-3">
            {content.production.items.map((item) => (
              <Card key={item.title} className="border-hairline bg-bg p-5">
                <h3 className="text-base font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-text-secondary">{item.body}</p>
              </Card>
            ))}
          </div>
        </div>
        <Card className="border-hairline bg-bg p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-input bg-brand/10 text-brand">
              <Film className="h-5 w-5" />
            </span>
            <span className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary">video only</span>
          </div>
          <div className={`mt-5 grid aspect-video grid-cols-2 gap-3 overflow-hidden rounded-[18px] border border-hairline p-3 ${BACKGROUND_REMOVAL_CHECKERBOARD_CLASS}`}>
            <div className="rounded-[14px] bg-[linear-gradient(135deg,#111827,#64748b)]" />
            <div className="flex items-center justify-center rounded-[14px] border border-dashed border-slate-300 bg-white/70 dark:bg-slate-950/45">
              <Eraser className="h-12 w-12 text-brand" />
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-text-secondary">{content.production.panelCaption}</p>
        </Card>
      </div>
    </section>
  );
}

function FaqSection({ content }: { content: BackgroundRemovalLandingContent }) {
  return (
    <section className="section bg-bg">
      <div className="container-page max-w-5xl stack-gap-md">
        <SectionIntro eyebrow={content.faqSection.eyebrow} title={content.faqSection.title} body={content.faqSection.body} />
        <div className="grid gap-3">
          {content.faq.map((entry) => (
            <Card key={entry.q} className="border-hairline bg-surface p-5">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-brand" />
                <div>
                  <h3 className="text-base font-semibold text-text-primary">{entry.q}</h3>
                  <p className="mt-2 text-sm leading-7 text-text-secondary">{entry.a}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection({ content }: { content: BackgroundRemovalLandingContent }) {
  return (
    <section className="border-t border-hairline bg-bg section">
      <div className="container-page max-w-6xl">
        <Card className="overflow-hidden border-hairline bg-[linear-gradient(135deg,rgba(8,17,28,0.98),rgba(20,48,76,0.96))] p-8 text-white shadow-[0_32px_90px_rgba(15,23,42,0.28)] sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{content.finalCta.eyebrow}</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{content.finalCta.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">{content.finalCta.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/app/tools/background-removal" linkComponent={Link} size="lg" className="bg-white text-slate-950 hover:bg-slate-100">
              {content.finalCta.primaryCta}
            </ButtonLink>
            <ButtonLink href="/tools" linkComponent={Link} size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
              {content.finalCta.secondaryCta}
            </ButtonLink>
          </div>
        </Card>
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
