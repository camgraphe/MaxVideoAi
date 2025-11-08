import ModelsDetailPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../(localized)/[locale]/(marketing)/models/[slug]/page';
import LocaleLayout from '../../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';
import { listFalEngines } from '@/config/falEngines';

export function generateStaticParams() {
  return listFalEngines().map((entry) => ({ slug: entry.modelSlug }));
}

export const generateMetadata = ({ params }: { params: { slug: string } }) =>
  generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE, slug: params.slug } });

export default function ModelDetailDefaultPage({ params }: { params: { slug: string } }) {
  const resolvedParams = { locale: DEFAULT_LOCALE, slug: params.slug };
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <ModelsDetailPage params={resolvedParams} />
    </LocaleLayout>
  );
}
