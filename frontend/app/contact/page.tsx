import ContactPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/contact/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function ContactDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <ContactPage params={{ locale: DEFAULT_LOCALE }} searchParams={{}} />
    </DefaultMarketingLayout>
  );
}
