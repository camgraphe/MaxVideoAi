import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { CharacterBuilderLandingPage } from '@/components/tools/CharacterBuilderLandingPage';

const AVAILABLE_LOCALES: AppLocale[] = ['en', 'fr', 'es'];

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const content = dictionary.toolMarketing.characterBuilder;

  return buildSeoMetadata({
    locale: params.locale,
    title: content.meta.title,
    description: content.meta.description,
    englishPath: '/tools/character-builder',
    availableLocales: AVAILABLE_LOCALES,
    keywords: content.meta.keywords,
    image: 'https://media.maxvideoai.com/marketing/marketing/9f84c21b-595a-4a32-aadc-0f5d70e6151a.png',
    imageAlt: content.meta.imageAlt,
  });
}

export default async function CharacterBuilderPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const { dictionary } = await resolveDictionary({ locale: params.locale });

  return <CharacterBuilderLandingPage content={dictionary.toolMarketing.characterBuilder} />;
}
