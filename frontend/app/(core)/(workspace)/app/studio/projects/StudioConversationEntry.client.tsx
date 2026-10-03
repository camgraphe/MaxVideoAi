'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/authFetch';
import { studioConversationEntryCopy } from './studio-conversation-entry';
import styles from './studio-conversation-entry.module.css';

export function StudioConversationEntry({ locale }: { locale: string }) {
  const router = useRouter();
  const copy = studioConversationEntryCopy(locale);
  const busyRef = useRef(false);
  const attemptRef = useRef<{ name: string; idempotencyKey: string } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'error' | 'unauthorized' | 'unavailable' | null>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const openStudio = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    // Keep both fields through an uncertain response, including a locale change.
    attemptRef.current ??= {
      name: copy.projectName,
      idempotencyKey: `studio-entry-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    };
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await authFetch('/api/studio/conversation-projects', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(attemptRef.current),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (requestRef.current !== controller) return;
      if (!response.ok || !payload?.ok || typeof payload.result?.projectId !== 'string' || !payload.result.projectId.trim()) {
        setError(response.status === 401 ? 'unauthorized' : response.status === 404 ? 'unavailable' : 'error');
        busyRef.current = false;
        setBusy(false);
        return;
      }
      router.push(`/app/studio/conversation/${encodeURIComponent(payload.result.projectId)}`);
    } catch {
      if (requestRef.current !== controller) return;
      setError('error');
      busyRef.current = false;
      setBusy(false);
    } finally {
      window.clearTimeout(timeout);
    }
  };

  return (
    <section className={styles.entry} aria-labelledby="studio-conversation-entry-title" aria-busy={busy}>
      <span className={styles.eyebrow}><MessageSquare size={16} aria-hidden="true" />{copy.eyebrow}</span>
      <h1 id="studio-conversation-entry-title">{copy.title}</h1>
      <p className={styles.description}>{copy.description}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.open} disabled={busy} onClick={() => void openStudio()}>
          {busy ? copy.opening : error ? copy.retry : copy.open}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
        <p className={styles.note}>{copy.note}</p>
      </div>
      {error ? <p role="alert" className={styles.error}>{copy[error]}</p> : null}
      <span className={styles.status} role="status">{busy ? copy.opening : ''}</span>
    </section>
  );
}
