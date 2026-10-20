import { getPublicConfiguredEnginesByCategory } from '@/server/engines';
import { loadPricingPolicyOverrides, type PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import type { EngineCaps } from '@/types/engines';
import type { ExampleQuoteProvider } from './example-comparison-quotes';
import { getSeoVideoById, type GalleryVideo } from './videos';
import { isLocalPublicExamplesEnabled, getLocalPublicExample } from './local-public-examples';
import { getResolvedVideoSeoEditorialEntry } from './video-seo-editorial';
import { computeCurrentPublicSnapshot } from './pricing/quote-public';
import { createScopedCustomerTariffQuoteLoader, customerTariffsEnabledByCode } from './pricing/customer-tariff-store';
import { projectExampleWatchDetail } from './example-watch-detail';
import { deriveWatchPageSignals, type WatchPageDerivedSignals } from './watch-page-signals';
import { resolveWatchSourceImageOriginalUrls } from './watch-source-image-originals';
import { getBaseSeoWatchVideoMeta } from './video-seo';

export type ExampleWatchDetailContext = { engines: EngineCaps[]; quote: ExampleQuoteProvider };

/** Read-only, request-scoped preparation; the watch route starts it beside its video lookup. */
export async function prepareExampleWatchDetailContext(dependencies: {
  loadEngines: () => Promise<EngineCaps[]>;
  loadOverrides: () => Promise<PricingPolicyOverrideLoadResult>;
} = {
  loadEngines: () => getPublicConfiguredEnginesByCategory('video'),
  loadOverrides: loadPricingPolicyOverrides,
}): Promise<ExampleWatchDetailContext> {
  const [engines, overrides] = await Promise.all([dependencies.loadEngines(), dependencies.loadOverrides()]);
  const loadCustomerTariffQuoteState = customerTariffsEnabledByCode() ? createScopedCustomerTariffQuoteLoader() : undefined;
  return { engines, quote: context => computeCurrentPublicSnapshot(context, {
    pricingPolicy: { loadOverrides: async () => overrides },
    ...(loadCustomerTariffQuoteState ? { loadCustomerTariffQuoteState } : {}),
  }) };
}

/** Recheck public watch eligibility on every API/Studio open, including legacy indexable=NULL. */
export async function getExampleWatchDetail(id: string) {
  const video = isLocalPublicExamplesEnabled() ? getLocalPublicExample(id) : await getSeoVideoById(id);
  if (!video) return null;
  return buildExampleWatchDetail(video);
}

export async function buildExampleWatchDetail(video: GalleryVideo, preparedSignals?: WatchPageDerivedSignals, preparedContext?: ExampleWatchDetailContext) {
  // Direct watch pages pass the already validated editorial/source-image projection
  // from getVideoWatchPageDataById. API opens still resolve those gates here.
  const [editorial, context] = await Promise.all([
    preparedSignals ? null : getResolvedVideoSeoEditorialEntry(video.id),
    preparedContext ?? prepareExampleWatchDetailContext(),
  ]);
  const signals = preparedSignals ?? deriveWatchPageSignals({ video, editorial, entry: getBaseSeoWatchVideoMeta(video.id) });
  const sourceImages = preparedSignals?.sourceImages ?? await resolveWatchSourceImageOriginalUrls({ video, sourceImages: signals.sourceImages });
  return projectExampleWatchDetail(video, editorial, context.quote, context.engines, { ...signals, sourceImages });
}
