import BenchmarkPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../(localized)/[locale]/(marketing)/benchmarks/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const revalidate = 21600;

export const generateMetadata = () =>
  generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function BenchmarkDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <BenchmarkPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />
    </DefaultMarketingLayout>
  );
}
