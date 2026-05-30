import assert from 'node:assert/strict';
import test from 'node:test';

import { formatCursorValue, parseCursorParam } from '../frontend/server/admin-job-audit/cursor';
import { mapJobAuditRow } from '../frontend/server/admin-job-audit/mapper';
import { buildJobAuditWhereClause } from '../frontend/server/admin-job-audit/query-builder';
import {
  buildOutcomeSqlCondition,
  deriveOutcome,
  normalizeOutcomeFilter,
} from '../frontend/server/admin-job-audit/outcomes';
import type { RawJobAuditRow } from '../frontend/server/admin-job-audit/types';

function buildRawJobAuditRow(overrides: Partial<RawJobAuditRow> = {}): RawJobAuditRow {
  return {
    id: 100,
    job_id: 'job_100',
    user_id: 'user_1',
    created_at: '2026-05-09T00:00:00.000Z',
    updated_at: '2026-05-09T00:00:00.000Z',
    hidden: false,
    status: 'completed',
    progress: 100,
    message: null,
    payment_status: 'paid',
    final_price_cents: 500,
    currency: 'usd',
    surface: 'video',
    video_url: 'https://cdn.example.com/render.mp4',
    thumb_url: 'https://cdn.example.com/thumb.webp',
    hero_render_id: null,
    render_count: 0,
    engine_label: 'Veo',
    duration_sec: 8,
    provider_job_id: 'fal_100',
    total_charge_cents: 500,
    total_refund_cents: 0,
    charge_count: 1,
    refund_count: 0,
    receipts: [
      {
        id: 1,
        type: 'charge',
        amountCents: 500,
        currency: 'usd',
        createdAt: '2026-05-09T00:01:00.000Z',
      },
    ],
    fal_status: 'COMPLETED',
    fal_created_at: '2026-05-09T00:02:00.000Z',
    fal_failure_status: null,
    fal_failure_created_at: null,
    fal_failure_payload: null,
    fal_log_count: 2,
    latest_refund_created_at: null,
    latest_refund_metadata: null,
    fal_events: [
      {
        createdAt: '2026-05-09T00:02:00.000Z',
        status: 'COMPLETED',
        summary: 'Done',
        origin: 'fal',
      },
    ],
    ...overrides,
  };
}

test('admin job audit outcome helpers classify filters and SQL conditions', () => {
  assert.equal(deriveOutcome('failed', false), 'failed_action_required');
  assert.equal(deriveOutcome('failed', true), 'refunded_failure_resolved');
  assert.equal(deriveOutcome('completed', false), 'completed');
  assert.equal(deriveOutcome('running', false), 'in_progress');
  assert.equal(deriveOutcome('needs_review', false), 'unknown');

  assert.equal(normalizeOutcomeFilter(' COMPLETED '), 'completed');
  assert.equal(normalizeOutcomeFilter('nope'), null);

  assert.match(buildOutcomeSqlCondition('failed_action_required'), /AND NOT/);
  assert.match(buildOutcomeSqlCondition('refunded_failure_resolved'), /refund_count/);
  assert.match(buildOutcomeSqlCondition('completed'), /completed/);
  assert.match(buildOutcomeSqlCondition('unknown'), /^NOT \(/);
});

test('admin job audit cursor helpers preserve legacy and compound cursor formats', () => {
  assert.deepEqual(parseCursorParam(null), { createdAt: null, id: null });
  assert.deepEqual(parseCursorParam('42'), { createdAt: null, id: 42 });

  const compound = parseCursorParam('2026-05-09T00:00:00.000Z|123');
  assert.equal(compound.createdAt?.toISOString(), '2026-05-09T00:00:00.000Z');
  assert.equal(compound.id, 123);

  assert.equal(formatCursorValue({ created_at: '2026-05-09T00:00:00.000Z', id: 123 }), '2026-05-09T00:00:00.000Z|123');
  assert.equal(formatCursorValue({ created_at: 'bad-date', id: 123 }), '123');
});

test('admin job audit query builder preserves filter and cursor parameter ordering', () => {
  const from = new Date('2026-05-01T00:00:00.000Z');
  const to = new Date('2026-05-09T00:00:00.000Z');
  const cursor = '2026-05-08T00:00:00.000Z|77';
  const result = buildJobAuditWhereClause({
    jobId: ' job ',
    userId: ' user ',
    engineId: ' veo ',
    status: ' FAILED ',
    outcome: 'failed_action_required',
    from,
    to,
    cursor,
  });

  assert.deepEqual(result.params, ['%job%', '%user%', '%veo%', 'failed', from, to, new Date('2026-05-08T00:00:00.000Z'), 77]);
  assert.match(result.whereClause, /j\.job_id ILIKE \$1/);
  assert.match(result.whereClause, /j\.user_id::text ILIKE \$2/);
  assert.match(result.whereClause, /j\.engine_id ILIKE \$3 OR j\.engine_label ILIKE \$3/);
  assert.match(result.whereClause, /LOWER\(j\.status\) = \$4/);
  assert.match(result.whereClause, /\(j\.created_at, j\.id\) < \(\$7, \$8\)/);
});

test('admin job audit mapper derives failure, output, payment, and timeline state', () => {
  const record = mapJobAuditRow(
    buildRawJobAuditRow({
      status: 'failed',
      updated_at: '2026-05-09T00:20:00.000Z',
      message: 'fallback failure',
      video_url: '/assets/gallery/placeholder.mp4',
      fal_status: 'FAILED',
      fal_failure_created_at: '2026-05-09T00:22:00.000Z',
      fal_failure_payload: {
        nested: {
          error_message: 'Provider timed out',
          failure_origin: 'fal',
        },
      },
      fal_events: [
        {
          createdAt: '2026-05-09T00:22:00.000Z',
          status: 'failed',
          summary: null,
          origin: 'fal',
        },
      ],
    }),
    Date.parse('2026-05-09T00:51:00.000Z')
  );

  assert.equal(record.outcome, 'failed_action_required');
  assert.equal(record.failureReason, 'Provider timed out');
  assert.equal(record.failureOrigin, 'fal');
  assert.equal(record.archived, true);
  assert.equal(record.hasOutput, false);
  assert.equal(record.isPlaceholderOutput, true);
  assert.equal(record.paymentOk, true);
  assert.equal(record.falOk, false);
  assert.equal(record.timeline[0]?.source, 'fal');
  assert.equal(record.timeline[1]?.source, 'payment');
});

test('admin job audit mapper handles refunded failures and image outputs', () => {
  const refunded = mapJobAuditRow(
    buildRawJobAuditRow({
      status: 'failed',
      payment_status: 'refunded',
      total_refund_cents: 500,
      refund_count: 1,
      fal_status: 'FAILED',
      latest_refund_created_at: '2026-05-09T00:05:00.000Z',
      latest_refund_metadata: {
        note: 'Auto refund',
        failure_origin: 'wallet',
      },
    })
  );

  assert.equal(refunded.outcome, 'refunded_failure_resolved');
  assert.equal(refunded.isRefunded, true);
  assert.equal(refunded.paymentOk, true);
  assert.equal(refunded.falOk, true);
  assert.equal(refunded.refundReason, 'Auto refund');
  assert.equal(refunded.failureOrigin, 'wallet');

  const image = mapJobAuditRow(
    buildRawJobAuditRow({
      surface: 'image',
      video_url: null,
      thumb_url: 'image-thumb.webp',
      hero_render_id: 'render.png',
      render_count: 1,
    })
  );

  assert.equal(image.outputUrl, '/render.png');
  assert.equal(image.hasOutput, true);
  assert.equal(image.isPlaceholderOutput, false);
});

test('admin job audit mapper exposes user-hidden jobs as an explicit opt-out', () => {
  const visible = mapJobAuditRow(buildRawJobAuditRow({ hidden: false }));
  const hidden = mapJobAuditRow(buildRawJobAuditRow({ hidden: true }));

  assert.equal(visible.hiddenByUser, false);
  assert.equal(hidden.hiddenByUser, true);
});
