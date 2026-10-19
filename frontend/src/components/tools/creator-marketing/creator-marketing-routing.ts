import type { AppLocale } from '@/i18n/locales';
import type { CreatorToolId } from '@/lib/toolbox/creator-availability';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getCreatorMarketingCopy } from './creator-copy';
export function buildCreatorToolMetadata(id: CreatorToolId, locale: AppLocale) {
  const content = getCreatorMarketingCopy(locale, id);
  return buildSeoMetadata({ locale, title: content.name, description: content.description, englishPath: `/tools/${id}`, availableLocales: ['en', 'fr', 'es'] });
}
