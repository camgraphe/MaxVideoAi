const GA4_MAX_EVENT_PARAMS = 25;
// Transport, commerce, source and milestone evidence precede optional diagnostics.
const GA4_PARAM_PRIORITY = [
  'session_id', 'engagement_time_msec', 'transaction_id', 'value', 'currency',
  'is_first_recorded_external_payment', 'payment_provider', 'payment_flow', 'item_category',
  'journey_id', 'acquisition_cohort', 'first_touch_source', 'first_touch_medium',
  'first_touch_campaign', 'first_touch_content', 'last_touch_source', 'last_touch_medium',
  'last_touch_campaign', 'last_touch_content', 'is_first_wallet_topup', 'funnel_stage',
  'route_family', 'workspace_section', 'generation_sequence', 'is_first_generation',
  'job_id', 'completion_source', 'tool_name', 'tool_surface', 'result_count', 'output_count',
  'cta_name', 'cta_location', 'target_family', 'topup_amount_cents', 'settlement_currency',
  'topup_tier_id', 'settlement_amount_minor',
] as const;

export function boundGa4EventParams<T>(params: Record<string, T>): Record<string, T> {
  const bounded: Record<string, T> = {};
  for (const key of [...GA4_PARAM_PRIORITY, ...Object.keys(params)]) {
    if (Object.keys(bounded).length >= GA4_MAX_EVENT_PARAMS) break;
    if (Object.hasOwn(params, key)) bounded[key] = params[key];
  }
  return bounded;
}
