import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import { getLocalizedUrl } from '@/lib/metadataUrls';
import type { StudioMarketingCopy } from './studio-marketing-copy';

export function buildStudioMarketingSchema(locale: AppLocale, copy: StudioMarketingCopy) {
  const url = getLocalizedUrl(locale, '/studio');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: copy.meta.title, description: copy.meta.description, inLanguage: localeRegions[locale] },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MaxVideoAI', item: getLocalizedUrl(locale, '/') },
        { '@type': 'ListItem', position: 2, name: 'Studio', item: url },
      ] },
      { '@type': 'FAQPage', '@id': `${url}#faq`, inLanguage: localeRegions[locale], mainEntity: copy.faq.items.map(item => ({
        '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })) },
    ],
  };
}
