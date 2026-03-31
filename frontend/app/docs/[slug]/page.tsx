import type { Metadata } from 'next';
import DocPage, {
  generateMetadata as generateLocalizedMetadata,
  generateStaticParams,
  dynamicParams,
} from '@/app/(localized)/[locale]/(marketing)/docs/[slug]/page';
import DefaultMarketingLayout from '@/app/default-marketing-layout';

export { generateStaticParams, dynamicParams };

export const generateMetadata = ({ params }: { params: { slug: string } }): Promise<Metadata> =>
  generateLocalizedMetadata({ params });

export default function DocsSlugDefaultPage({ params }: { params: { slug: string } }) {
  return (
    <DefaultMarketingLayout>
      <DocPage params={params} />
    </DefaultMarketingLayout>
  );
}
