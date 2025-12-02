import type { Metadata } from 'next';
import DocPage, {
  generateMetadata as generateLocalizedMetadata,
  generateStaticParams,
  dynamicParams,
} from '@/app/(localized)/[locale]/(marketing)/docs/[slug]/page';
import LocaleLayout from '@/app/(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '@/app/default-locale-wrapper';

export { generateStaticParams, dynamicParams };

export const generateMetadata = ({ params }: { params: { slug: string } }): Promise<Metadata> =>
  generateLocalizedMetadata({ params });

export default function DocsSlugDefaultPage({ params }: { params: { slug: string } }) {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <DocPage params={params} />
    </LocaleLayout>
  );
}
