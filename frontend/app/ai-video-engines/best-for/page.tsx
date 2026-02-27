import BestForHubPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../(localized)/[locale]/(marketing)/ai-video-engines/best-for/page';
import LocaleLayout from '../../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function BestForHubDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <BestForHubPage />
    </LocaleLayout>
  );
}
