'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  clearPendingAnalyticsEvent,
  readPendingAnalyticsEvent,
  type AnalyticsClientEventDetail,
  type AnalyticsPayload,
} from '@/lib/analytics-client';
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

  const flushQueue = useCallback(() => {
    if (routeContext.excludedFromGa4) {
      queuedEventsRef.current = [];
      return;
    }

    const gtag = window.gtag;
    if (typeof gtag !== 'function') return;

    const remaining: QueuedEvent[] = [];
    queuedEventsRef.current.forEach(({ event, payload }) => {
      const params = sanitizePayload(payload);
      try {
        gtag('event', event, params);
      } catch {
        remaining.push({ event, payload });
      }
    });
    queuedEventsRef.current = remaining;
  }, [routeContext.excludedFromGa4]);

  const enqueueEvent = useCallback(
    (event: string, payload?: AnalyticsPayload) => {
      const defaultPayload: AnalyticsPayload = payload?.route_family
        ? payload
        : {
            route_family: routeContext.family,
            ...payload,
          };
      queuedEventsRef.current.push({ event, payload: defaultPayload });
      flushQueue();
    },
    [flushQueue, routeContext.family]
  );

  useEffect(() => {
    if (routeContext.excludedFromGa4) return;

    const handleAnalyticsEvent = (event: Event) => {
      const detail = (event as CustomEvent<AnalyticsClientEventDetail>).detail;
      const eventName = typeof detail?.event === 'string' ? detail.event : '';
      if (!eventName) return;
      const payload = detail?.payload && typeof detail.payload === 'object' ? detail.payload : undefined;

      if (eventName === 'generation_started') {
        const localKey = typeof payload?.local_key === 'string' ? payload.local_key : null;
        if (localKey) {
          generationContextByLocalKeyRef.current.set(localKey, payload ?? {});
        }
      }

      enqueueEvent(eventName, payload);
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
        error_message: typeof detail.message === 'string' ? detail.message : undefined,
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
