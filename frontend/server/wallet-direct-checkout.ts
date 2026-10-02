import { requireDisplayedWalletCustomerTariff, walletCustomerPricingMetadata } from '@/server/pricing/wallet-direct-policy';
import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { getConfiguredEngine } from '@/server/engines';
import { buildGenerateRequestOptions } from '@/app/api/generate/_lib/request-options';
import { resolveBytePlusSeedanceRouteProfile } from '@/server/video-providers/byteplus-modelark';
import type { EngineCaps, Mode } from '@/types/engines';
import { applyEngineVariantPricing, buildEngineAddonInput } from '@/lib/pricing-addons';
import { videoPricingExtras } from '@/lib/pricing-video-extras';
import { validateExtraInputValues } from '@/app/api/generate/_lib/extra-input-values';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';
import { convertCents } from '@/lib/exchange';
import { resolveWalletDirectPricingGate } from '@/lib/wallet-direct-pricing';
import { saveDirectPaymentQuote, DirectPaymentQuoteError } from '@/server/pricing/direct-payment-quotes';
import { CustomerTariffRevisionError } from '@/server/pricing/customer-tariff-revision';
import type { Currency, resolveCurrency } from '@/lib/currency';

const WALLET_DISPLAY_CURRENCY = 'USD';
const WALLET_DISPLAY_CURRENCY_LOWER = 'usd';

export async function createWalletDirectPaymentIntent(input: {
  req: NextRequest; body: Record<string, unknown>; stripe: Stripe; userId: string;
  deps?: { getConfiguredEngineFn?: typeof getConfiguredEngine; computePricingSnapshotFn?: typeof computeCanonicalBillingSnapshot; convertCentsFn?: typeof convertCents };
  resolvedCurrencyLower: Currency; resolvedCurrencyUpper: string; currencyResolution: ReturnType<typeof resolveCurrency>;
}) {
  const { req, body, stripe, userId, resolvedCurrencyLower, resolvedCurrencyUpper, currencyResolution } = input;
  const engineId = String(body.engineId || '');
  const engine = await (input.deps?.getConfiguredEngineFn ?? getConfiguredEngine)(engineId);
  if (!engine) {
    return NextResponse.json({ error: 'Unknown engine' }, { status: 400 });
  }
  const { mode, refusal } = resolveWalletDirectPricingGate(engine, body.generationMode ?? body.engineMode ?? body.videoMode);
  if (refusal) return NextResponse.json({ error: 'This mode must be quoted through validated generation preflight.', code: refusal }, { status: 422 });
  const normalized = normalizeWalletDirectOptions(engine, mode, body);
  if (!normalized.ok) return NextResponse.json(normalized.body, { status: normalized.status });
  const { durationSec, pricingResolution: resolution, aspectRatio, loop, voiceControl, soraRequest,
    rawDurationOption, lumaDurationInfo, audioEnabled: selectedAudio } = normalized.options;
  const audioEnabled = selectedAudio;
  const extras = validateExtraInputValues({ engine, mode, rawExtraInputValues: normalized.options.rawExtraInputValues });
  if (!extras.ok) return NextResponse.json(extras.body, { status: extras.status });
  const pricedExtras = videoPricingExtras(engine.id, mode, extras.values);
  const pricingEngine = applyEngineVariantPricing(engine, mode);
  let pricing = await (input.deps?.computePricingSnapshotFn ?? computeCanonicalBillingSnapshot)({
    engine: pricingEngine,
    durationSec,
    resolution,
    mode, aspectRatio, loop, addons: { ...buildEngineAddonInput(pricingEngine, { audioEnabled, voiceControl }), ...pricedExtras },
    membershipTier: typeof body.membershipTier === 'string' ? body.membershipTier : null,
    durationOption: lumaDurationInfo?.label ?? rawDurationOption ?? null,
    ...(mode === 'i2v' ? { inputImageCount: 1 } : {}),
  });

  const displayedTariffError = requireDisplayedWalletCustomerTariff(req, pricing);
  if (displayedTariffError) return displayedTariffError;
  const settlementCurrencyUpper = resolvedCurrencyUpper;
  let { cents: settlementAmountCents, rate: fxRate, source: fxSource } = await (input.deps?.convertCentsFn ?? convertCents)(
    pricing.totalCents,
    WALLET_DISPLAY_CURRENCY_LOWER,
    resolvedCurrencyLower
  );
  const jobId = typeof body.jobId === 'string' && body.jobId.trim() ? String(body.jobId).trim() : `job_${randomUUID()}`;
  pricing.meta = { ...pricing.meta, currency_source: currencyResolution.source, currency_country: currencyResolution.country ?? null };
  let directQuoteId = `direct_${randomUUID()}`;

  try {
    const savedQuote = await saveDirectPaymentQuote({ id: directQuoteId, userId, jobId,
      scenario: { engineId: engine.id, mode, durationSec, resolution, aspectRatio, loop, audioEnabled: audioEnabled ?? null, voiceControl,
        hdr: Boolean(pricedExtras.hdr), exrExport: Boolean(pricedExtras.exr_export) },
      pricing, settlement: { currency: settlementCurrencyUpper, amountCents: settlementAmountCents, fxRate, fxSource } });
    directQuoteId = savedQuote.id;
    pricing = savedQuote.pricing;
    settlementAmountCents = savedQuote.settlement.amountCents;
    fxRate = savedQuote.settlement.fxRate;
    fxSource = savedQuote.settlement.fxSource;
    const metadata: Record<string, string> = {
      direct_quote_id: directQuoteId,
      kind: 'run',
      user_id: userId,
      engine_id: engine.id,
      job_id: jobId,
      engine_label: String(pricing.meta?.engineLabel ?? engine.label),
      duration_sec: String(durationSec),
      resolution,
      pricing_total_cents: String(pricing.totalCents),
      pricing_currency: pricing.currency,
      display_currency: WALLET_DISPLAY_CURRENCY,
      wallet_currency: WALLET_DISPLAY_CURRENCY,
      wallet_amount_cents: String(pricing.totalCents),
      settlement_currency: savedQuote.settlement.currency,
      settlement_amount_cents: String(settlementAmountCents),
      fx_rate: fxRate.toString(),
      fx_source: fxSource,
      currency: savedQuote.settlement.currency,
      currency_source: String(pricing.meta?.currency_source ?? 'paid_quote'),
      currency_country: String(pricing.meta?.currency_country ?? ''),
    };

    if (soraRequest) {
      metadata.variant = soraRequest.variant;
      metadata.mode = soraRequest.mode;
    }

    Object.assign(metadata, walletCustomerPricingMetadata(pricing));

    // The complete immutable snapshot lives in PostgreSQL, outside Stripe's metadata size limit.
    delete metadata.pricing_snapshot;
    const params: Stripe.PaymentIntentCreateParams = {
      amount: settlementAmountCents,
      currency: savedQuote.settlement.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata,
    };

    const intent = await stripe.paymentIntents.create(params, { idempotencyKey: `direct-quote-${savedQuote.id}` });

    console.info('[payments] payment_intent created', {
      paymentIntentId: intent.id,
      jobId,
      amountCents: pricing.totalCents,
      settlementAmountCents,
      settlementCurrency: savedQuote.settlement.currency,
      currency: WALLET_DISPLAY_CURRENCY,
      fxRate,
      fxSource,
      currencySource: currencyResolution.source,
      currencyCountry: currencyResolution.country ?? null,
      mode: 'platform',
    });

    return NextResponse.json({
      ok: true,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountCents: pricing.totalCents,
      currency: WALLET_DISPLAY_CURRENCY,
      settlementCurrency: savedQuote.settlement.currency,
      settlementAmountCents,
      fxRate,
      fxSource,
      jobId,
      pricing,
    });
  } catch (error) {
    if (error instanceof CustomerTariffRevisionError || error instanceof DirectPaymentQuoteError) {
      return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Stripe error creating PaymentIntent';
    console.error('POST /api/wallet direct error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Matches generate's normalized options before creating a payment that cannot be repriced. */
export function normalizeWalletDirectOptions(engine: EngineCaps, mode: Mode, body: Record<string, unknown>) {
  return buildGenerateRequestOptions({ engine, mode, body, isBytePlusV1a: resolveBytePlusSeedanceRouteProfile(engine.id, engine.providerMeta?.provider) !== null });
}
