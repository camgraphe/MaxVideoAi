import Page, { generateMetadata as localizedMetadata } from '../../(localized)/[locale]/(marketing)/tools/product-photo-editor/page';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';
export const generateMetadata = () => localizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });
export default function DefaultPage() { return Page({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) }); }
