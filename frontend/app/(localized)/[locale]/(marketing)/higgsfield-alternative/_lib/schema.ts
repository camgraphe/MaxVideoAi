import type { AppLocale } from '@/i18n/locales';
import { buildSiteOrganizationReference } from '@/lib/seo/site-organization-schema';
import type { ComparisonCopy } from '../_content/types';
import { comparisonSources, COMPARISON_CHECKED } from './evidence';

export function buildComparisonSchema(copy: ComparisonCopy, locale: AppLocale, url: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': `${url}#page`, url,
        name: copy.meta.title, description: copy.meta.description, inLanguage: locale,
        dateModified: COMPARISON_CHECKED, lastReviewed: COMPARISON_CHECKED,
        publisher: buildSiteOrganizationReference(),
        about: [{ '@type': 'Thing', name: 'MaxVideoAI' }, { '@type': 'Thing', name: 'Higgsfield' }],
        citation: comparisonSources.map(({ url: source }) => source),
      },
      {
        '@type': 'FAQPage', '@id': `${url}#questions`, inLanguage: locale,
        mainEntity: copy.faq.items.map(({ question, answer }) => ({
          '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  };
}
