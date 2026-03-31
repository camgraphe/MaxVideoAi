import ChangelogPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/changelog/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function ChangelogDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <ChangelogPage params={{ locale: DEFAULT_LOCALE }} />
    </DefaultMarketingLayout>
  );
}
