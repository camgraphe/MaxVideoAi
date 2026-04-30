import BlogPostPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../(localized)/[locale]/(marketing)/blog/[slug]/page';
import DefaultMarketingLayout from '../../default-marketing-layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';
import { getContentEntries } from '@/lib/content/markdown';

export async function generateStaticParams() {
  const entries = await getContentEntries(`content/${DEFAULT_LOCALE}/blog`);
  return entries.map((entry) => ({ slug: entry.slug }));
}

export const generateMetadata = async (props: { params: Promise<{ slug: string }> }) => {
  const params = await props.params;
  return generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE, slug: params.slug }) });
};

export default async function BlogPostDefaultPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const resolvedParams = Promise.resolve({ locale: DEFAULT_LOCALE, slug: params.slug });
  return (
    <DefaultMarketingLayout>
      <BlogPostPage params={resolvedParams} />
    </DefaultMarketingLayout>
  );
}
