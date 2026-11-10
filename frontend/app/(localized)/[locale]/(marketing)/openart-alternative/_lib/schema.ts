import type { AppLocale } from '@/i18n/locales';
import { buildSiteOrganizationReference } from '@/lib/seo/site-organization-schema';
import type { OpenArtCopy } from '../_content/types';
import { OPENART_CHECKED, openArtSources } from './evidence';

export function buildOpenArtSchema(copy: OpenArtCopy, locale: AppLocale, url: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#page`,
        url,
        name: copy.meta.title,
        description: copy.meta.description,
        inLanguage: locale,
        dateModified: OPENART_CHECKED,
        lastReviewed: OPENART_CHECKED,
        publisher: buildSiteOrganizationReference(),
        about: [{ '@type': 'Thing', name: 'MaxVideoAI' }, { '@type': 'Thing', name: 'OpenArt' }],
        citation: openArtSources.map(({ url: sourceUrl }) => sourceUrl),
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#questions`,
        inLanguage: locale,
        mainEntity: copy.faq.items.map(({ question, answer }) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ] as const,
  };
}
