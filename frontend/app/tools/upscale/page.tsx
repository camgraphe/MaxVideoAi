import UpscalePage, { generateMetadata as generateLocalizedMetadata } from '../../(localized)/[locale]/(marketing)/tools/upscale/page';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function UpscaleDefaultPage() {
  return <UpscalePage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />;
}
