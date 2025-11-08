import ModelsPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/models/page';
import { buildDefaultLocaleMetadata, withDefaultLocalePage } from '../default-locale-wrapper';

export const generateMetadata = buildDefaultLocaleMetadata(generateLocalizedMetadata);

export default withDefaultLocalePage(ModelsPage);
