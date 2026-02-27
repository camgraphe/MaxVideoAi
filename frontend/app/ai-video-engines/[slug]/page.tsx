import type { Metadata } from 'next';
import CompareDetailPage, {
  generateMetadata as generateLocalizedMetadata,
  generateStaticParams as generateLocalizedStaticParams,
} from '../../(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page';
import LocaleLayout from '../../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export async function generateStaticParams() {
  const entries = await generateLocalizedStaticParams();
  return entries
    .filter((entry) => (entry.locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE)
    .map((entry) => ({ slug: entry.slug }));
}

export const generateMetadata = ({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { order?: string };
}): Promise<Metadata> =>
  generateLocalizedMetadata({
    params: { locale: DEFAULT_LOCALE, slug: params.slug },
    searchParams,
  });

export default function CompareDetailDefaultPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { order?: string };
}) {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <CompareDetailPage params={{ locale: DEFAULT_LOCALE, slug: params.slug }} searchParams={searchParams} />
    </LocaleLayout>
  );
}
