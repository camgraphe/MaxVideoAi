import { normalizeMediaUrl, isPlaceholderMediaUrl } from '@/lib/media';
import {
  coerceNumber,
  findFirstTextByKeys,
  normalizeAuditText,
  normalizeCurrency,
  normalizeReceipts,
} from './normalizers';
import { deriveOutcome, isRefundedJob } from './outcomes';
import type { AdminJobAuditRecord, RawJobAuditRow } from './types';

const ARCHIVE_THRESHOLD_MS = 30 * 60 * 1000;

export function normalizeTimeline(
  falEventsRaw: RawJobAuditRow['fal_events'],
  receipts: AdminJobAuditRecord['receipts']
): AdminJobAuditRecord['timeline'] {
  const falEvents: AdminJobAuditRecord['timeline'] = Array.isArray(falEventsRaw)
    ? falEventsRaw
        .map((event) => {
          const falStatus = normalizeAuditText(event.status) ?? 'event';
          const summary =
            normalizeAuditText(event.summary) ??
            normalizeAuditText(findFirstTextByKeys(event, ['reason', 'message', 'note'])) ??
            `Fal ${falStatus}`;
          const details = normalizeAuditText(event.origin) ?? null;
          return {
            at: event.createdAt,
            source: 'fal' as const,
            kind: falStatus.toLowerCase(),
            summary,
            details,
          };
        })
        .filter((event) => Boolean(event.at))
    : [];

  const paymentEvents: AdminJobAuditRecord['timeline'] = receipts.map((receipt) => ({
    at: receipt.createdAt,
    source: 'payment' as const,
    kind: receipt.type,
    summary: `${receipt.type} ${receipt.amountCents / 100} ${receipt.currency}`,
    details: `Receipt #${receipt.id}`,
  }));

  return [...falEvents, ...paymentEvents]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);
}

export function mapJobAuditRow(row: RawJobAuditRow, now = Date.now()): AdminJobAuditRecord {
  const finalPrice = coerceNumber(row.final_price_cents);
  const totalCharge = coerceNumber(row.total_charge_cents);
  const totalRefund = coerceNumber(row.total_refund_cents);
  const netCharge = totalCharge - totalRefund;
  const currency = normalizeCurrency(row.currency);
  const paymentStatus = row.payment_status ?? '';
  const refunded = isRefundedJob({
    paymentStatus: row.payment_status,
    totalRefundCents: totalRefund,
    refundCount: row.refund_count ?? 0,
  });
  const outcome = deriveOutcome(row.status, refunded);

  const paymentOk =
    paymentStatus.includes('refunded') || refunded ? netCharge <= 0 : finalPrice === netCharge;

  const falStatus = row.fal_status;
  const falOk = !falStatus || falStatus.toUpperCase() === 'COMPLETED' || outcome === 'refunded_failure_resolved';

  const updatedAtDate = new Date(row.updated_at);
  const archived =
    outcome === 'failed_action_required' &&
    !Number.isNaN(updatedAtDate.getTime()) &&
    now - updatedAtDate.getTime() >= ARCHIVE_THRESHOLD_MS;

  const surface = normalizeAuditText(row.surface);
  const videoUrl = row.video_url ? normalizeMediaUrl(row.video_url) ?? row.video_url : null;
  const thumbUrl = row.thumb_url ? normalizeMediaUrl(row.thumb_url) ?? row.thumb_url : null;
  const heroRenderId = row.hero_render_id ? normalizeMediaUrl(row.hero_render_id) ?? row.hero_render_id : null;
  const renderCount = row.render_count ?? 0;
  const imageLikeSurface = surface === 'image' || surface === 'character' || surface === 'angle';
  const placeholderVideo = isPlaceholderMediaUrl(videoUrl);
  const outputUrl = imageLikeSurface ? heroRenderId ?? thumbUrl : videoUrl;
  const placeholderOutput = imageLikeSurface ? false : placeholderVideo;
  const displayOk = imageLikeSurface
    ? Boolean(heroRenderId) || renderCount > 0 || Boolean(thumbUrl)
    : Boolean(videoUrl) && !placeholderVideo;
  const receipts = normalizeReceipts(row.receipts);

  const failureReason =
    outcome === 'failed_action_required' || outcome === 'refunded_failure_resolved'
      ? normalizeAuditText(
          findFirstTextByKeys(row.fal_failure_payload, [
            'reason',
            'message',
            'note',
            'error',
            'error_message',
            'status_message',
            'falError',
            'detail',
          ])
        ) ?? normalizeAuditText(row.message)
      : null;
  const failureOrigin =
    normalizeAuditText(
      findFirstTextByKeys(row.latest_refund_metadata, ['failure_origin', 'failureOrigin'])
    ) ??
    normalizeAuditText(
      findFirstTextByKeys(row.fal_failure_payload, ['failure_origin', 'failureOrigin'])
    ) ??
    null;
  const refundReason =
    normalizeAuditText(
      findFirstTextByKeys(row.latest_refund_metadata, ['note', 'reason', 'message'])
    ) ?? null;

  const failureAt = row.fal_failure_created_at ?? (outcome === 'failed_action_required' ? row.updated_at : null);
  const timeline = normalizeTimeline(row.fal_events, receipts);

  return {
    id: row.id,
    jobId: row.job_id,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hiddenByUser: row.hidden === true,
    status: row.status,
    progress: row.progress,
    message: row.message,
    paymentStatus: row.payment_status,
    finalPriceCents: finalPrice,
    currency,
    surface,
    videoUrl,
    thumbUrl,
    heroRenderId,
    renderCount,
    engineLabel: row.engine_label,
    durationSec: row.duration_sec,
    providerJobId: row.provider_job_id,
    totalChargeCents: totalCharge,
    totalRefundCents: totalRefund,
    chargeCount: row.charge_count ?? 0,
    refundCount: row.refund_count ?? 0,
    receipts,
    falStatus,
    falUpdatedAt: row.fal_created_at,
    outcome,
    failureReason,
    failureOrigin,
    failureAt,
    isRefunded: refunded,
    refundAt: row.latest_refund_created_at,
    refundReason,
    falLogCount: row.fal_log_count ?? 0,
    timeline,
    outputUrl,
    hasOutput: displayOk,
    isPlaceholderOutput: placeholderOutput,
    netChargeCents: netCharge,
    paymentOk,
    falOk,
    archived,
  };
}
