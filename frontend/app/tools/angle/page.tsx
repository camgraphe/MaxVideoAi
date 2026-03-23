import AnglePage, { generateMetadata as generateLocalizedMetadata } from '../../(localized)/[locale]/(marketing)/tools/angle/page';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function AngleDefaultPage() {
  return <AnglePage params={{ locale: DEFAULT_LOCALE }} />;
}
