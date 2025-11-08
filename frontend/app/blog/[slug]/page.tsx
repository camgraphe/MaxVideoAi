import BlogPostPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../(localized)/[locale]/(marketing)/blog/[slug]/page';
import LocaleLayout from '../../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';
import { getContentEntries } from '@/lib/content/markdown';

export async function generateStaticParams() {
  const entries = await getContentEntries(`content/${DEFAULT_LOCALE}/blog`);
  return entries.map((entry) => ({ slug: entry.slug }));
}

export const generateMetadata = ({ params }: { params: { slug: string } }) =>
  generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE, slug: params.slug } });

export default function BlogPostDefaultPage({ params }: { params: { slug: string } }) {
  const resolvedParams = { locale: DEFAULT_LOCALE, slug: params.slug };
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <BlogPostPage params={resolvedParams} />
    </LocaleLayout>
  );
}
