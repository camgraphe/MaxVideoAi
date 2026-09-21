import type { RuntimeModelEntry } from '@/config/model-runtime';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { buildDetailSlugMap } from './model-page-links';
import { parseModelArchiveContent } from './model-page-archive-content';

export function buildModelArchiveMetadata(model: RuntimeModelEntry, value: unknown, locale: AppLocale) {
  const content = parseModelArchiveContent(value);
  return buildSeoMetadata({
    locale, title: content.title, description: content.intro,
    slugMap: buildDetailSlugMap(model.slug), englishPath: `/models/${model.slug}`,
    ogType: 'article', robots: { index: model.publication.model.indexable, follow: true },
  });
}
