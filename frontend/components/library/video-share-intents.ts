export type LinkShareTarget = 'email' | 'x' | 'whatsapp' | 'telegram' | 'linkedin' | 'facebook';

/** Only destinations with a documented text field receive the optional signature. */
export function buildVideoShareIntent(target: LinkShareTarget, url: string, signature: string, locale: string): string {
  const note = signature.trim();
  const message = note ? `${url}\n\n${note}` : url;
  if (target === 'email') {
    const subject = locale.startsWith('fr') ? 'Vidéo partagée avec MaxVideoAI' : locale.startsWith('es') ? 'Vídeo compartido con MaxVideoAI' : 'Video shared with MaxVideoAI';
    return `mailto:?${new URLSearchParams({ subject, body: message })}`;
  }
  if (target === 'x') {
    return `https://x.com/intent/tweet?${new URLSearchParams({ url, ...(note ? { text: note } : {}) })}`;
  }
  if (target === 'whatsapp') return `https://wa.me/?${new URLSearchParams({ text: message })}`;
  if (target === 'telegram') return `https://t.me/share/url?${new URLSearchParams({ url, ...(note ? { text: note } : {}) })}`;
  if (target === 'linkedin') return `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}`;
  return `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`;
}
