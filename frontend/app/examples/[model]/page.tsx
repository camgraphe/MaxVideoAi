import ExamplesModelPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../(localized)/[locale]/(marketing)/examples/[model]/page';
import LocaleLayout from '../../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';
import { MARKETING_EXAMPLE_SLUGS } from '@/config/navigation';

export function generateStaticParams() {
  return MARKETING_EXAMPLE_SLUGS.map((model) => ({ model }));
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
