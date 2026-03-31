import DocsIndexPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/docs/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const revalidate = 60 * 10;

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function DocsDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <DocsIndexPage params={{ locale: DEFAULT_LOCALE }} />
    </DefaultMarketingLayout>
  );
}
