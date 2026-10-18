import { dispatchAnalyticsEvent } from '@/lib/analytics-client';

export function trackComparison(payload: {
  action: 'copy_comparison' | 'copy_link' | 'model_change' | 'details_open' | 'video_play';
  locale: string; engine?: string; section?: string;
}) {
  const context = typeof document !== 'undefined' ? document.getElementById('comparison-detail')?.dataset : undefined;
  dispatchAnalyticsEvent('comparison_interaction', { route_family: 'compare', ...payload, model_left: context?.modelLeft, model_right: context?.modelRight });
}
