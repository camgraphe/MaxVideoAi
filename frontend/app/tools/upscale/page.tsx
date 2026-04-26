import UpscalePage, { generateMetadata as generateLocalizedMetadata } from '../../(localized)/[locale]/(marketing)/tools/upscale/page';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function UpscaleDefaultPage() {
  return <UpscalePage params={{ locale: DEFAULT_LOCALE }} />;
}
