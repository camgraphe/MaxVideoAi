import ExamplesPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/examples/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function ExamplesDefaultPage(props: { searchParams?: Record<string, string | string[] | undefined> }) {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <ExamplesPage params={{ locale: DEFAULT_LOCALE }} searchParams={props.searchParams ?? {}} />
    </LocaleLayout>
  );
}
