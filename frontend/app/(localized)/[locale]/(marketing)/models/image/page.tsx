import ModelsCatalogPage, { generateModelsMetadata } from '../ModelsCatalogPage';
import type { AppLocale } from '@/i18n/locales';

export async function generateMetadata({ params }: { params: { locale: AppLocale } }) {
  return generateModelsMetadata({ params, scope: 'image' });
}

export default function ImageModelsPage() {
  return <ModelsCatalogPage scope="image" />;
}
