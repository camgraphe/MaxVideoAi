import { FlaskConical } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import type { BenchmarkCopy, BenchmarkScoreAnchor } from '../_lib/benchmark-copy';
import type { BenchmarkPageData } from '../_lib/benchmark-page-data';

type BenchmarkMethodologySectionProps = {
  copy: BenchmarkCopy;
  locale: AppLocale;
  methodology: BenchmarkPageData['methodology'];
};

function formatDate(value: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(localeRegions[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export function BenchmarkMethodologySection({ copy, locale, methodology }: BenchmarkMethodologySectionProps) {
  const fidelity = copy.methodology.criteria.fidelity.label;
  const motion = copy.methodology.criteria.motion.label;
  const consistency = copy.methodology.criteria.consistency.label;

  return (
    <div>
      <div className="flex max-w-3xl items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-hairline bg-surface text-brand shadow-sm">
          <UIIcon icon={FlaskConical} size={20} />
        </span>
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-text-primary sm:text-4xl">{copy.methodology.title}</h2>
          <p className="mt-3 text-base leading-7 text-text-secondary">{copy.methodology.intro}</p>
        </div>
      </div>

      <div className="mt-8 rounded-[24px] border border-brand/20 bg-accent-subtle/45 p-5 shadow-sm sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{copy.methodology.formula}</p>
        <p className="mt-3 text-lg font-semibold leading-8 tracking-[-0.02em] text-text-primary sm:text-2xl">
          ({fidelity} + {motion} + {consistency}) ÷ 3
        </p>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-text-primary">{copy.methodology.scale}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {methodology.scoreScale.anchors.map((anchor) => (
            <article key={anchor.score} className="rounded-[18px] border border-hairline bg-surface/70 p-4">
              <p className="text-lg font-bold tabular-nums text-brand">{anchor.score}/10</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {copy.methodology.scoreAnchors[anchor.score as BenchmarkScoreAnchor]}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {methodology.criteria.map((criterion) => {
          const localized = copy.methodology.criteria[criterion.id];
          if (!localized) return null;
          return (
            <article key={criterion.id} className="rounded-[18px] border border-hairline bg-surface/70 p-5">
              <h3 className="text-sm font-semibold text-text-primary">{localized.label}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{localized.definition}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-12">
        <h3 className="text-xl font-semibold tracking-[-0.02em] text-text-primary">{copy.methodology.prompts}</h3>
        <div className="mt-4 divide-y divide-hairline overflow-hidden rounded-[22px] border border-hairline bg-surface/70">
          {methodology.promptPack.map((prompt, index) => (
            <details key={prompt.id} className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-sm font-semibold text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-text-muted">{String(index + 1).padStart(2, '0')}</span>
                  {prompt.title}
                </span>
                <span aria-hidden="true" className="text-lg font-normal text-text-muted transition group-open:rotate-45">+</span>
              </summary>
              <div className="border-t border-hairline bg-bg/50 px-5 py-5 sm:px-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{copy.methodology.canonicalPrompt}</p>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-text-secondary">{prompt.prompt}</p>
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[22px] border border-hairline bg-surface/70 p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-text-primary">{copy.methodology.limitations}</h3>
          <ul className="mt-4 space-y-3">
            {copy.methodology.methodNotes.map((note) => (
              <li key={note} className="flex gap-3 text-sm leading-6 text-text-secondary">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" />
                {note}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-[22px] border border-hairline bg-surface/70 p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-text-primary">{copy.methodology.changelog}</h3>
          <ol className="mt-4 space-y-5">
            {methodology.changelog.map((entry) => (
              <li key={`${entry.date}-${entry.version}`}>
                <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-text-muted">
                  <time dateTime={entry.date}>{formatDate(entry.date, locale)}</time>
                  <span aria-hidden="true">·</span>
                  <span>v{entry.version}</span>
                </p>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{copy.methodology.initialRelease}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
