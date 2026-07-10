import PayAsYouGoAiVideoGeneratorPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const revalidate = 600;

export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function PayAsYouGoAiVideoGeneratorDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <PayAsYouGoAiVideoGeneratorPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />
    </DefaultMarketingLayout>
  );
}
