import type { Metadata } from 'next';
import CompareDetailPage, {
  generateMetadata as generateLocalizedMetadata,
  generateStaticParams as generateLocalizedStaticParams,
} from '../../(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export async function generateStaticParams() {
  const entries = await generateLocalizedStaticParams();
  return entries
    .filter((entry) => (entry.locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE)
    .map((entry) => ({ slug: entry.slug }));
}

export const generateMetadata = async (
  props: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ order?: string }>;
  }
): Promise<Metadata> => {
  const searchParams = await props.searchParams;
  const params = await props.params;

  return generateLocalizedMetadata({
    params: Promise.resolve({ locale: DEFAULT_LOCALE, slug: params.slug }),
    searchParams: Promise.resolve(searchParams ?? {}),
  });
};

export default async function CompareDetailDefaultPage(
  props: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ order?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return (
    <CompareDetailPage
      params={Promise.resolve({ locale: DEFAULT_LOCALE, slug: params.slug })}
      searchParams={Promise.resolve(searchParams ?? {})}
    />
  );
}
