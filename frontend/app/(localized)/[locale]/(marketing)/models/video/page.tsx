import ModelsCatalogPage, { generateModelsMetadata } from '../ModelsCatalogPage';
import type { AppLocale } from '@/i18n/locales';

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  return generateModelsMetadata({ params, scope: 'video' });
}

export default function VideoModelsPage() {
  return <ModelsCatalogPage scope="video" />;
}
