'use client';

import { useMemo, useState } from 'react';
import { CopyPromptButton } from '@/components/CopyPromptButton';

type PromptPreviewProps = {
  prompt: string;
  promptLabel: string;
  promptFallback: string;
  showMoreLabel: string;
  showLessLabel: string;
  copyLabel: string;
  copiedLabel: string;
};

const MAX_PREVIEW_LENGTH = 420;

function buildPreview(prompt: string, maxLength = MAX_PREVIEW_LENGTH): string {
  if (!prompt) return '';
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`;
}

export function PromptPreview({
  prompt,
  promptLabel,
  promptFallback,
  showMoreLabel,
  showLessLabel,
  copyLabel,
  copiedLabel,
}: PromptPreviewProps) {
  const cleanPrompt = useMemo(() => prompt?.trim() ?? '', [prompt]);
  const collapsed = useMemo(() => buildPreview(cleanPrompt), [cleanPrompt]);
  const needsCollapse = cleanPrompt.length > collapsed.length;
  const [expanded, setExpanded] = useState(!needsCollapse);
  const displayPrompt = expanded ? cleanPrompt : collapsed;

  return (
    <div className="rounded-card border border-border bg-white/90 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-micro text-text-muted">{promptLabel}</p>
        <CopyPromptButton prompt={cleanPrompt} copyLabel={copyLabel} copiedLabel={copiedLabel} />
      </div>
      <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-text-secondary">
        {displayPrompt || promptFallback}
      </p>
      {needsCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 text-sm font-semibold text-accent underline underline-offset-4 transition hover:text-accentSoft"
          aria-expanded={expanded}
        >
          {expanded ? showLessLabel : showMoreLabel}
        </button>
      ) : null}
    </div>
  );
}
