'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  clearPendingAnalyticsEvent,
  readPendingAnalyticsEvent,
  type AnalyticsClientEventDetail,
  type AnalyticsPayload,
} from '@/lib/analytics-client';
import { hasAnalyticsConsentInBrowser } from '@/lib/analytics/consent-client';
import { mergeRequestGenerationFailureContext } from '@/lib/analytics/generation-correlation';
import {
  clearBrowserAnalyticsState,
  prepareBrowserAnalyticsEvents,
} from '@/lib/analytics/journey-browser';
import { sendPreparedAnalyticsEvents } from '@/lib/analytics/ordered-events';
import { getAnalyticsRouteContext } from '@/lib/analytics-route';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type QueuedEvent = {
  event: string;
  payload?: AnalyticsPayload;
};

type JobStatusDetail = {
  jobId?: string | null;
  status?: 'pending' | 'completed' | 'failed' | null;
  progress?: number | null;
  finalPriceCents?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  batchId?: string | null;
  groupId?: string | null;
  iterationIndex?: number | null;
  iterationCount?: number | null;
  renderIds?: string[] | null;
  localKey?: string | null;
  message?: string | null;
};

const WORKSPACE_ROUTE_FAMILIES = new Set(['workspace', 'app_tools', 'billing'] as const);

function isPendingAuthFlushFamily(
  family: ReturnType<typeof getAnalyticsRouteContext>['family']
): family is 'workspace' | 'app_tools' | 'billing' {
  return WORKSPACE_ROUTE_FAMILIES.has(family as 'workspace' | 'app_tools' | 'billing');
}

function isGaPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function sanitizePayload(payload: AnalyticsPayload | undefined): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (!payload) return params;
  for (const [key, value] of Object.entries(payload)) {
    if (!value && value !== 0 && value !== false) continue;
    if (!isGaPrimitive(value)) continue;
    params[key] = typeof value === 'string' ? value.slice(0, 100) : value;
  }
  return params;
}

export function GA4EventBridge() {
  const pathname = usePathname();
  const routeContext = getAnalyticsRouteContext(pathname);
  const queuedEventsRef = useRef<QueuedEvent[]>([]);
  const generationContextByLocalKeyRef = useRef(new Map<string, AnalyticsPayload>());
  const generationContextByJobIdRef = useRef(new Map<string, AnalyticsPayload>());
  const seenTerminalEventsRef = useRef(new Set<string>());

  const clearQueuedAnalytics = useCallback(() => {
    queuedEventsRef.current = [];
    generationContextByLocalKeyRef.current.clear();
    generationContextByJobIdRef.current.clear();
    seenTerminalEventsRef.current.clear();
  }, []);

  const flushQueue = useCallback(() => {
    if (routeContext.excludedFromGa4) {
      queuedEventsRef.current = [];
      return;
    }
    if (!hasAnalyticsConsentInBrowser()) {
      clearQueuedAnalytics();
      clearBrowserAnalyticsState();
      return;
    }

    const gtag = window.gtag;
    if (typeof gtag !== 'function') return;

    const queuedEvents = queuedEventsRef.current;
    const sanitizedEvents = queuedEvents.map(({ event, payload }) => ({
      event,
      payload: sanitizePayload(payload),
    }));
    const unsentIndex = sendPreparedAnalyticsEvents(gtag, sanitizedEvents);
    queuedEventsRef.current = queuedEvents.slice(unsentIndex);
  }, [clearQueuedAnalytics, routeContext.excludedFromGa4]);

  const enqueueEvent = useCallback(
    (event: string, payload?: AnalyticsPayload) => {
      const defaultPayload: AnalyticsPayload = payload?.route_family
        ? payload
        : {
            route_family: routeContext.family,
            ...payload,
          };
      const preparedEvents = prepareBrowserAnalyticsEvents(event, defaultPayload);
      if (preparedEvents.length === 0) return undefined;
      queuedEventsRef.current.push(...preparedEvents);
      flushQueue();
      return preparedEvents.at(-1)?.payload;
    },
    [flushQueue, routeContext.family]
  );

  useEffect(() => {
    if (routeContext.excludedFromGa4) return;

    const handleAnalyticsEvent = (event: Event) => {
      const detail = (event as CustomEvent<AnalyticsClientEventDetail>).detail;
      const eventName = typeof detail?.event === 'string' ? detail.event : '';
      if (!eventName) return;
      const eventPayload = detail?.payload && typeof detail.payload === 'object' ? detail.payload : undefined;
      const payload = eventName === 'generation_failed' && eventPayload
        ? mergeRequestGenerationFailureContext({
            payload: eventPayload,
            generationContextByLocalKey: generationContextByLocalKeyRef.current,
          })
        : eventPayload;

      const preparedPayload = enqueueEvent(eventName, payload);
      if (eventName === 'generation_started') {
        const localKey = typeof preparedPayload?.local_key === 'string' ? preparedPayload.local_key : null;
        if (localKey) {
          generationContextByLocalKeyRef.current.set(localKey, preparedPayload ?? {});
        }
      }
    };

    const handleJobsStatus = (event: Event) => {
      const detail = (event as CustomEvent<JobStatusDetail>).detail;
      const jobId = typeof detail?.jobId === 'string' ? detail.jobId : null;
      const localKey = typeof detail?.localKey === 'string' ? detail.localKey : null;

      if (jobId && localKey) {
        const pendingContext = generationContextByLocalKeyRef.current.get(localKey);
        if (pendingContext) {
          generationContextByJobIdRef.current.set(jobId, pendingContext);
        }
      }

      if (!jobId || !detail?.status || detail.status === 'pending') {
        return;
      }

      const seenKey = `${jobId}:${detail.status}`;
      if (seenTerminalEventsRef.current.has(seenKey)) {
        return;
      }
      seenTerminalEventsRef.current.add(seenKey);

      const generationContext =
        generationContextByJobIdRef.current.get(jobId) ??
        (localKey ? generationContextByLocalKeyRef.current.get(localKey) : undefined) ??
        {};

      if (detail.status === 'completed') {
        enqueueEvent('generation_completed', {
          ...generationContext,
          job_id: jobId,
          final_price_cents:
            typeof detail.finalPriceCents === 'number' && Number.isFinite(detail.finalPriceCents)
              ? detail.finalPriceCents
              : undefined,
          currency: typeof detail.currency === 'string' ? detail.currency : undefined,
          payment_status: typeof detail.paymentStatus === 'string' ? detail.paymentStatus : undefined,
          batch_id: typeof detail.batchId === 'string' ? detail.batchId : undefined,
          group_id: typeof detail.groupId === 'string' ? detail.groupId : undefined,
          iteration_index:
            typeof detail.iterationIndex === 'number' && Number.isFinite(detail.iterationIndex)
              ? detail.iterationIndex
              : undefined,
          iteration_count:
            typeof detail.iterationCount === 'number' && Number.isFinite(detail.iterationCount)
              ? detail.iterationCount
              : undefined,
          render_count: Array.isArray(detail.renderIds) ? detail.renderIds.length : undefined,
        });
        return;
      }

      enqueueEvent('generation_failed', {
        ...generationContext,
        job_id: jobId,
        failure_category: 'job_failed',
        payment_status: typeof detail.paymentStatus === 'string' ? detail.paymentStatus : undefined,
        batch_id: typeof detail.batchId === 'string' ? detail.batchId : undefined,
        group_id: typeof detail.groupId === 'string' ? detail.groupId : undefined,
      });
    };

    const handleTrackedClick = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-analytics-event]') : null;
      if (!target) return;

      const eventName = target.dataset.analyticsEvent?.trim();
      if (!eventName) return;

      const payload: AnalyticsPayload = {
        route_family: routeContext.family,
      };

      if (target.dataset.analyticsCtaName) {
        payload.cta_name = target.dataset.analyticsCtaName;
      }
      if (target.dataset.analyticsCtaLocation) {
        payload.cta_location = target.dataset.analyticsCtaLocation;
      }
      if (target.dataset.analyticsTargetFamily) {
        payload.target_family = target.dataset.analyticsTargetFamily;
      }
      if (target.dataset.analyticsToolName) {
        payload.tool_name = target.dataset.analyticsToolName;
      }
      if (target.dataset.analyticsToolSurface) {
        payload.tool_surface = target.dataset.analyticsToolSurface;
      }

      enqueueEvent(eventName, payload);
    };

    window.addEventListener('mvai:analytics', handleAnalyticsEvent as EventListener);
    window.addEventListener('jobs:status', handleJobsStatus as EventListener);
    document.addEventListener('click', handleTrackedClick, true);
    return () => {
      window.removeEventListener('mvai:analytics', handleAnalyticsEvent as EventListener);
      window.removeEventListener('jobs:status', handleJobsStatus as EventListener);
      document.removeEventListener('click', handleTrackedClick, true);
    };
  }, [enqueueEvent, routeContext.excludedFromGa4, routeContext.family]);

  useEffect(() => {
    const handleConsentUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ categories?: { analytics?: boolean } }>).detail;
      const analyticsGranted = typeof detail?.categories?.analytics === 'boolean'
        ? detail.categories.analytics
        : hasAnalyticsConsentInBrowser();
      if (analyticsGranted) return;
      clearQueuedAnalytics();
      clearBrowserAnalyticsState();
    };

    window.addEventListener('consent:updated', handleConsentUpdated as EventListener);
    return () => {
      window.removeEventListener('consent:updated', handleConsentUpdated as EventListener);
    };
  }, [clearQueuedAnalytics]);

  useEffect(() => {
    if (!isPendingAuthFlushFamily(routeContext.family)) return;
    const pending = readPendingAnalyticsEvent();
    if (!pending) return;
    enqueueEvent(pending.event, pending.payload);
    clearPendingAnalyticsEvent();
  }, [enqueueEvent, routeContext.family]);

  useEffect(() => {
    if (routeContext.excludedFromGa4) return;
    flushQueue();
    const timer = window.setInterval(() => {
      flushQueue();
    }, 500);
    return () => {
      window.clearInterval(timer);
    };
  }, [flushQueue, routeContext.excludedFromGa4]);

  return null;
}

export default GA4EventBridge;
