import ExamplesPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/examples/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

type ExamplesPageProps = Parameters<typeof ExamplesPage>[0];

export default function ExamplesDefaultPage(props: Omit<ExamplesPageProps, 'params'>) {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <ExamplesPage {...(props as ExamplesPageProps)} params={{ locale: DEFAULT_LOCALE }} />
    </LocaleLayout>
  );
}
