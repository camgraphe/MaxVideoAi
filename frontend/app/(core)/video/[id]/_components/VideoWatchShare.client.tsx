'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/clipboard';
import styles from '@/components/examples/example-reader-styles';

export function VideoWatchShare({ watchUrl, locale = 'en' }: { watchUrl: string; locale?: string }) {
  const copy = locale.startsWith('fr') ? {
    share: 'Partager cette vidéo', link: 'Copier le lien', copied: 'Lien copié', url: 'Lien de la vidéo',
    error: 'Impossible de copier automatiquement. Sélectionnez et copiez le lien ci-dessous.',
  } : locale.startsWith('es') ? {
    share: 'Compartir este vídeo', link: 'Copiar enlace', copied: 'Enlace copiado', url: 'Enlace del vídeo',
    error: 'No se pudo copiar automáticamente. Selecciona y copia el enlace de abajo.',
  } : {
    share: 'Share this video', link: 'Copy link', copied: 'Link copied', url: 'Video link',
    error: 'Unable to copy automatically. Select and copy the link below.',
  };
  const [feedback, setFeedback] = useState<{ url: string; copied: boolean } | null>(null);
  const status = feedback?.url === watchUrl ? feedback.copied ? 'copied' : 'error' : 'idle';

  const copyLink = async (button: HTMLButtonElement) => {
    const copied = await copyTextToClipboard(watchUrl);
    // The shared clipboard helper may briefly focus its fallback textarea.
    if (button.isConnected) button.focus({ preventScroll: true });
    setFeedback({ url: watchUrl, copied });
  };

  return <section className={styles.share} aria-label={copy.share}>
    <div className={styles.shareRow}>
      <span>{copy.share}</span>
      <button type="button" onClick={event => void copyLink(event.currentTarget)} data-copied={status === 'copied' || undefined}
        data-analytics-event="cta_click" data-analytics-cta-name="video_share_link" data-analytics-cta-location="watch_page">
        {status === 'copied' ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        {status === 'copied' ? copy.copied : copy.link}
      </button>
    </div>
    <p role="status" aria-live="polite" className={status === 'error' ? styles.shareFeedback : 'sr-only'}>
      {status === 'copied' ? copy.copied : status === 'error' ? copy.error : ''}
    </p>
    {status === 'error' && <input className={styles.shareFallback} aria-label={copy.url} value={watchUrl} readOnly onFocus={event => event.currentTarget.select()} />}
  </section>;
}
