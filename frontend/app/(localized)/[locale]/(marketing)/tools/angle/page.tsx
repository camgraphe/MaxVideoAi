import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { AngleLandingPage } from '@/components/tools/AngleLandingPage';

const AVAILABLE_LOCALES: AppLocale[] = ['en', 'fr', 'es'];

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const content = dictionary.toolMarketing.angle;

  return buildSeoMetadata({
    locale: params.locale,
    title: content.meta.title,
    description: content.meta.description,
    englishPath: '/tools/angle',
    availableLocales: AVAILABLE_LOCALES,
    keywords: content.meta.keywords,
    image:
      'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp',
    imageAlt: content.meta.imageAlt,
  });
}

export default async function AnglePage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const { dictionary } = await resolveDictionary({ locale: params.locale });

  return <AngleLandingPage content={dictionary.toolMarketing.angle} />;
}
