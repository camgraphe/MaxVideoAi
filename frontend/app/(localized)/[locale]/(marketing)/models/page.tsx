import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import ModelsCatalogPage, { generateModelsMetadata } from './ModelsCatalogPage';

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  return generateModelsMetadata({ params, scope: 'all' });
}

export default function ModelsPage() {
  return <ModelsCatalogPage scope="all" />;
}
