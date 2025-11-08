import BlogIndexPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/blog/page';
import { buildDefaultLocaleMetadata, withDefaultLocalePage } from '../default-locale-wrapper';

export const generateMetadata = buildDefaultLocaleMetadata(generateLocalizedMetadata);

export default withDefaultLocalePage(BlogIndexPage);
