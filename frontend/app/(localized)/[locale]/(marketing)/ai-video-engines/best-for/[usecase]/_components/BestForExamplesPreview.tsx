import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ExamplePreviewPick } from '../_lib/best-for-detail-config';
import { EDITORIAL_COPY as C } from '../_lib/best-for-editorial-copy';
import { BestForSceneCard } from './BestForSceneCard.client';

/** Image covers render on the server; playback mounts only after an explicit click. */
export function ExamplesPreview({ picks, locale }: { picks: ExamplePreviewPick[]; locale: AppLocale }) {
  if (!picks.length) return <Link href="/examples" className="bf-text-link">{C.noVideo[locale]} →</Link>;
  return <section id="examples" className="bf-examples" aria-labelledby="bf-examples-title">
    <div className="bf-section-heading"><h2 id="bf-examples-title">{C.watch[locale]}</h2><p>{C.watchNote[locale]}</p></div>
    <div className="bf-scene-grid">{picks.map((pick, index) => <BestForSceneCard key={pick.example!.id} slug={pick.slug} name={pick.engine?.marketingName ?? pick.slug} scene={pick.example!} locale={locale} priority={index === 0} wide={picks.length === 1} />)}</div>
  </section>;
}
