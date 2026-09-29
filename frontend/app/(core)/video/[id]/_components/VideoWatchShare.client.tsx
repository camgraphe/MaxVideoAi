'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/clipboard';
import styles from '@/components/examples/example-reader-styles';

export function VideoWatchShare({ watchUrl, locale = 'en' }: { watchUrl: string; locale?: string }) {
  const copy = locale.startsWith('fr') ? {
    share: 'Partager', link: 'Copier le lien', copied: 'Lien copié', url: 'Lien de la vidéo', x: 'Partager sur X', whatsapp: 'Partager sur WhatsApp',
    error: 'Impossible de copier automatiquement. Sélectionnez et copiez le lien ci-dessous.',
  } : locale.startsWith('es') ? {
    share: 'Compartir', link: 'Copiar enlace', copied: 'Enlace copiado', url: 'Enlace del vídeo', x: 'Compartir en X', whatsapp: 'Compartir en WhatsApp',
    error: 'No se pudo copiar automáticamente. Selecciona y copia el enlace de abajo.',
  } : {
    share: 'Share', link: 'Copy link', copied: 'Link copied', url: 'Video link', x: 'Share on X', whatsapp: 'Share on WhatsApp',
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
      <div className={styles.shareActions}><button type="button" onClick={event => void copyLink(event.currentTarget)} data-copied={status === 'copied' || undefined}
        data-analytics-event="cta_click" data-analytics-cta-name="video_share_link" data-analytics-cta-location="watch_page">
        {status === 'copied' ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        {status === 'copied' ? copy.copied : copy.link}
      </button>
      <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(watchUrl)}`} target="_blank" rel="noopener noreferrer" aria-label={copy.x} title={copy.x}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-5-7.6L5.2 22H2l7.4-8.5L1.8 2h6.5l4.5 6.9L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z"/></svg>
      </a>
      <a href={`https://wa.me/?text=${encodeURIComponent(watchUrl)}`} target="_blank" rel="noopener noreferrer" aria-label={copy.whatsapp} title={copy.whatsapp}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 0 1 0 16.4 8.1 8.1 0 0 1-4.2-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3.4 3c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.5 1 2.7c.2.2 1.8 2.8 4.4 3.8 2.2.8 2.6.6 3.1.5.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.7-.4l-1.8-.9c-.2-.1-.4-.1-.6.2l-.8 1c-.2.2-.4.2-.7.1a7 7 0 0 1-2.1-1.3 8 8 0 0 1-1.4-1.8c-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5L9.4 7c-.2-.4-.4-.4-.6-.4h-.2Z" clipRule="evenodd"/></svg>
      </a></div>
    </div>
    <p role="status" aria-live="polite" className={status === 'error' ? styles.shareFeedback : 'sr-only'}>
      {status === 'copied' ? copy.copied : status === 'error' ? copy.error : ''}
    </p>
    {status === 'error' && <input className={styles.shareFallback} aria-label={copy.url} value={watchUrl} readOnly onFocus={event => event.currentTarget.select()} />}
  </section>;
}
