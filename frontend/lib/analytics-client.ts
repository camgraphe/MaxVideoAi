export type AnalyticsPayload = Record<string, unknown>;

export type AnalyticsClientEventDetail = {
  event: string;
  payload?: AnalyticsPayload;
};

type StoredAnalyticsEvent = {
  event: string;
  payload?: AnalyticsPayload;
  createdAt: number;
};

export const PENDING_AUTH_EVENT_STORAGE_KEY = 'mvai.pending-auth-event.v1';
export const PENDING_AUTH_EVENT_TTL_MS = 15 * 60 * 1000;
const RECENT_ANALYTICS_EVENT_TTL_MS = 1500;

declare global {
  interface Window {
    __mvaiRecentAnalyticsEvents?: Record<string, number>;
    __mvaiGoogleAdsConfiguredIds?: Record<string, boolean>;
  }
}

export function dispatchAnalyticsEvent(event: string, payload?: AnalyticsPayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent<AnalyticsClientEventDetail>('mvai:analytics', { detail: { event, payload } }));
  } catch {
    // Ignore analytics transport failures in the UI.
  }
}

export function persistPendingAnalyticsEvent(event: string, payload?: AnalyticsPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const stored: StoredAnalyticsEvent = {
      event,
      payload,
      createdAt: Date.now(),
    };
    window.sessionStorage.setItem(PENDING_AUTH_EVENT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Ignore storage failures.
  }
}

export function readPendingAnalyticsEvent(): StoredAnalyticsEvent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_AUTH_EVENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAnalyticsEvent | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.event !== 'string' || !parsed.event.trim()) return null;
    if (typeof parsed.createdAt !== 'number' || !Number.isFinite(parsed.createdAt)) return null;
    if (Date.now() - parsed.createdAt > PENDING_AUTH_EVENT_TTL_MS) {
      window.sessionStorage.removeItem(PENDING_AUTH_EVENT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingAnalyticsEvent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_AUTH_EVENT_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function shouldDispatchRecentAnalyticsEvent(eventKey: string, ttlMs = RECENT_ANALYTICS_EVENT_TTL_MS): boolean {
  if (typeof window === 'undefined') return false;
  if (!eventKey.trim()) return false;

  const registry = (window.__mvaiRecentAnalyticsEvents ??= {});
  const now = Date.now();

  for (const [key, timestamp] of Object.entries(registry)) {
    if (!Number.isFinite(timestamp) || now - timestamp > ttlMs) {
      delete registry[key];
    }
  }

  const lastSentAt = registry[eventKey];
  if (typeof lastSentAt === 'number' && now - lastSentAt < ttlMs) {
    return false;
  }

  registry[eventKey] = now;
  return true;
}
