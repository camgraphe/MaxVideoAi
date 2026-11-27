import { getGenerationFailureFallbackMessage, getKnownGenerationFailureMessage } from '@/lib/generation-failure-messages';
import { isPurchaseRoutingEngine } from '@/lib/video-purchase-decision';
import * as videoFailureCodes from '@/lib/video-failure-codes';
import { customerPricingSnapshot } from '@/lib/customer-pricing-snapshot';

// These responses may be built from a current submission, an idempotency hit or a terminal job recovered from SQL.
const publicFields = [
  'ok', 'jobId', 'status', 'progress', 'deferred', 'videoUrl', 'thumbUrl', 'paymentStatus', 'currency',
  'batchId', 'groupId', 'iterationIndex', 'iterationCount', 'heroRenderId', 'localKey', 'etaSeconds', 'etaLabel',
  'requiredCents', 'balanceCents', 'refundedAmountCents', 'field', 'value', 'durationSec', 'maxDurationSec',
] as const;
const transportName = /(?:\b(?:apimart|wavespeed|dashscope|alibaba|fal(?:\.ai)?|byteplus|modelark|vertex|provider|purchase)(?:\b|_)|kling[ _-]?direct|supplier cost)/i;
const upstreamCode = /^(?:Arrearage|PrepaidBillOverdue|InsufficientBalance|INSUFFICIENT_BALANCE|Throttling\.|SUBMISSION_UNCONFIRMED|NO_ELIGIBLE_VIDEO_PROVIDER)|^(?:APIMART|FAL|ALIBABA|BYTEPLUS|KLING_DIRECT|GOOGLE_VERTEX|LUMA_AGENTS)_/i;

const knownFailures = new Set<string>(Object.values(videoFailureCodes).filter(value => typeof value === 'string'));
const customerErrorCodes = new Set(['CONTENT_FLAGGED', 'CONTENT_POLICY_VIOLATION', 'POLICY_VIOLATION', 'SAFETY', 'RATE_LIMITED', 'IMAGE_UNREACHABLE']);

const pendingSubmission = new Set(['SUBMISSION_UNCONFIRMED', 'BYTEPLUS_SUBMISSION_UNCERTAIN', 'BYTEPLUS_RECONCILIATION_PENDING', 'SEEDANCE_WORKFLOW_SUBMISSION_UNCERTAIN']);
const checkingMessage = 'This generation is being checked. Do not submit it again.';

function scalar(value: unknown): boolean {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function customerGenerationResponse(
  body: Record<string, unknown>,
  engineId: unknown,
  origin?: 'submission',
  storedEngineId?: unknown,
): Record<string, unknown> {
  if (!isPurchaseRoutingEngine(engineId) && !isPurchaseRoutingEngine(storedEngineId)) return body;
  const result: Record<string, unknown> = {};
  for (const key of publicFields) if (scalar(body[key])) result[key] = body[key];
  for (const key of ['renderIds', 'renderThumbUrls', 'allowed']) {
    if (Array.isArray(body[key])) result[key] = body[key].filter(scalar);
    else if (body[key] === null) result[key] = null;
  }
  if (body.video && typeof body.video === 'object') {
    const src = body.video as Record<string, unknown>;
    const asset: Record<string, unknown> = {};
    for (const key of ['url', 'mime', 'width', 'height', 'durationSec', 'aspectRatio', 'thumbnailUrl']) {
      if (scalar(src[key])) asset[key] = src[key];
    }
    // The upstream can put arbitrary diagnostics in video tags.
    asset.tags = [];
    result.video = asset;
  } else if (body.video === null) result.video = null;
  const pricing = customerPricingSnapshot(body.pricing);
  if (pricing) result.pricing = pricing;

  const error = typeof body.error === 'string' ? body.error : undefined;
  const failureCode = typeof body.failureCode === 'string' && knownFailures.has(body.failureCode) ? body.failureCode : undefined;
  if (failureCode) result.failureCode = failureCode;
  const message = typeof body.message === 'string' ? body.message : undefined;
  const privateError = Boolean(error && (upstreamCode.test(error) || transportName.test(error)));
  if (error && pendingSubmission.has(error)) {
    result.error = error === 'SEEDANCE_WORKFLOW_SUBMISSION_UNCERTAIN' ? error : 'GENERATION_PENDING';
    result.message = checkingMessage;
  } else if (error === 'KLING_DIRECT_CONTROLS_UNAVAILABLE') {
    result.error = 'CONTROLS_UNAVAILABLE';
    result.message = 'The selected controls are currently unavailable. Remove them to generate this video.';
  } else if (error === 'BYTEPLUS_LAS_WALLET_REQUIRED') {
    result.error = 'WALLET_REQUIRED';
    result.message = 'Use your wallet for this generation.';
  } else if (origin === 'submission' || privateError) {
    result.error = error && customerErrorCodes.has(error) ? error : 'GENERATION_UNAVAILABLE';
    result.message = getKnownGenerationFailureMessage({ failureCode, message }) ?? getGenerationFailureFallbackMessage();
  } else if (body.ok === true) {
    if (message) {
      if (body.status === 'failed') result.message = getKnownGenerationFailureMessage({ failureCode, message }) ?? getGenerationFailureFallbackMessage();
      else if (body.deferred || body.status === 'provider_polling_stalled') result.message = checkingMessage;
      else if (body.status === 'completed') result.message = 'Your generation is ready.';
      else result.message = 'Your generation is being processed.';
    } else if (body.message === null) result.message = null;
  } else {
    if (error) result.error = error;
    if (message) result.message = transportName.test(message) ? 'This generation is unavailable.' : message;
  }
  return result;
}
