import type { Metadata } from 'next';
import HomePage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/(home)/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
import { HOMEPAGE_CLIENT_MESSAGE_NAMESPACES } from '@/lib/i18n/client-message-namespaces';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });
}

export default function RootPage() {
  return (
    <DefaultMarketingLayout clientMessageNamespaces={HOMEPAGE_CLIENT_MESSAGE_NAMESPACES}>
      <HomePage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />
    </DefaultMarketingLayout>
  );
}
