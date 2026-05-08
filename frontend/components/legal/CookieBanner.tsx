'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createDefaultConsent, mergeConsent, parseConsent, type ConsentCategory, type ConsentRecord } from '@/lib/consent';
import { Button } from '@/components/ui/Button';
import { CookiePreferencesPanel } from '@/components/legal/CookiePreferencesPanel';
import { COOKIE_BANNER_COPY, resolveCookieBannerLocale } from '@/components/legal/cookie-banner-copy';
import {
  applyStoredConsentEffects,
  clearLocalAnalyticsFlag,
  DEFAULT_CHOICES,
  OPEN_PREFERENCES_EVENT,
  persistCookieConsent,
  readConsentCookie,
  writeConsentCookie,
  type BannerState,
  type FetchState,
} from '@/components/legal/cookie-banner-client';

export function CookieBanner() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  const copy = COOKIE_BANNER_COPY[resolveCookieBannerLocale(pathname)];
  const [state, setState] = useState<BannerState>({ ready: false });
  const [showPreferences, setShowPreferences] = useState(false);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<ConsentCategory, boolean>>(DEFAULT_CHOICES);
  const manageChoicesButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const preferencesPanelId = useId();
  const preferencesTitleId = useId();
  const analyticsLabelId = useId();
  const adsLabelId = useId();

  const consent = state.ready ? state.consent : null;
  const version = state.ready ? state.version : null;
  const hasMadeChoice = state.ready && consent !== null && consent.version === version;

  const closePreferences = useCallback(
    (restoreFocus = false) => {
      setShowPreferences(false);
      setDraft(consent ? { ...consent.categories } : { ...DEFAULT_CHOICES });
      if (restoreFocus) {
        requestAnimationFrame(() => {
          const trigger = lastTriggerRef.current;
          if (trigger && trigger.isConnected) {
            trigger.focus();
            return;
          }
          manageChoicesButtonRef.current?.focus();
        });
      }
    },
    [consent]
  );

  const applyPersistedConsent = useCallback((nextConsent: ConsentRecord, nextVersion: string) => {
    setState({ ready: true, version: nextVersion, consent: nextConsent });
    applyStoredConsentEffects(nextConsent);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/legal/cookies/version', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || typeof json.version !== 'string') {
        throw new Error(json?.error ?? copy.errors.loadVersion);
      }
      const stored = parseConsent(readConsentCookie());
      if (stored && stored.version === json.version) {
        applyPersistedConsent(stored, json.version);
      } else {
        setState({ ready: true, version: json.version, consent: null });
        clearLocalAnalyticsFlag();
      }
    } catch (err) {
      console.warn('[cookie-consent] bootstrap failed', err);
      const fallbackVersion = '2025-10-26';
      const stored = parseConsent(readConsentCookie());
      if (stored && stored.version === fallbackVersion) {
        applyPersistedConsent(stored, fallbackVersion);
      } else {
        setState({ ready: true, version: fallbackVersion, consent: null });
        clearLocalAnalyticsFlag();
      }
    }
  }, [applyPersistedConsent, copy.errors.loadVersion]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!state.ready || !showPreferences) return;
    setDraft(consent ? { ...consent.categories } : { ...DEFAULT_CHOICES });
  }, [consent, showPreferences, state.ready]);

  useEffect(() => {
    if (!showPreferences) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePreferences(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePreferences, showPreferences]);

  useEffect(() => {
    const handleOpenPreferences = () => {
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        lastTriggerRef.current = document.activeElement;
      }
      setShowPreferences(true);
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, handleOpenPreferences);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, handleOpenPreferences);
  }, []);

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
        writeConsentCookie(next);
        setState({ ready: true, version, consent: next });
        applyStoredConsentEffects(next);
        await persistCookieConsent(next.categories);
        setShowPreferences(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.errors.save);
      } finally {
        setFetchState('idle');
      }
    },
    [consent, copy.errors.save, version]
  );

  const toggleCategory = (category: ConsentCategory) => {
    setDraft((current) => ({
      ...current,
      [category]: !current[category],
    }));
  };

  const handleManageChoicesToggle = () => {
    if (showPreferences) {
      closePreferences();
      return;
    }
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      lastTriggerRef.current = document.activeElement;
    }
    setShowPreferences(true);
  };

  const preferencesPanel = (
    <CookiePreferencesPanel
      adsLabelId={adsLabelId}
      analyticsLabelId={analyticsLabelId}
      copy={copy}
      draft={draft}
      fetchState={fetchState}
      panelId={preferencesPanelId}
      titleId={preferencesTitleId}
      onSavePreferences={() => void applyConsent(draft, 'preferences')}
      onToggleCategory={toggleCategory}
    />
  );

  if (!state.ready || isAdminRoute) {
    return null;
  }

  if (hasMadeChoice) {
    return showPreferences ? (
      <div className="pointer-events-auto fixed bottom-4 left-3 right-3 z-[1095] sm:bottom-16 sm:left-4 sm:right-auto sm:w-[22rem]">
        {preferencesPanel}
      </div>
    ) : null;
  }

  return (
    <div className="pointer-events-auto fixed bottom-1 left-0 right-0 z-[1100] flex justify-center px-3 sm:bottom-4 sm:px-6">
      <div className="max-h-[24svh] w-full max-w-3xl overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-xl sm:max-h-[42svh] sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1 space-y-0 sm:space-y-2">
            <h2 className="hidden text-sm font-semibold text-text-primary sm:block sm:text-base">{copy.title}</h2>
            <p className="hidden text-xs text-text-secondary sm:block sm:text-sm">{copy.body}</p>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-4">
              <Button
                type="button"
                size="sm"
                onClick={() => void applyConsent({ analytics: true, ads: true }, 'banner')}
                disabled={fetchState === 'saving'}
                className="px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
              >
                {fetchState === 'saving' ? copy.actions.saving : copy.actions.acceptAll}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void applyConsent({ analytics: false, ads: false }, 'banner')}
                disabled={fetchState === 'saving'}
                className="border-border px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover sm:px-4 sm:py-2 sm:text-sm"
              >
                {copy.actions.rejectAll}
              </Button>
              <Button
                ref={manageChoicesButtonRef}
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleManageChoicesToggle}
                aria-expanded={showPreferences}
                aria-controls={preferencesPanelId}
                className="min-h-0 h-auto p-0 text-xs font-semibold text-brand underline underline-offset-4 hover:text-brandHover sm:text-sm"
              >
                {showPreferences ? copy.actions.hideChoices : copy.actions.manageChoices}
              </Button>
            </div>
            {error ? <p className="text-xs text-[var(--warning)]">{error}</p> : null}
          </div>
          {showPreferences ? preferencesPanel : null}
        </div>
      </div>
    </div>
  );
}
