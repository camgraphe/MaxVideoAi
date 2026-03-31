import type { Metadata } from 'next';
import HomePage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/(home)/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });
}

export default function RootPage() {
  return (
    <DefaultMarketingLayout>
      <HomePage params={{ locale: DEFAULT_LOCALE }} />
    </DefaultMarketingLayout>
  );
}
