import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { ToolsMarketingHubPage } from '@/components/tools/ToolsMarketingHubPage';

const AVAILABLE_LOCALES: AppLocale[] = ['en', 'fr', 'es'];

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const content = dictionary.toolMarketing.hub;

  return buildSeoMetadata({
    locale: params.locale,
    title: content.meta.title,
    description: content.meta.description,
    englishPath: '/tools',
    availableLocales: AVAILABLE_LOCALES,
    keywords: content.meta.keywords,
  });
}

export default async function ToolsPage({ params }: { params: { locale: AppLocale } }) {
  const { dictionary } = await resolveDictionary({ locale: params.locale });

  return <ToolsMarketingHubPage content={dictionary.toolMarketing.hub} />;
}
