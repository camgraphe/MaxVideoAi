import BackgroundRemovalPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../(localized)/[locale]/(marketing)/tools/background-removal/page';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function BackgroundRemovalDefaultPage() {
  return <BackgroundRemovalPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />;
}
