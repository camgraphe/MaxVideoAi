import type { ComponentProps } from 'react';
import type { AppLocale } from '@/i18n/locales';
import type { ModelCommercialData, ModelPagePricing } from '../_lib/model-page-commercial-data';
import type { ModelDecisionData } from '../_lib/model-page-decision-data';
import { buildModelSchemaPayloads } from '../_lib/model-page-schema-payloads';
import { serializeJsonLd } from '../../model-jsonld';
import { ModelDecisionPricingCard } from './ModelDecisionPricingCard';
import { ModelPageContentSections } from './ModelPageContentSections';
import { ModelPublicOfferLine } from './ModelPublicOfferLine';

/** Exact details reveal once, so variable price grids never resize already-visible sections. */
export async function ModelCurrentDetails({ pricing, commercial, schema, pricingData, locale, contentProps }: {
  pricing: Promise<ModelPagePricing>;
  commercial: ModelCommercialData;
  schema: Omit<Parameters<typeof buildModelSchemaPayloads>[0], 'pricingEngine' | 'publicOffer'>;
  pricingData: ModelDecisionData['pricing'] | null;
  locale: AppLocale;
  contentProps: ComponentProps<typeof ModelPageContentSections>;
}) {
  const [current, { pricingEngine, scenarios, publicOffer }] = await Promise.all([pricing, commercial]);
  return <>
    {buildModelSchemaPayloads({ ...schema, pricingEngine, publicOffer }).map((payload, index) => (
      <script key={`schema-${index}`} id={`model-jsonld-${index}`} type="application/ld+json" suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }} />
    ))}
    {pricingData ? (
      <ModelDecisionPricingCard pricing={{ ...pricingData, scenarios: scenarios ?? pricingData.scenarios }} offer={publicOffer} locale={locale} />
    ) : <ModelPublicOfferLine offer={publicOffer} locale={locale} />}
    <ModelPageContentSections {...contentProps} specsProps={{ ...contentProps.specsProps, keySpecRows: current.keySpecRows }} />
  </>;
}
