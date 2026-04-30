import WorkflowsPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/workflows/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const revalidate = 600;

export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function WorkflowsDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <WorkflowsPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />
    </DefaultMarketingLayout>
  );
}
