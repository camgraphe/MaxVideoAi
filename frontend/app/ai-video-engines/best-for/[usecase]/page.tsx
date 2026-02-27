import type { Metadata } from 'next';
import BestForDetailPage, {
  dynamicParams,
  generateMetadata as generateLocalizedMetadata,
  generateStaticParams as generateLocalizedStaticParams,
} from '../../../(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/page';
import LocaleLayout from '../../../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../../../default-locale-wrapper';

export { dynamicParams };

export async function generateStaticParams() {
  const entries = await generateLocalizedStaticParams();
  return entries
    .filter((entry) => (entry.locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE)
    .map((entry) => ({ usecase: entry.usecase }));
}

export const generateMetadata = ({ params }: { params: { usecase: string } }): Promise<Metadata> =>
  generateLocalizedMetadata({
    params: { locale: DEFAULT_LOCALE, usecase: params.usecase },
  });

export default function BestForDetailDefaultPage({ params }: { params: { usecase: string } }) {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <BestForDetailPage params={{ locale: DEFAULT_LOCALE, usecase: params.usecase }} />
    </LocaleLayout>
  );
}
