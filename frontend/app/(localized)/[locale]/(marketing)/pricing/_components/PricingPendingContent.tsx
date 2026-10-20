import type { AppLocale } from '@/i18n/locales';
import { getPricingHubCopy } from '../_lib/pricingHubCopy';

function loadingLabel(locale: AppLocale) {
  return locale === 'fr' ? 'Chargement des prix…' : locale === 'es' ? 'Cargando precios…' : 'Loading prices…';
}

/** Reserve the same three-card grid without guessing a model, amount or destination. */
export function PricingPendingQuickStart({ locale, title, note }: { locale: AppLocale; title: string; note: string }) {
  const { highlights } = getPricingHubCopy(locale).video;
  return (
    <section aria-labelledby="pricing-quick-start-title" aria-busy="true" className="container-page max-w-[1220px] pb-6 sm:pb-8">
      <h2 id="pricing-quick-start-title" className="text-sm font-semibold text-text-primary">{title}</h2>
      <span className="sr-only" role="status">{loadingLabel(locale)}</span>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 sm:gap-3" aria-hidden="true">
        {[[highlights.bestDraft, highlights.draftIntent], [highlights.cheapest10s, highlights.detailIntent], [highlights.cheapestAudio, highlights.soundIntent]].map(([label, intent]) => (
          <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-hairline bg-surface p-4 text-text-primary shadow-card sm:flex-col sm:items-start">
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-5">{intent}</span>
              <span className="mt-1 block text-xs leading-5 text-text-secondary">{label}</span>
              <span className="mt-1 block h-5 w-32 max-w-full rounded bg-bg" />
            </span>
            <span className="flex min-w-[8.5rem] shrink-0 items-center justify-between gap-3 sm:w-full sm:min-w-0">
              <span className="block h-8 w-20 rounded bg-bg" />
              <span className="h-4 w-4" />
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-text-muted">{note}</p>
    </section>
  );
}

export function PricingPendingSections({ locale }: { locale: AppLocale }) {
  return (
    <section id="video-pricing" aria-busy="true" className="min-h-screen scroll-mt-24 sm:scroll-mt-28">
      <p role="status" className="rounded-[8px] border border-hairline bg-surface p-5 text-sm text-text-muted">{loadingLabel(locale)}</p>
    </section>
  );
}
