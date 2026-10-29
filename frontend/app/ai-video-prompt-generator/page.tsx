import MiloPage, {
  generateMetadata as localizedMetadata,
} from "../(localized)/[locale]/(marketing)/ai-video-prompt-generator/page";
import DefaultMarketingLayout from "../default-marketing-layout";
import { DEFAULT_LOCALE } from "../default-locale-wrapper";
export const revalidate = 3600;
export const generateMetadata = () =>
  localizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });
export default function MiloDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <MiloPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />
    </DefaultMarketingLayout>
  );
}
