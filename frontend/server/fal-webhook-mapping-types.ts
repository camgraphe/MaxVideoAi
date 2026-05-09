export type FalWebhookPayload = {
  request_id?: string;
  requestId?: string;
  status?: string;
  response?: unknown;
  data?: unknown;
  result?: unknown;
  error?: unknown;
  auto_refund_eligible?: boolean;
  autoRefundEligible?: boolean;
  failure_origin?: string;
  failureOrigin?: string;
};

export type WebhookIdentifiers = {
  jobId?: string | null;
  localKey?: string | null;
};
