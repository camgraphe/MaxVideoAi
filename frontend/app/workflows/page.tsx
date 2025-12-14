import WorkflowsPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/workflows/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const revalidate = 60 * 10;

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function WorkflowsDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <WorkflowsPage params={{ locale: DEFAULT_LOCALE }} />
    </LocaleLayout>
  );
}
