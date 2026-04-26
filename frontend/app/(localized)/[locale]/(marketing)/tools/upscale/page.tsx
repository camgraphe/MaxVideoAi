import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { UpscaleLandingPage } from '@/components/tools/UpscaleLandingPage';

const AVAILABLE_LOCALES: AppLocale[] = ['en', 'fr', 'es'];

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const content = dictionary.toolMarketing.upscale;

  return buildSeoMetadata({
    locale: params.locale,
    title: content.meta.title,
    description: content.meta.description,
    englishPath: '/tools/upscale',
    availableLocales: AVAILABLE_LOCALES,
    keywords: content.meta.keywords,
    image: '/assets/tools/angle-workspace.png',
    imageAlt: content.meta.imageAlt,
  });
}

export default async function UpscalePage({ params }: { params: { locale: AppLocale } }) {
  const { dictionary } = await resolveDictionary({ locale: params.locale });

  return <UpscaleLandingPage content={dictionary.toolMarketing.upscale} />;
}
