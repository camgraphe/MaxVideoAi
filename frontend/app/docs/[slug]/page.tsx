import type { Metadata } from 'next';
import DocPage, {
  generateMetadata as generateLocalizedMetadata,
  generateStaticParams,
} from '@/app/(localized)/[locale]/(marketing)/docs/[slug]/page';
import DefaultMarketingLayout from '@/app/default-marketing-layout';

export { generateStaticParams };
export const dynamicParams = false;

export const generateMetadata = async (props: { params: Promise<{ slug: string }> }): Promise<Metadata> => {
  const params = await props.params;
  return generateLocalizedMetadata({ params: Promise.resolve({ locale: 'en', slug: params.slug }) });
};

export default async function DocsSlugDefaultPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return (
    <DefaultMarketingLayout>
      <DocPage params={Promise.resolve({ locale: 'en', slug: params.slug })} />
    </DefaultMarketingLayout>
  );
}
