import EditorialStandardsPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../(localized)/[locale]/(marketing)/editorial-standards/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () =>
  generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function EditorialStandardsDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <EditorialStandardsPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />
    </DefaultMarketingLayout>
  );
}
