'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import type { ExampleWatchDetail } from '@/lib/example-watch-detail';
import { ExampleReaderContent } from './ExampleReaderContent';
import { readerCopy } from './example-reader-copy';
import type { ReaderNavigation } from './DiscoveryVideoPlayer.client';
import styles from './example-reader.module.css';

type Props = { id: string; locale: string; onClose: () => void; navigation: ReaderNavigation; navigationError: boolean };
export default function ExampleReader({ id, locale, onClose, navigation, navigationError }: Props) {
  const copy = readerCopy(locale);
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });
  const [result, setResult] = useState<{ id: string; detail: ExampleWatchDetail | null; error: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const current = result?.id === id ? result : null;
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    void fetch(`/api/examples/${encodeURIComponent(id)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('Unavailable'); return response.json() as Promise<{ detail: ExampleWatchDetail }>; })
      .then(({ detail }) => { if (!controller.signal.aborted && detail?.id === id) setResult({ id, detail, error: false }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ id, detail: null, error: true }); });
    dialogRef.current?.scrollTo?.(0, 0);
    return () => controller.abort();
  }, [id, retry, dialogRef]);
  useEffect(() => {
    const dialog = dialogRef.current;
    // Navigation/retry can remove the focused control while fetching the next detail.
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
  }, [id, current, dialogRef]);
  return createPortal(<div className={styles.backdrop} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={copy.reader} aria-labelledby={current?.detail ? 'example-reader-title' : undefined}
      tabIndex={-1} onKeyDown={onDialogKeyDown} className={styles.dialog}>
      <button className={styles.close} onClick={onClose} aria-label={copy.close} data-modal-initial-focus="true"><X size={19}/></button>
      {current?.detail ? <ExampleReaderContent key={id} detail={current.detail} copy={copy} locale={locale} navigation={navigation}/> : <div className={styles.loading}>
        <p role="status">{current?.error ? copy.error : copy.loading}</p>
        {current?.error && <><button onClick={() => setRetry(value => value + 1)}>{copy.retry}</button><div className={styles.errorNavigation}>
          <button onClick={navigation.previous} disabled={!navigation.canPrevious || navigation.busy}><ChevronLeft size={16}/>{copy.previous}</button>
          <button onClick={navigation.next} disabled={!navigation.canNext || navigation.busy}>{copy.next}<ChevronRight size={16}/></button>
        </div></>}
      </div>}
      {navigationError && <p role="status" className={styles.navigationError}>{copy.navError}</p>}
    </section>
  </div>, document.body);
}
