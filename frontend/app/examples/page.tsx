import ExamplesPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/examples/page';
import { buildDefaultLocaleMetadata, withDefaultLocalePage } from '../default-locale-wrapper';

export const generateMetadata = buildDefaultLocaleMetadata(generateLocalizedMetadata);

export default withDefaultLocalePage(ExamplesPage);
