import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import ModelsCatalogPage, { generateModelsMetadata } from './ModelsCatalogPage';

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  return generateModelsMetadata({ params, scope: 'all' });
}

export default function ModelsPage() {
  return <ModelsCatalogPage scope="all" />;
}
