'use client';

import { useCallback, useEffect, useState } from 'react';
import { CONSENT_COOKIE_NAME, createDefaultConsent, mergeConsent, parseConsent, serializeConsent, type ConsentCategory, type ConsentRecord } from '@/lib/consent';
import { setAnalyticsConsentCookie, setClarityConsent } from '@/lib/clarity-client';
import { Button } from '@/components/ui/Button';

type BannerState =
  | { ready: false }
  | {
      ready: true;
      version: string;
      consent: ConsentRecord | null;
    };

type FetchState = 'idle' | 'saving';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 395; // ~13 months
const DEFAULT_CHOICES: Record<ConsentCategory, boolean> = {
  analytics: false,
  ads: false,
};

const PUBLIC_GOOGLE_CONSENT_MODE = (process.env.NEXT_PUBLIC_GOOGLE_CONSENT_MODE ?? 'auto').toLowerCase();
const ANALYTICS_STORAGE_KEY = 'mv-consent-analytics';
const ANALYTICS_GRANTED_VALUE = 'granted';

function readCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const entry of cookies) {
    const [key, ...rest] = entry.trim().split('=');
    if (key === CONSENT_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function writeCookie(record: ConsentRecord) {
  if (typeof document === 'undefined') return;
  const payload = encodeURIComponent(serializeConsent(record));
  document.cookie = `${CONSENT_COOKIE_NAME}=${payload}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function broadcastConsent(record: ConsentRecord) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('consent:updated', {
      detail: {
        version: record.version,
        categories: record.categories,
        timestamp: record.timestamp,
      },
    })
  );
}

function setLocalAnalyticsFlag(granted: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (granted) {
      window.localStorage.setItem(ANALYTICS_STORAGE_KEY, ANALYTICS_GRANTED_VALUE);
    } else {
      window.localStorage.removeItem(ANALYTICS_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function updateGoogleConsent(categories: ConsentRecord['categories']) {
  if (typeof window === 'undefined') return;
  if (PUBLIC_GOOGLE_CONSENT_MODE === 'false' || PUBLIC_GOOGLE_CONSENT_MODE === 'off') {
    return;
  }

  const consentUpdate = {
    ad_storage: categories.ads ? 'granted' : 'denied',
    ad_user_data: categories.ads ? 'granted' : 'denied',
    ad_personalization: categories.ads ? 'granted' : 'denied',
    analytics_storage: categories.analytics ? 'granted' : 'denied',
  };

  const helpers = window as typeof window & {
    gtag?: (...args: unknown[]) => void;
    gtagConsentUpdate?: (payload: Record<string, string>) => void;
    dataLayer?: Array<Record<string, unknown>>;
  };

  if (typeof helpers.gtagConsentUpdate === 'function') {
    helpers.gtagConsentUpdate(consentUpdate);
    return;
  }

  if (typeof helpers.gtag === 'function') {
    helpers.gtag('consent', 'update', consentUpdate);
    return;
  }

  if (Array.isArray(helpers.dataLayer)) {
    helpers.dataLayer.push({
      event: 'consent_update',
      ...consentUpdate,
    });
  }
}

async function persistToServer(categories: ConsentRecord['categories']) {
  try {
    await fetch('/api/legal/cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ categories }),
    });
  } catch (error) {
    console.warn('[cookie-consent] failed to persist to server', error);
  }
}

export function CookieBanner() {
  const [state, setState] = useState<BannerState>({ ready: false });
  const [showPreferences, setShowPreferences] = useState(false);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<ConsentCategory, boolean>>(DEFAULT_CHOICES);

  const consent = state.ready ? state.consent : null;
  const version = state.ready ? state.version : null;

  const hasMadeChoice = state.ready && consent !== null && consent.version === version;

  const bootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/legal/cookies/version', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || typeof json.version !== 'string') {
        throw new Error(json?.error ?? 'Failed to load cookie policy version');
      }
      const stored = parseConsent(readCookie());
      if (stored && stored.version === json.version) {
        setState({ ready: true, version: json.version, consent: stored });
        broadcastConsent(stored);
        setAnalyticsConsentCookie(Boolean(stored.categories.analytics));
        setLocalAnalyticsFlag(Boolean(stored.categories.analytics));
        setClarityConsent(Boolean(stored.categories.analytics));
        updateGoogleConsent(stored.categories);
      } else {
        setState({ ready: true, version: json.version, consent: null });
        setLocalAnalyticsFlag(false);
      }
    } catch (err) {
      console.warn('[cookie-consent] bootstrap failed', err);
      const fallbackVersion = '2025-10-26';
      const stored = parseConsent(readCookie());
      if (stored && stored.version === fallbackVersion) {
        setState({ ready: true, version: fallbackVersion, consent: stored });
        broadcastConsent(stored);
        setAnalyticsConsentCookie(Boolean(stored.categories.analytics));
        setLocalAnalyticsFlag(Boolean(stored.categories.analytics));
        setClarityConsent(Boolean(stored.categories.analytics));
        updateGoogleConsent(stored.categories);
      } else {
        setState({ ready: true, version: fallbackVersion, consent: null });
        setLocalAnalyticsFlag(false);
      }
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!state.ready) return;
    if (!showPreferences) return;
    setDraft(consent ? { ...consent.categories } : { ...DEFAULT_CHOICES });
  }, [consent, showPreferences, state.ready]);

  const applyConsent = useCallback(
    async (categories: Record<ConsentCategory, boolean>, source: ConsentRecord['source']) => {
      if (!version) return;
      setFetchState('saving');
      setError(null);
      try {
        const base = consent ?? createDefaultConsent(version, source);
        const next = mergeConsent(base, {
          version,
          source,
          timestamp: Date.now(),
          categories,
        });
        writeCookie(next);
        setState({ ready: true, version, consent: next });
        broadcastConsent(next);
        setAnalyticsConsentCookie(Boolean(next.categories.analytics));
        setLocalAnalyticsFlag(Boolean(next.categories.analytics));
        setClarityConsent(Boolean(next.categories.analytics));
        updateGoogleConsent(next.categories);
        await persistToServer(next.categories);
        setShowPreferences(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to store your preferences.');
      } finally {
        setFetchState('idle');
      }
    },
    [consent, version]
  );

  const handleAcceptAll = () => {
    void applyConsent({ analytics: true, ads: true }, 'banner');
  };

  const handleRejectAll = () => {
    void applyConsent({ analytics: false, ads: false }, 'banner');
  };

  const handleSavePreferences = () => {
    void applyConsent(draft, 'preferences');
  };

  const toggleCategory = (category: ConsentCategory) => {
    setDraft((current) => ({
      ...current,
      [category]: !current[category],
    }));
  };

  if (!state.ready || hasMadeChoice) {
    return null;
  }

  return (
    <div className="pointer-events-auto fixed bottom-4 left-0 right-0 z-[1100] flex justify-center px-4 sm:px-6">
      <div className="w-full max-w-3xl rounded-card border border-border bg-surface p-5 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1 space-y-2">
            <h2 className="text-base font-semibold text-text-primary">Cookies &amp; Privacy</h2>
            <p className="text-sm text-text-secondary">
              We use essential cookies to run the site. With your consent, we&apos;ll enable analytics to improve the product and
              advertising tags for campaign measurement. You can change your choices anytime.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                type="button"
                size="sm"
                onClick={handleAcceptAll}
                disabled={fetchState === 'saving'}
                className="px-4 py-2 text-sm"
              >
                {fetchState === 'saving' ? 'Saving…' : 'Accept all'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRejectAll}
                disabled={fetchState === 'saving'}
                className="border-border px-4 py-2 text-sm text-text-primary hover:bg-surface-hover"
              >
                Reject all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowPreferences((prev) => {
                    const next = !prev;
                    if (!next) {
                      setDraft(consent ? { ...consent.categories } : { ...DEFAULT_CHOICES });
                    }
                    return next;
                  });
                }}
                className="min-h-0 h-auto p-0 text-sm font-semibold text-brand underline underline-offset-4 hover:text-brandHover"
              >
                {showPreferences ? 'Hide choices' : 'Manage choices'}
              </Button>
            </div>
            {error ? <p className="text-xs text-[var(--warning)]">{error}</p> : null}
            <p className="text-xs text-text-muted">
              View our{' '}
              <a href="/legal/cookies" target="_blank" rel="noopener noreferrer" className="text-brand underline hover:text-brandHover">
                Cookie Policy
              </a>
              .
            </p>
          </div>
          {showPreferences ? (
            <div className="w-full max-w-xs rounded-input border border-border bg-surface-2 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Preferences</p>
              <label className="mb-3 flex items-start justify-between gap-4 text-sm text-text-secondary">
                <span>
                  Analytics cookies
                  <span className="block text-xs text-text-muted">Help us measure usage and improve features.</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleCategory('analytics')}
                  className={`min-h-0 h-6 w-10 rounded-full border p-0 transition ${draft.analytics ? 'border-brand bg-brand' : 'border-border bg-surface'}`}
                  aria-pressed={draft.analytics}
                >
                  <span
                    className={`block h-5 w-5 translate-y-0.5 rounded-full bg-on-brand transition ${draft.analytics ? 'translate-x-4' : 'translate-x-0.5'}`}
                  />
                </Button>
              </label>
              <label className="mb-3 flex items-start justify-between gap-4 text-sm text-text-secondary">
                <span>
                  Advertising cookies
                  <span className="block text-xs text-text-muted">Measure campaigns and improve relevance.</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleCategory('ads')}
                  className={`min-h-0 h-6 w-10 rounded-full border p-0 transition ${draft.ads ? 'border-brand bg-brand' : 'border-border bg-surface'}`}
                  aria-pressed={draft.ads}
                >
                  <span
                    className={`block h-5 w-5 translate-y-0.5 rounded-full bg-on-brand transition ${draft.ads ? 'translate-x-4' : 'translate-x-0.5'}`}
                  />
                </Button>
              </label>
              <Button
                type="button"
                size="sm"
                onClick={handleSavePreferences}
                disabled={fetchState === 'saving'}
                className="w-full px-3 py-2 text-sm"
              >
                {fetchState === 'saving' ? 'Saving…' : 'Save preferences'}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
