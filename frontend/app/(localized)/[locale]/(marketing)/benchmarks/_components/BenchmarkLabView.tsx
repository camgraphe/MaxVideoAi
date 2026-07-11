import { ArrowRight, Clock3, Database, FlaskConical, Gauge, ShieldCheck } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { BenchmarkCopy } from '../_lib/benchmark-copy';
import type { BenchmarkPageData } from '../_lib/benchmark-page-data';
import { BenchmarkLatencySection } from './BenchmarkLatencySection';
import { BenchmarkMethodologySection } from './BenchmarkMethodologySection';
import { BenchmarkScoreTable } from './BenchmarkScoreTable';
import { BenchmarkSpecsTable } from './BenchmarkSpecsTable';

type BenchmarkLabViewProps = {
  copy: BenchmarkCopy;
  data: BenchmarkPageData;
  locale: AppLocale;
};

const sectionHeadingClassName = 'font-display text-3xl font-semibold tracking-[-0.03em] text-text-primary sm:text-4xl';
const sectionIntroClassName = 'mt-3 max-w-3xl text-base leading-7 text-text-secondary';

export function BenchmarkLabView({ copy, data, locale }: BenchmarkLabViewProps) {
  const number = new Intl.NumberFormat(localeRegions[locale]);
  const ctaLinks: Array<{ href: LocalizedLinkHref; label: string }> = [
    { href: { pathname: '/models' }, label: copy.cta.models },
    { href: { pathname: '/ai-video-engines' }, label: copy.cta.compare },
    { href: { pathname: '/pricing' }, label: copy.cta.pricing },
    { href: '/app', label: copy.cta.generate },
  ];

  return (
    <main className="overflow-x-clip bg-bg text-text-primary">
      <header className="relative isolate overflow-hidden border-b border-hairline px-4 py-16 sm:px-8 sm:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--brand)_14%,transparent),transparent_55%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -z-10 h-px w-[min(720px,80vw)] -translate-x-1/2 bg-gradient-to-r from-transparent via-brand/45 to-transparent" />
        <div className="mx-auto max-w-4xl text-center">
          <p className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand/20 bg-surface/70 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand shadow-sm backdrop-blur">
            <UIIcon icon={FlaskConical} size={15} />
            {copy.hero.eyebrow}
          </p>
          <h1 className="mt-7 font-display text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-text-primary sm:text-6xl lg:text-[64px]">
            {copy.hero.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-text-secondary sm:text-xl">{copy.hero.intro}</p>
          <p className="mx-auto mt-8 max-w-3xl border-t border-hairline pt-5 text-sm leading-6 text-text-muted">{copy.hero.proof}</p>
        </div>
      </header>

      <div className="sticky top-[var(--header-height)] z-20 border-b border-hairline bg-bg/90 backdrop-blur">
        <nav aria-label={copy.hero.eyebrow} className="container-page max-w-[1240px] overflow-x-auto overscroll-x-contain">
          <div className="flex min-w-max items-center gap-1 py-2">
            {[
              { href: '#scorecards', label: copy.nav.scores },
              { href: '#specifications', label: copy.nav.specs },
              { href: '#observed-speed', label: copy.nav.speed },
              { href: '#methodology', label: copy.nav.method },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex min-h-10 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      </div>

      <div className="container-page max-w-[1240px] space-y-16 py-10 sm:space-y-24 sm:py-16">
        <section aria-label={copy.hero.proof} className="grid gap-3 md:grid-cols-3">
          <article className="flex min-h-[170px] flex-col rounded-[22px] border border-hairline bg-surface/75 p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-hairline bg-bg text-brand"><UIIcon icon={Gauge} size={19} /></span>
              <span className="text-2xl font-semibold tabular-nums tracking-[-0.04em] text-text-primary">{number.format(data.scores.length)}</span>
            </div>
            <h2 className="mt-7 text-base font-semibold text-text-primary">{copy.evidence[0]?.title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{copy.evidence[0]?.body}</p>
          </article>
          <article className="flex min-h-[170px] flex-col rounded-[22px] border border-hairline bg-surface/75 p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-hairline bg-bg text-brand"><UIIcon icon={Database} size={19} /></span>
              <span className="text-2xl font-semibold tabular-nums tracking-[-0.04em] text-text-primary">{number.format(data.specs.length)}</span>
            </div>
            <h2 className="mt-7 text-base font-semibold text-text-primary">{copy.evidence[1]?.title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{copy.evidence[1]?.body}</p>
          </article>
          <article className="flex min-h-[170px] flex-col rounded-[22px] border border-hairline bg-surface/75 p-5 shadow-sm sm:p-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-hairline bg-bg text-brand"><UIIcon icon={Clock3} size={19} /></span>
            <h2 className="mt-7 text-base font-semibold text-text-primary">{copy.evidence[2]?.title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{copy.evidence[2]?.body}</p>
          </article>
        </section>

        <section id="scorecards" className="scroll-mt-[calc(var(--header-height)+76px)]">
          <div className="mb-7 flex max-w-3xl items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-hairline bg-surface text-brand shadow-sm"><UIIcon icon={Gauge} size={20} /></span>
            <div>
              <h2 className={sectionHeadingClassName}>{copy.scores.title}</h2>
              <p className={sectionIntroClassName}>{copy.scores.intro}</p>
            </div>
          </div>
          <BenchmarkScoreTable copy={copy} locale={locale} rows={data.scores} />
        </section>

        <section id="specifications" className="scroll-mt-[calc(var(--header-height)+76px)]">
          <div className="mb-7 flex max-w-3xl items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-hairline bg-surface text-brand shadow-sm"><UIIcon icon={Database} size={20} /></span>
            <div>
              <h2 className={sectionHeadingClassName}>{copy.specs.title}</h2>
              <p className={sectionIntroClassName}>{copy.specs.intro}</p>
            </div>
          </div>
          <BenchmarkSpecsTable copy={copy} locale={locale} rows={data.specs} />
        </section>

        <section id="observed-speed" className="scroll-mt-[calc(var(--header-height)+76px)]">
          <BenchmarkLatencySection copy={copy} latency={data.latency} locale={locale} scores={data.scores} />
        </section>

        <section id="methodology" className="scroll-mt-[calc(var(--header-height)+76px)]">
          <BenchmarkMethodologySection copy={copy} locale={locale} methodology={data.methodology} />
        </section>

        <p className="flex items-center gap-3 border-y border-hairline py-5 text-sm font-medium text-text-secondary">
          <UIIcon icon={ShieldCheck} size={18} className="shrink-0 text-brand" />
          {copy.refundNote}
        </p>

        <aside className="rounded-[24px] border border-hairline bg-surface/80 p-5 shadow-card sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-7">
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-text-primary">{copy.cta.title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{copy.cta.body}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
            {ctaLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-hairline bg-bg px-3.5 text-xs font-semibold text-text-primary transition hover:border-brand/35 hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
                <UIIcon icon={ArrowRight} size={13} />
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
