import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { AngleLandingPage } from '@/components/tools/AngleLandingPage';

const AVAILABLE_LOCALES: AppLocale[] = ['en', 'fr', 'es'];
const ANGLE_SOCIAL_IMAGE_URL = 'https://maxvideoai.com/assets/tools/angle-orbit-hero-dialogue-field.webp';

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const content = dictionary.toolMarketing.angle;
  const angleSocialImage = {
    url: ANGLE_SOCIAL_IMAGE_URL,
    width: 1600,
    height: 1200,
    alt: content.meta.imageAlt,
  };

  return buildSeoMetadata({
    locale: params.locale,
    title: content.meta.title,
    description: content.meta.description,
    englishPath: '/tools/angle',
    availableLocales: AVAILABLE_LOCALES,
    keywords: content.meta.keywords,
    image: ANGLE_SOCIAL_IMAGE_URL,
    imageAlt: content.meta.imageAlt,
    titleBranding: 'none',
    openGraph: { images: [angleSocialImage] },
    twitter: { images: [angleSocialImage] },
  });
}

export default async function AnglePage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const { dictionary } = await resolveDictionary({ locale: params.locale });

  return <AngleLandingPage content={dictionary.toolMarketing.angle} />;
}
