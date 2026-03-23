import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { CharacterBuilderLandingPage } from '@/components/tools/CharacterBuilderLandingPage';

const AVAILABLE_LOCALES: AppLocale[] = ['en', 'fr', 'es'];

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const content = dictionary.toolMarketing.characterBuilder;

  return buildSeoMetadata({
    locale: params.locale,
    title: content.meta.title,
    description: content.meta.description,
    englishPath: '/tools/character-builder',
    availableLocales: AVAILABLE_LOCALES,
    keywords: content.meta.keywords,
    image: 'https://v3b.fal.media/files/b/0a935305/aYrWen8QnYME2LcBPZ33t_w1WcVklb.png',
    imageAlt: content.meta.imageAlt,
  });
}

export default async function CharacterBuilderPage({ params }: { params: { locale: AppLocale } }) {
  const { dictionary } = await resolveDictionary({ locale: params.locale });

  return <CharacterBuilderLandingPage content={dictionary.toolMarketing.characterBuilder} />;
}
