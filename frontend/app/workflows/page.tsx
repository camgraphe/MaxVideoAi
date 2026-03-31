import WorkflowsPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/workflows/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const revalidate = 60 * 10;

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function WorkflowsDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <WorkflowsPage params={{ locale: DEFAULT_LOCALE }} />
    </DefaultMarketingLayout>
  );
}
