import WorkflowsPage from '../(localized)/[locale]/(marketing)/workflows/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export { generateMetadata } from '../(localized)/[locale]/(marketing)/workflows/page';

export default function WorkflowsDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <WorkflowsPage />
    </LocaleLayout>
  );
}
