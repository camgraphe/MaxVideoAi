export type AdminJobOutcome =
  | 'failed_action_required'
  | 'refunded_failure_resolved'
  | 'completed'
  | 'in_progress'
  | 'unknown';

export type AdminJobAuditTimelineEvent = {
  at: string;
  source: 'fal' | 'payment';
  kind: string;
  summary: string;
  details: string | null;
};

export type RawJobAuditRow = {
  id: number;
  job_id: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  status: string | null;
  progress: number | null;
  message: string | null;
  payment_status: string | null;
  final_price_cents: number | string | null;
  currency: string | null;
  surface: string | null;
  video_url: string | null;
  thumb_url: string | null;
  hero_render_id: string | null;
  render_count: number | null;
  engine_label: string | null;
  duration_sec: number | null;
  provider_job_id: string | null;
  total_charge_cents: number | string | null;
  total_refund_cents: number | string | null;
  charge_count: number | null;
  refund_count: number | null;
  receipts: Array<{
    id: number;
    type: string;
    amountCents: number;
    currency: string;
    createdAt: string;
  }> | null;
  fal_status: string | null;
  fal_created_at: string | null;
  fal_failure_status: string | null;
  fal_failure_created_at: string | null;
  fal_failure_payload: unknown;
  fal_log_count: number | null;
  latest_refund_created_at: string | null;
  latest_refund_metadata: unknown;
  fal_events: Array<{
    createdAt: string;
    status: string | null;
    summary: string | null;
    origin: string | null;
  }> | null;
};

export type AdminJobAuditRecord = {
  id: number;
  jobId: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  status: string | null;
  progress: number | null;
  message: string | null;
  paymentStatus: string | null;
  finalPriceCents: number;
  currency: string;
  surface: string | null;
  videoUrl: string | null;
  thumbUrl: string | null;
  heroRenderId: string | null;
  renderCount: number;
  engineLabel: string | null;
  durationSec: number | null;
  providerJobId: string | null;
  totalChargeCents: number;
  totalRefundCents: number;
  chargeCount: number;
  refundCount: number;
  receipts: Array<{
    id: number;
    type: 'topup' | 'charge' | 'refund' | 'discount' | 'tax';
    amountCents: number;
    currency: string;
    createdAt: string;
  }>;
  falStatus: string | null;
  falUpdatedAt: string | null;
  outcome: AdminJobOutcome;
  failureReason: string | null;
  failureOrigin: string | null;
  failureAt: string | null;
  isRefunded: boolean;
  refundAt: string | null;
  refundReason: string | null;
  falLogCount: number;
  timeline: AdminJobAuditTimelineEvent[];
  outputUrl: string | null;
  hasOutput: boolean;
  isPlaceholderOutput: boolean;
  netChargeCents: number;
  paymentOk: boolean;
  falOk: boolean;
  archived: boolean;
};

export type FetchJobAuditFilters = {
  jobId?: string | null;
  userId?: string | null;
  engineId?: string | null;
  status?: string | null;
  outcome?: string | null;
  from?: Date | null;
  to?: Date | null;
};

export type FetchJobAuditParams = FetchJobAuditFilters & {
  limit?: number;
  cursor?: string | null;
};

export type FetchJobAuditResult = {
  jobs: AdminJobAuditRecord[];
  nextCursor: string | null;
};
