import { HomeCharacterStudio } from '@/components/marketing/home/HomeCharacterStudio';
import { getCharacterStudioMarketingVideos } from '@/server/character-studio/marketing-demos';
import type { AppLocale } from '@/i18n/locales';

export async function HomeCharacterStudioProof({ locale }: { locale: AppLocale }) {
  return <HomeCharacterStudio locale={locale} films={await getCharacterStudioMarketingVideos()} />;
}
