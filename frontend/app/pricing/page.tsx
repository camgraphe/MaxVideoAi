import PricingPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/pricing/page';
import { buildDefaultLocaleMetadata, withDefaultLocalePage } from '../default-locale-wrapper';

export const generateMetadata = buildDefaultLocaleMetadata(generateLocalizedMetadata);

export default withDefaultLocalePage(PricingPage);
