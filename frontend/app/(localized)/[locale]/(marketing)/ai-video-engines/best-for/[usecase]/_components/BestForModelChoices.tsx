import { ArrowUpRight } from 'lucide-react';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { RankedPick } from '../_lib/best-for-detail-config';
import { SELECTION_RATIONALE, SELECTION_REVIEWED_AT } from '../_lib/best-for-selection-review';
import { EDITORIAL_COPY as C } from '../_lib/best-for-editorial-copy';

export function BestForModelChoices({ picks, locale, usecase }: { picks: RankedPick[]; locale: AppLocale; usecase: string }) {
  return <section id="compare-shortlist" className="bf-choices" aria-labelledby="bf-choices-title">
    <div className="bf-section-heading"><div><h2 id="bf-choices-title">{C.shortlist[locale]}</h2><p>{C.shortlistNote[locale]}</p></div>
      <a href="#selection-method" className="bf-text-link">{C.method[locale]} ↓</a></div>
    <p className="bf-reviewed">{C.reviewed[locale]} <time dateTime={SELECTION_REVIEWED_AT}>{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(SELECTION_REVIEWED_AT))}</time></p>
    <div className="bf-choice-grid">{picks.map(pick => <article key={pick.slug} className="bf-choice" style={{ borderTopColor: pick.accent }}>
      <div className="bf-choice-heading"><span className="bf-choice-position">{String(pick.rank).padStart(2, '0')}</span><EngineIcon engine={{ id: pick.slug, label: pick.engine?.marketingName ?? pick.slug, brandId: pick.engine?.brandId }} size={36} rounded="xl" />
        <h3><Link href={{ pathname: '/models/[slug]', params: { slug: pick.slug } }}>{pick.engine?.marketingName ?? pick.slug}<ArrowUpRight size={16} aria-hidden /></Link></h3></div>
      <p className="bf-fit">{pick.criterion}</p><p>{pick.reason}</p>
      <details className="bf-choice-limit"><summary>{C.limitation[locale]}</summary><p>{pick.limitation}</p></details>
    </article>)}</div>
    <details id="selection-method" className="bf-method"><summary>{C.method[locale]}</summary><p>{SELECTION_RATIONALE[usecase]?.[locale]}</p><p>{C.methodNote[locale]}</p></details>
  </section>;
}
