export const runtime = 'nodejs';

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER,
  getBackgroundRemovalToolEngine,
} from '@/config/tools-background-removal-engines';
import { FEATURES } from '@/content/feature-flags';
import { computeBillingProductSnapshot } from '@/lib/billing-products';
import { getUserPreferredCurrency } from '@/lib/currency';
import { withDbTransaction, query } from '@/lib/db';
import { receiptsPriceOnlyEnabled } from '@/lib/env';
import { getPlatformFeeCents } from '@/lib/pricing';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import {
  buildBackgroundRemovalPricingPreview,
  buildBackgroundRemovalRealtimeInput,
  resolveRealtimeSessionSeconds,
} from '@/lib/tools-background-removal';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
import { RESTRICTED_ACCOUNT_MESSAGE, getActiveAccountRestriction } from '@/server/fraud-cleanup';
import {
  BACKGROUND_REMOVAL_SURFACE,
  cloneBackgroundRemovalPricingWithDynamicTotal,
} from '@/server/tools/background-removal-request-utils';
import type {
  BackgroundRemovalRealtimeSessionRequest,
  BackgroundRemovalRealtimeSessionResponse,
} from '@/types/tools-background-removal';

type JsonError = {
  ok: false;
  error: {
    code: string;
    message: string;
    detail?: unknown;
  };
};

function jsonError(status: number, code: string, message: string, detail?: unknown) {
  return NextResponse.json<JsonError>(
    {
      ok: false,
      error: {
        code,
        message,
        detail,
      },
    },
    { status }
  );
}

function buildPricingSnapshot(params: {
  productSnapshot: Awaited<ReturnType<typeof computeBillingProductSnapshot>>;
  sessionSeconds: 30 | 60 | 120;
  billingProductKey: string;
  engineId: string;
}) {
  const preview = buildBackgroundRemovalPricingPreview({
    unitPriceCents: params.productSnapshot.totalCents,
    currency: params.productSnapshot.currency,
    durationSec: params.sessionSeconds,
  });
  const dynamicCents = Math.max(1, preview.totalCents ?? params.productSnapshot.totalCents);
  return cloneBackgroundRemovalPricingWithDynamicTotal(params.productSnapshot, dynamicCents, {
    pricingModel: 'dynamic-background-removal-realtime',
    surface: BACKGROUND_REMOVAL_SURFACE,
    billingProductKey: params.billingProductKey,
    engineId: params.engineId,
    sessionSeconds: params.sessionSeconds,
    providerEstimateUsd: preview.estimate?.providerEstimateUsd ?? null,
    dynamicMultiplier: BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER,
  });
}

async function recordRealtimeRefund(params: {
  userId: string;
  jobId: string;
  amountCents: number;
  currency: string;
  billingProductKey: string;
  pricingSnapshotJson: string;
  label: string;
}) {
  const priceOnly = receiptsPriceOnlyEnabled();
  await query(
    `INSERT INTO app_receipts (
       user_id,
       type,
       amount_cents,
       currency,
       description,
       job_id,
       surface,
       billing_product_key,
       pricing_snapshot,
       application_fee_cents,
       vendor_account_id,
       platform_revenue_cents,
       destination_acct
     )
     VALUES ($1,'refund',$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)
     ON CONFLICT DO NOTHING`,
    [
      params.userId,
      params.amountCents,
      params.currency,
      params.label,
      params.jobId,
      BACKGROUND_REMOVAL_SURFACE,
      params.billingProductKey,
      params.pricingSnapshotJson,
      priceOnly ? null : 0,
      null,
      priceOnly ? null : 0,
      null,
    ]
  );
}

export async function POST(req: NextRequest) {
  if (!FEATURES.workflows.toolsSection) {
    return jsonError(404, 'tools_disabled', 'Tools are currently disabled.');
  }

  let body: Partial<BackgroundRemovalRealtimeSessionRequest> | null = null;
  try {
    body = (await req.json()) as Partial<BackgroundRemovalRealtimeSessionRequest>;
  } catch {
    return jsonError(400, 'invalid_payload', 'Payload must be valid JSON.');
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return jsonError(401, 'auth_required', 'Authentication required.');
  }
  const restriction = await getActiveAccountRestriction(userId);
  if (restriction) {
    return jsonError(403, 'account_restricted', RESTRICTED_ACCOUNT_MESSAGE);
  }

  const engine = getBackgroundRemovalToolEngine(body?.engineId, 'realtime');
  if (body?.engineId && engine.id !== body.engineId) {
    return jsonError(400, 'invalid_engine', 'Selected engine does not support realtime background removal.');
  }

  const sessionSeconds = resolveRealtimeSessionSeconds(Number(body?.sessionSeconds));
  const realtimeInput = buildBackgroundRemovalRealtimeInput({
    backgroundType: body?.backgroundType,
    backgroundColor: body?.backgroundColor,
    blurStrength: typeof body?.blurStrength === 'number' ? body.blurStrength : null,
    backgroundImageUrl: body?.backgroundImageUrl,
  });
  const jobId = `tool_background_removal_realtime_${randomUUID()}`;
  const billingProductKey = engine.billingProductKey;
  const productSnapshot = await computeBillingProductSnapshot({
    productKey: billingProductKey,
    quantity: 1,
    engineId: engine.id,
  });
  const pricing = buildPricingSnapshot({
    productSnapshot,
    sessionSeconds,
    billingProductKey,
    engineId: engine.id,
  });
  const pricingSnapshotJson = JSON.stringify(pricing);
  const preferredCurrency = await getUserPreferredCurrency(userId);
  const priceOnly = receiptsPriceOnlyEnabled();
  const description = `${engine.label} ${sessionSeconds}s realtime background removal session`;

  try {
    await withDbTransaction(async (executor) => {
      await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [jobId]);
      const reserveResult = await reserveWalletChargeInExecutor(
        executor,
        {
          userId,
          amountCents: pricing.totalCents,
          currency: pricing.currency,
          description,
          jobId,
          surface: BACKGROUND_REMOVAL_SURFACE,
          billingProductKey,
          pricingSnapshotJson,
          applicationFeeCents: priceOnly ? null : getPlatformFeeCents(pricing),
          vendorAccountId: pricing.vendorAccountId ?? null,
          stripePaymentIntentId: null,
          stripeChargeId: null,
        },
        { preferredCurrency }
      );

      if (!reserveResult.ok) {
        if (reserveResult.errorCode === 'currency_mismatch') {
          const lockedCurrency = (reserveResult.preferredCurrency ?? 'usd').toUpperCase();
          throw Object.assign(new Error(`Wallet currency locked to ${lockedCurrency}. Contact support to request a change.`), {
            code: 'wallet_currency_mismatch',
            status: 409,
            detail: { lockedCurrency },
          });
        }
        throw Object.assign(new Error('Insufficient wallet balance for this realtime background removal session.'), {
          code: 'insufficient_wallet_funds',
          status: 402,
          detail: {
            balanceCents: reserveResult.balanceCents,
            requiredCents: Math.max(0, pricing.totalCents - reserveResult.balanceCents),
          },
        });
      }

      await executor.query(
        `INSERT INTO app_jobs (
           job_id,
           user_id,
           surface,
           billing_product_key,
           engine_id,
           engine_label,
           duration_sec,
           prompt,
           status,
           progress,
           final_price_cents,
           pricing_snapshot,
           settings_snapshot,
           currency,
           vendor_account_id,
           payment_status,
           visibility,
           indexable,
           provisional
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',0,$9,$10::jsonb,$11::jsonb,$12,$13,'paid_wallet','private',FALSE,TRUE)`,
        [
          jobId,
          userId,
          BACKGROUND_REMOVAL_SURFACE,
          billingProductKey,
          engine.id,
          engine.label,
          sessionSeconds,
          description,
          pricing.totalCents,
          pricingSnapshotJson,
          JSON.stringify({
            schemaVersion: 1,
            surface: BACKGROUND_REMOVAL_SURFACE,
            billingProductKey,
            engineId: engine.id,
            engineLabel: engine.label,
            inputMode: 'realtime',
            controls: realtimeInput,
            sessionSeconds,
          }),
          pricing.currency,
          pricing.vendorAccountId ?? null,
        ]
      );
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const code = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'realtime_session_error';
    const detail = (error as { detail?: unknown }).detail;
    const message = error instanceof Error ? error.message : 'Unable to start realtime background removal session.';
    return jsonError(status, code, message, detail);
  }

  const falApiKey = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
  if (!falApiKey) {
    await recordRealtimeRefund({
      userId,
      jobId,
      amountCents: pricing.totalCents,
      currency: pricing.currency,
      billingProductKey,
      pricingSnapshotJson,
      label: `Refund ${description}`,
    }).catch((error) => {
      console.warn('[tools/background-removal] failed to record realtime refund', error);
    });
    await query(
      `UPDATE app_jobs
          SET status = 'failed',
              progress = 0,
              payment_status = 'refunded_wallet',
              message = $2,
              provisional = FALSE,
              updated_at = NOW()
        WHERE job_id = $1`,
      [jobId, 'Fal realtime token configuration is missing.']
    ).catch((error) => {
      console.warn('[tools/background-removal] failed to mark realtime job failed', error);
    });
    return jsonError(500, 'fal_token_config_missing', 'Realtime token configuration is missing.');
  }

  const falTokenResponse = await fetch('https://rest.fal.ai/tokens/realtime', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${process.env.FAL_KEY ?? process.env.FAL_API_KEY}`,
    },
    body: JSON.stringify({
      allowed_apps: ['bria/video/background-removal/realtime'],
      duration: sessionSeconds + 15,
    }),
  }).catch((error) => {
    console.warn('[tools/background-removal] realtime token request failed', error);
    return null;
  });

  const tokenBody = (await falTokenResponse?.json().catch(() => null)) as
    | { token?: string; expires_in?: number; token_expiration_seconds?: number }
    | null;
  const token = typeof tokenBody?.token === 'string' ? tokenBody.token : null;
  if (!falTokenResponse?.ok || !token) {
    const message = 'Unable to create realtime background removal token.';
    await recordRealtimeRefund({
      userId,
      jobId,
      amountCents: pricing.totalCents,
      currency: pricing.currency,
      billingProductKey,
      pricingSnapshotJson,
      label: `Refund ${description}`,
    }).catch((error) => {
      console.warn('[tools/background-removal] failed to record realtime refund', error);
    });
    await query(
      `UPDATE app_jobs
          SET status = 'failed',
              progress = 0,
              payment_status = 'refunded_wallet',
              message = $2,
              provisional = FALSE,
              updated_at = NOW()
        WHERE job_id = $1`,
      [jobId, message]
    ).catch((error) => {
      console.warn('[tools/background-removal] failed to mark realtime job failed', error);
    });
    return jsonError(502, 'fal_token_failed', message, tokenBody);
  }

  await query(
    `UPDATE app_jobs
        SET status = 'completed',
            progress = 100,
            payment_status = 'paid_wallet',
            message = NULL,
            provisional = FALSE,
            updated_at = NOW()
      WHERE job_id = $1`,
    [jobId]
  ).catch((error) => {
    console.warn('[tools/background-removal] failed to mark realtime job completed', { jobId, error });
  });

  const tokenExpirationSeconds =
    typeof tokenBody.token_expiration_seconds === 'number'
      ? tokenBody.token_expiration_seconds
      : typeof tokenBody.expires_in === 'number'
        ? tokenBody.expires_in
        : sessionSeconds + 15;
  const chargedUsd = Number((pricing.totalCents / 100).toFixed(4));
  const response: BackgroundRemovalRealtimeSessionResponse = {
    ok: true,
    app: 'bria/video/background-removal/realtime',
    token,
    tokenExpirationSeconds,
    sessionSeconds,
    jobId,
    engineId: engine.id,
    engineLabel: engine.label,
    pricing: {
      estimatedCostUsd: chargedUsd,
      actualCostUsd: chargedUsd,
      currency: pricing.currency,
      estimatedCredits: Math.max(1, Math.round(chargedUsd * 100)),
      actualCredits: Math.max(1, Math.round(chargedUsd * 100)),
      totalCents: pricing.totalCents,
      billingProductKey,
      estimate: {
        durationSec: sessionSeconds,
        providerEstimateUsd:
          typeof pricing.meta?.providerEstimateUsd === 'number' ? pricing.meta.providerEstimateUsd : null,
      },
    },
    realtimeInput,
  };

  return NextResponse.json(response);
}
