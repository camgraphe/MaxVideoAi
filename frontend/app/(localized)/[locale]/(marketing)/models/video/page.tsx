import ModelsCatalogPage, { generateModelsMetadata } from '../ModelsCatalogPage';
import type { AppLocale } from '@/i18n/locales';

export async function generateMetadata({ params }: { params: { locale: AppLocale } }) {
  return generateModelsMetadata({ params, scope: 'video' });
}

export default function VideoModelsPage() {
  return <ModelsCatalogPage scope="video" />;
}
