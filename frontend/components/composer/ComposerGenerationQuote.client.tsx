'use client';

import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { workspaceReferenceCopy } from './workspace-reference-copy';

export function ComposerGenerationQuote({ workspace, hasPrice, isPricing, children }: {
  workspace: boolean;
  hasPrice: boolean;
  isPricing: boolean;
  children: ReactNode;
}) {
  const { locale } = useI18n();
  if (!workspace) return children;
  const copy = workspaceReferenceCopy(locale);
  return <span className="app-generation-quote" role="status" aria-live="polite">
    {/* Size the shared quote slot from its localized statuses, without retaining a stale price. */}
    <span className="app-quote-status app-generation-quote-size" aria-hidden="true">{copy.calculating}</span>
    <span className="app-quote-status app-generation-quote-size" aria-hidden="true">{copy.priceUnavailable}</span>
    {hasPrice ? children : <span key="status" className="app-quote-status relative z-10">{isPricing ? copy.calculating : copy.priceUnavailable}</span>}
  </span>;
}
