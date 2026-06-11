import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { BackgroundRemovalLandingPage } from '@/components/tools/BackgroundRemovalLandingPage';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const AVAILABLE_LOCALES: AppLocale[] = ['en', 'fr', 'es'];

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const content = dictionary.toolMarketing.backgroundRemoval;

  return buildSeoMetadata({
    locale: params.locale,
    title: content.meta.title,
    description: content.meta.description,
    englishPath: '/tools/background-removal',
    availableLocales: AVAILABLE_LOCALES,
    keywords: content.meta.keywords,
    image: '/assets/tools/background-removal-hero-before-after.webp',
    imageAlt: content.meta.imageAlt,
  });
}

export default async function BackgroundRemovalPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const { dictionary } = await resolveDictionary({ locale: params.locale });

  return <BackgroundRemovalLandingPage content={dictionary.toolMarketing.backgroundRemoval} />;
}
