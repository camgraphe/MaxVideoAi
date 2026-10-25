'use client';

import { referenceMentionCopy } from './workspace-reference-mentions';

export function ComposerSoraImageNotice({ workspace = false }: { workspace?: boolean }) {
  return (
    <p className={workspace ? 'text-xs text-text-muted' : 'text-[12px] text-text-muted'} role="note">
      Real people — including public figures — cannot be generated. Input images with faces of humans are currently rejected.{' '}
      {workspace ? 'OpenAI' : <span className="font-semibold uppercase tracking-micro text-[11px] text-text-muted">OpenAI</span>}
    </p>
  );
}

export function ComposerReferenceMentionNotice({ locale, changed, onReview }: {
  locale: string;
  changed: readonly string[];
  onReview: () => void;
}) {
  const copy = referenceMentionCopy(locale);
  return (
    <div className="app-reference-mention-review" role="alert">
      <p>{copy.changed} <strong>{changed.join(', ')}</strong></p>
      <button type="button" onClick={onReview}>{copy.reviewed}</button>
    </div>
  );
}

export function ComposerNotices({
  promptDescription,
  workflowNotice,
  extensionNotice,
  error,
}: {
  promptDescription?: string;
  workflowNotice?: string | null;
  extensionNotice?: string | null;
  error?: string | null;
}) {
  if (!promptDescription && !workflowNotice && !extensionNotice && !error) return null;

  return (
    <div className="space-y-1">
      {promptDescription ? <p className="text-[12px] text-text-muted">{promptDescription}</p> : null}
      {workflowNotice ? (
        <div className="rounded-input border border-border bg-surface-glass-80 px-3 py-2 text-[12px] text-text-secondary dark:border-white/8 dark:bg-white/[0.04] dark:text-white/70">
          {workflowNotice}
        </div>
      ) : null}
      {extensionNotice ? <p role="status" className="text-[13px] leading-relaxed text-text-secondary">{extensionNotice}</p> : null}
      {error ? (
        <div role="alert" className="rounded-input border border-error-border bg-error-bg px-3 py-2 text-[13px] whitespace-pre-line text-error">
          {error}
        </div>
      ) : null}
    </div>
  );
}
