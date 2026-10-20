'use client';

import { useState } from 'react';
import { Check, Copy, Linkedin, Mail } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/clipboard';
import { buildVideoShareIntent, type LinkShareTarget } from '@/components/library/video-share-intents';
import styles from '@/components/examples/example-reader-styles';

const destinations = [
  { target: 'x', label: 'X' }, { target: 'whatsapp', label: 'WhatsApp' },
  { target: 'telegram', label: 'Telegram' }, { target: 'linkedin', label: 'LinkedIn' },
  { target: 'facebook', label: 'Facebook' }, { target: 'email', label: 'E-mail' },
] as const;

function ShareIcon({ target }: { target: LinkShareTarget }) {
  if (target === 'email') return <Mail size={18} aria-hidden />;
  if (target === 'linkedin') return <Linkedin size={18} aria-hidden />;
  // Existing local brand assets, loaded only with the visible reader's share row.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/brand/share/${target}.svg`} width={18} height={18} alt="" aria-hidden="true" loading="lazy" decoding="async" />;
}

export function VideoWatchShare({ watchUrl, locale = 'en' }: { watchUrl: string; locale?: string }) {
  const copy = locale.startsWith('fr') ? {
    share: 'Partager', link: 'Copier le lien', copied: 'Lien copié', url: 'Lien de la vidéo', on: 'Partager sur', email: 'Partager par e-mail',
    error: 'Impossible de copier automatiquement. Sélectionnez et copiez le lien ci-dessous.',
  } : locale.startsWith('es') ? {
    share: 'Compartir', link: 'Copiar enlace', copied: 'Enlace copiado', url: 'Enlace del vídeo', on: 'Compartir en', email: 'Compartir por e-mail',
    error: 'No se pudo copiar automáticamente. Selecciona y copia el enlace de abajo.',
  } : {
    share: 'Share', link: 'Copy link', copied: 'Link copied', url: 'Video link', on: 'Share on', email: 'Share by e-mail',
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
    <div className={styles.shareActions}>{destinations.map(({ target, label }) => {
      const accessibleLabel = target === 'email' ? copy.email : `${copy.on} ${label}`;
      return <a key={target} href={buildVideoShareIntent(target, watchUrl, '', locale)}
        target={target === 'email' ? undefined : '_blank'} rel={target === 'email' ? undefined : 'noopener noreferrer'}
        aria-label={accessibleLabel} title={accessibleLabel}
        data-analytics-event="cta_click" data-analytics-cta-name={`video_share_${target}`} data-analytics-cta-location="watch_page">
        <ShareIcon target={target} />
      </a>;
    })}</div>
    <p role="status" aria-live="polite" className={status === 'error' ? styles.shareFeedback : 'sr-only'}>
      {status === 'copied' ? copy.copied : status === 'error' ? copy.error : ''}
    </p>
    {status === 'error' && <input className={styles.shareFallback} aria-label={copy.url} value={watchUrl} readOnly onFocus={event => event.currentTarget.select()} />}
  </section>;
}
