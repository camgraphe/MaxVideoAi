import BestForHubPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../(localized)/[locale]/(marketing)/ai-video-engines/best-for/page';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function BestForHubDefaultPage() {
  return <BestForHubPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />;
}
