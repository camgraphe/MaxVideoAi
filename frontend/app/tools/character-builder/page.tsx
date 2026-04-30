import CharacterBuilderPage, { generateMetadata as generateLocalizedMetadata } from '../../(localized)/[locale]/(marketing)/tools/character-builder/page';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function CharacterBuilderDefaultPage() {
  return <CharacterBuilderPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />;
}
