import type { Metadata } from 'next';
import { normalizeAppLocale } from '@/i18n/locales';
import { getLocalizedUrl } from '@/lib/metadataUrls';
import { serializeJsonLd } from '@/lib/seo/jsonld';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { OpenArtPageView } from './_components/OpenArtPageView';
import { getOpenArtCopy } from './_content';
import { OPENART_HERO, OPENART_PATH } from './_lib/evidence';
import { buildOpenArtSchema } from './_lib/schema';

export const revalidate = 86400;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = normalizeAppLocale((await params).locale);
  const copy = getOpenArtCopy(locale);
  return buildSeoMetadata({
    locale,
    ...copy.meta,
    englishPath: OPENART_PATH,
    image: OPENART_HERO.src,
    imageDimensions: { width: OPENART_HERO.width, height: OPENART_HERO.height },
    imageAlt: copy.hero.imageAlt,
  });
}

export default async function OpenArtAlternativePage({ params }: Props) {
  const locale = normalizeAppLocale((await params).locale);
  const copy = getOpenArtCopy(locale);
  const url = getLocalizedUrl(locale, OPENART_PATH);

  return (
    <>
      <OpenArtPageView copy={copy} locale={locale} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildOpenArtSchema(copy, locale, url)) }} />
    </>
  );
}
