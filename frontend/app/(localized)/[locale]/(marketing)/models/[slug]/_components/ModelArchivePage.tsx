import { getExamplesHref } from '@/lib/examples-links';
import { getRuntimeModelById, type RuntimeModelEntry } from '@/config/model-runtime';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { serializeJsonLd } from '../../model-jsonld';
import { buildDetailSlugMap } from '../_lib/model-page-links';
import { parseModelArchiveContent } from '../_lib/model-page-archive-content';

export function ModelArchivePage({ model, value, locale }: {
  model: RuntimeModelEntry; value: unknown; locale: AppLocale;
}) {
  const content = parseModelArchiveContent(value);
  const canonical = buildMetadataUrls(locale, buildDetailSlugMap(model.slug), {
    englishPath: `/models/${model.slug}`,
  }).canonical;
  const alternatives = content.alternatives.filter(({ modelId }) => {
    const candidate = getRuntimeModelById(modelId);
    return candidate?.lifecycle === 'current' && candidate.publication.app.published && candidate.publication.model.published;
  });
  return (
    <main className="mx-auto max-w-6xl space-y-12 px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
        '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${canonical}#webpage`,
        url: canonical, name: content.title, description: content.intro, inLanguage: locale,
      }) }} />
      <header className="max-w-3xl space-y-5">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{content.title}</h1>
        <p className="text-lg text-text-secondary">{content.intro}</p>
        <a className="inline-block underline underline-offset-4" href="https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation">{content.sourcesLabel}</a>
      </header>
      <section aria-labelledby="archive-alternatives" className="space-y-6">
        <h2 id="archive-alternatives" className="text-2xl font-semibold">{content.alternativesTitle}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {alternatives.map(item => (
            <article key={item.modelId} className="flex flex-col gap-4 rounded-card bg-surface border border-hairline p-6">
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="flex-1 text-text-secondary">{item.description}</p>
              <Link prefetch={false} className="font-medium underline underline-offset-4" href={{ pathname: '/models/[slug]', params: { slug: getRuntimeModelById(item.modelId)!.slug } }}>{content.chooseLabel} →</Link>
            </article>
          ))}
        </div>
      </section>
      <section className="max-w-3xl space-y-4" aria-labelledby="archive-history">
        <h2 id="archive-history" className="text-2xl font-semibold">{content.historyTitle}</h2>
        <p className="text-text-secondary">{content.historyBody}</p>
        <div className="flex flex-wrap gap-6">
          <Link href="/app/library" prefetch={false} className="font-medium underline underline-offset-4">{content.historyLabel}</Link>
          <Link prefetch={false} href={getExamplesHref(model.slug) ?? { pathname: '/examples' }} className="font-medium underline underline-offset-4">{content.examplesLabel}</Link>
        </div>
      </section>
    </main>
  );
}
