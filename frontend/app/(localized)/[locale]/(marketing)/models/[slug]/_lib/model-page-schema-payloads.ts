import type { FalEngineEntry } from '@/config/falEngines';
import type { EngineCaps } from '@/types/engines';
import { buildProductSchema } from '../_lib/model-page-schema';

type BuildModelSchemaPayloadsOptions = {
  canonical: string;
  description: string;
  engine: FalEngineEntry;
  heroPosterAbsolute: string | null;
  heroTitle: string;
  inLanguage: string;
  localizedCanonical: string;
  localizedHomeUrl: string;
  localizedModelsUrl: string;
  pageTitle?: string;
  pricingEngine?: EngineCaps;
  resolvedBreadcrumb: {
    home: string;
    models: string;
  };
};

export function buildModelSchemaPayloads({
  canonical,
  description,
  engine,
  heroPosterAbsolute,
  heroTitle,
  inLanguage,
  localizedCanonical,
  localizedHomeUrl,
  localizedModelsUrl,
  pageTitle,
  pricingEngine,
  resolvedBreadcrumb,
}: BuildModelSchemaPayloadsOptions): object[] {
  const schemaPageTitle = pageTitle ?? heroTitle;
  const productSchema = buildProductSchema({
    engine,
    canonical,
    description,
    heroTitle,
    heroPosterAbsolute,
    pricingEngine,
  });

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: schemaPageTitle,
      description,
      url: canonical,
      inLanguage,
    },
    productSchema,
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: resolvedBreadcrumb.home,
          item: localizedHomeUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: resolvedBreadcrumb.models,
          item: localizedModelsUrl,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: heroTitle,
          item: localizedCanonical,
        },
      ],
    },
  ].filter(Boolean) as object[];
}
