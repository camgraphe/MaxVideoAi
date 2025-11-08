import ModelsDetailPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../(localized)/[locale]/(marketing)/models/[slug]/page';
import { withDefaultLocalePage, DEFAULT_LOCALE } from '../../default-locale-wrapper';
import { listFalEngines } from '@/config/falEngines';

export function generateStaticParams() {
  return listFalEngines().map((entry) => ({ slug: entry.modelSlug }));
}

export const generateMetadata = ({ params }: { params: { slug: string } }) =>
  generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE, slug: params.slug } });

export default withDefaultLocalePage(ModelsDetailPage);
