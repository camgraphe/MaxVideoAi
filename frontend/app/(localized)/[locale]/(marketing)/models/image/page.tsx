import ModelsCatalogPage, { generateModelsMetadata } from '../ModelsCatalogPage';
import type { AppLocale } from '@/i18n/locales';

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  return generateModelsMetadata({ params, scope: 'image' });
}

export default function ImageModelsPage() {
  return <ModelsCatalogPage scope="image" />;
}
