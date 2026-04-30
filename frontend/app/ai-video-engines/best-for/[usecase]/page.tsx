import type { Metadata } from 'next';
import BestForDetailPage, {
  generateMetadata as generateLocalizedMetadata,
  generateStaticParams as generateLocalizedStaticParams,
} from '../../../(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/page';
import { DEFAULT_LOCALE } from '../../../default-locale-wrapper';

export const dynamicParams = false;

export async function generateStaticParams() {
  const entries = await generateLocalizedStaticParams();
  return entries
    .filter((entry) => (entry.locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE)
    .map((entry) => ({ usecase: entry.usecase }));
}

export const generateMetadata = async (props: { params: Promise<{ usecase: string }> }): Promise<Metadata> => {
  const params = await props.params;

  return generateLocalizedMetadata({
    params: Promise.resolve({ locale: DEFAULT_LOCALE, usecase: params.usecase }),
  });
};

export default async function BestForDetailDefaultPage(props: { params: Promise<{ usecase: string }> }) {
  const params = await props.params;
  return <BestForDetailPage params={Promise.resolve({ locale: DEFAULT_LOCALE, usecase: params.usecase })} />;
}
