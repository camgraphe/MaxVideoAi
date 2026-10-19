import ContactPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/contact/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function ContactDefaultPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <DefaultMarketingLayout>
      <ContactPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} searchParams={searchParams} />
    </DefaultMarketingLayout>
  );
}
