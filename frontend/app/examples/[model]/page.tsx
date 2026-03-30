import ExamplesModelPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../(localized)/[locale]/(marketing)/examples/[model]/page';
import LocaleLayout from '../../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';
import { getMarketingExampleRouteSlugs } from '@/lib/model-families';

export function generateStaticParams() {
  return getMarketingExampleRouteSlugs().map((model) => ({ model }));
}

export const generateMetadata = ({
  params,
  searchParams,
}: {
  params: { model: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) =>
  generateLocalizedMetadata({
    params: { locale: DEFAULT_LOCALE, model: params.model },
    searchParams: searchParams ?? {},
  });

export default function ExamplesModelDefaultPage({
  params,
  searchParams,
}: {
  params: { model: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <ExamplesModelPage params={{ locale: DEFAULT_LOCALE, model: params.model }} searchParams={searchParams ?? {}} />
    </LocaleLayout>
  );
}
