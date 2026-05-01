import ModelsDetailPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../(localized)/[locale]/(marketing)/models/[slug]/page';
import LocaleLayout from '../../(localized)/[locale]/layout';
import MarketingLayout from '../../(localized)/[locale]/(marketing)/layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';
import { listFalEngines } from '@/config/falEngines';

export function generateStaticParams() {
  return listFalEngines()
    .filter((entry) => entry.surfaces.modelPage.includeInSitemap !== false)
    .map((entry) => ({ slug: entry.modelSlug }));
}

export const generateMetadata = async (props: { params: Promise<{ slug: string }> }) => {
  const params = await props.params;
  return generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE, slug: params.slug }) });
};

export default async function ModelDetailDefaultPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const resolvedParams = Promise.resolve({ locale: DEFAULT_LOCALE, slug: params.slug });
  return (
    <LocaleLayout params={Promise.resolve({ locale: DEFAULT_LOCALE })}>
      <MarketingLayout>
        <ModelsDetailPage params={resolvedParams} />
      </MarketingLayout>
    </LocaleLayout>
  );
}
