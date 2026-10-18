'use client';

import { trackComparison } from '../_lib/compare-analytics';
import { useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';

const LABELS = {
  en: { copy: 'Copy comparison', share: 'Copy link', copied: 'Copied', failed: 'Could not copy. Please try again.' },
  fr: { copy: 'Copier le comparatif', share: 'Copier le lien', copied: 'Copié', failed: 'Copie impossible. Réessayez.' },
  es: { copy: 'Copiar la comparación', share: 'Copiar enlace', copied: 'Copiado', failed: 'No se pudo copiar. Inténtalo de nuevo.' },
} as const;

export function CompareScoreActions({ locale, markdown, canonicalUrl }: { locale: AppLocale; markdown: string; canonicalUrl: string }) {
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState<'comparison' | 'link' | null>(null);
  const labels = LABELS[locale];

  async function copy(kind: 'comparison' | 'link') {
    try {
      await navigator.clipboard.writeText(kind === 'comparison' ? markdown : canonicalUrl);
      trackComparison({ action: kind === 'comparison' ? 'copy_comparison' : 'copy_link', locale });
      setCopied(kind);
      setMessage(labels.copied);
    } catch {
      setCopied(null);
      setMessage(labels.failed);
    }
  }

  return (
    <div className="compare-score-actions">
      <button type="button" onClick={() => void copy('comparison')}>
        {copied === 'comparison' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copied === 'comparison' ? labels.copied : labels.copy}
      </button>
      <button type="button" onClick={() => void copy('link')}>
        {copied === 'link' ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
        {copied === 'link' ? labels.copied : labels.share}
      </button>
      <span role="status" className="sr-only">{message}</span>
    </div>
  );
}
