'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';

type DocumentStatus = {
  key: 'terms' | 'privacy' | 'cookies';
  currentVersion: string;
  publishedAt: string | null;
  acceptedVersion: string | null;
};

type ReconsentStatus =
  | null
  | {
      needsReconsent: boolean;
      shouldBlock: boolean;
      mode: 'soft' | 'hard';
      graceEndsAt: string | null;
      documents: DocumentStatus[];
    };

type ApiResponse = {
  ok: boolean;
  needsReconsent?: boolean;
  shouldBlock?: boolean;
  mode?: 'soft' | 'hard';
  graceEndsAt?: string | null;
  documents?: DocumentStatus[];
  error?: string;
};

function describeDocument(key: DocumentStatus['key']): { label: string; href: string } {
  switch (key) {
    case 'terms':
      return { label: 'Terms of Service', href: '/legal/terms' };
    case 'privacy':
      return { label: 'Privacy Policy', href: '/legal/privacy' };
    case 'cookies':
      return { label: 'Cookie Policy', href: '/legal/cookies' };
    default:
      return { label: key, href: '#' };
  }
}

function useCountdown(targetIso: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [targetIso]);

  return useMemo(() => {
    if (!targetIso) return null;
    const target = Date.parse(targetIso);
    if (Number.isNaN(target)) return null;
    const diffMs = target - now;
    if (diffMs <= 0) return 'Grace period expired';
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      return diffDays === 1 ? '1 day remaining' : `${diffDays} days remaining`;
    }
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) {
      return diffHours === 1 ? '1 hour remaining' : `${diffHours} hours remaining`;
    }
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return diffMinutes <= 1 ? 'Less than a minute remaining' : `${diffMinutes} minutes remaining`;
  }, [targetIso, now]);
}

async function fetchStatus(): Promise<ReconsentStatus> {
  try {
    const res = await fetch('/api/legal/reconsent', { credentials: 'include' });
    if (res.status === 401) return null;
    const json = (await res.json()) as ApiResponse;
    if (!json.ok) {
      throw new Error(json.error ?? 'Failed to load legal status');
    }
    if (!json.needsReconsent) {
      return {
        needsReconsent: false,
        shouldBlock: false,
        mode: json.mode ?? 'soft',
        graceEndsAt: json.graceEndsAt ?? null,
        documents: json.documents ?? [],
      };
    }
    return {
      needsReconsent: true,
      shouldBlock: Boolean(json.shouldBlock),
      mode: json.mode ?? 'soft',
      graceEndsAt: json.graceEndsAt ?? null,
      documents: json.documents ?? [],
    };
  } catch (error) {
    console.warn('[reconsent] status fetch failed', error);
    throw error instanceof Error ? error : new Error('Failed to load legal status');
  }
}

async function acceptDocuments(documents: DocumentStatus[]): Promise<ReconsentStatus> {
  const locale = typeof navigator !== 'undefined' ? navigator.language ?? null : null;
  const res = await fetch('/api/legal/reconsent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      documents: documents.map((doc) => doc.key),
      locale,
      source: 'reconsent',
    }),
  });
  const json = (await res.json()) as ApiResponse;
  if (!res.ok || !json.ok) {
    throw new Error(json?.error ?? 'Failed to record consent');
  }
  if (!json.needsReconsent) {
    return {
      needsReconsent: false,
      shouldBlock: false,
      mode: json.mode ?? 'soft',
      graceEndsAt: json.graceEndsAt ?? null,
      documents: json.documents ?? [],
    };
  }
  return {
    needsReconsent: true,
    shouldBlock: Boolean(json.shouldBlock),
    mode: json.mode ?? 'soft',
    graceEndsAt: json.graceEndsAt ?? null,
    documents: json.documents ?? [],
  };
}

export function ReconsentPrompt() {
  const [status, setStatus] = useState<ReconsentStatus>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchStatus();
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load legal status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const handleFocus = () => {
      void loadStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadStatus]);

  const countdown = useCountdown(status?.graceEndsAt ?? null);

  if (loading || !status || !status.needsReconsent) {
    return null;
  }

  const documents = status.documents;

  const handleAccept = async () => {
    if (!documents.length) return;
    setSubmitting(true);
    setError(null);
    try {
      const next = await acceptDocuments(documents);
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record consent.');
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="space-y-4">
      <div className="space-y-2 text-left">
        <h2 className="text-lg font-semibold text-text-primary">
          We&apos;ve updated our legal terms
        </h2>
        <p className="text-sm text-text-secondary">
          To continue using MaxVideoAI, please review and accept the updated documents below.
        </p>
        {status.mode === 'soft' && !status.shouldBlock ? (
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            Grace period active {countdown ? `· ${countdown}` : ''}
          </p>
        ) : null}
      </div>

      <ul className="space-y-2 text-sm text-text-secondary">
        {documents.map((doc) => {
          const meta = describeDocument(doc.key);
          return (
            <li
              key={doc.key}
              className="flex items-start justify-between gap-4 rounded-input border border-border bg-bg px-3 py-2"
            >
              <div>
                <p className="font-medium text-text-primary">{meta.label}</p>
                <p className="text-xs text-text-muted">
                  Version {doc.currentVersion}
                  {doc.acceptedVersion ? ` · Your last acceptance: ${doc.acceptedVersion}` : ' · Acceptance required'}
                </p>
              </div>
              <a
                href={meta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold uppercase tracking-wide text-brand underline hover:text-brandHover"
              >
                View
              </a>
            </li>
          );
        })}
      </ul>

      {error ? <p className="text-sm text-[var(--warning)]">{error}</p> : null}

      <Button
        type="button"
        size="sm"
        onClick={handleAccept}
        disabled={submitting}
        className="w-full px-3 py-2 text-sm"
      >
        {submitting ? 'Saving…' : 'Accept and continue'}
      </Button>
    </div>
  );

  if (status.shouldBlock) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 px-4 py-8">
        <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto fixed bottom-6 right-6 z-[999] w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-card">
      {content}
    </div>
  );
}
