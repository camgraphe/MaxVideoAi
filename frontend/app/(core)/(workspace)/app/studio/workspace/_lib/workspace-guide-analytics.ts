import { dispatchAnalyticsEvent } from '@/lib/analytics-client';
import type { AppLocale } from '@/i18n/locales';
import type {
  WorkspaceGuideStepId,
  WorkspaceProjectStarterTemplateId,
} from './workspace-types';

export type WorkspaceGuideAnalyticsEvent =
  | 'studio_guided_template_started'
  | 'studio_guide_step_focused'
  | 'studio_guide_hidden'
  | 'studio_guide_annotation_deleted'
  | 'studio_guide_all_deleted'
  | 'studio_guide_reset'
  | 'studio_first_generation_completed'
  | 'studio_first_timeline_insert_completed';

export type WorkspaceGuideViewportClass = 'mobile' | 'compact' | 'desktop';

export type WorkspaceGuideAnalyticsInput = {
  templateId: WorkspaceProjectStarterTemplateId;
  stepId: WorkspaceGuideStepId | 'all';
  elapsedMs: number;
  locale: AppLocale;
  viewportClass: WorkspaceGuideViewportClass;
};

export function workspaceGuideViewportClass(viewportWidth: number): WorkspaceGuideViewportClass {
  if (viewportWidth <= 480) return 'mobile';
  if (viewportWidth <= 1120) return 'compact';
  return 'desktop';
}

export function workspaceGuideAnalyticsPayload(
  input: WorkspaceGuideAnalyticsInput
): Record<string, string | number> {
  return {
    template_id: input.templateId,
    step_id: input.stepId,
    locale: input.locale,
    elapsed_ms: Number.isFinite(input.elapsedMs) ? Math.max(0, Math.round(input.elapsedMs)) : 0,
    viewport_class: input.viewportClass,
  };
}

export function dispatchWorkspaceGuideAnalytics(
  event: WorkspaceGuideAnalyticsEvent,
  input: WorkspaceGuideAnalyticsInput
): void {
  dispatchAnalyticsEvent(event, workspaceGuideAnalyticsPayload(input));
}
