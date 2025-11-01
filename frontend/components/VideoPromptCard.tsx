'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CopyPromptButton } from '@/components/CopyPromptButton';

type VideoPromptCardProps = {
  prompt: string;
  videoId: string;
};

function buildPreview(prompt: string, maxLength = 280): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function VideoPromptCard({ prompt, videoId }: VideoPromptCardProps) {
  const cleanPrompt = useMemo(() => prompt?.trim() ?? '', [prompt]);
  const collapsedPrompt = useMemo(() => buildPreview(cleanPrompt), [cleanPrompt]);
  const needsCollapse = cleanPrompt.length > collapsedPrompt.length;
  const [expanded, setExpanded] = useState(!needsCollapse);

  const displayPrompt = expanded ? cleanPrompt : collapsedPrompt;

  return (
    <div className="rounded-card border border-border bg-white p-5 shadow-card">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/generate?from=${encodeURIComponent(videoId)}`}
          className="inline-flex items-center rounded-pill border border-hairline px-4 py-2 text-xs font-semibold uppercase tracking-micro text-text-primary transition hover:border-accent hover:text-accent"
        >
          Remix in workspace →
        </Link>
        <CopyPromptButton prompt={cleanPrompt} />
      </div>
      <p className="mt-3 whitespace-pre-line text-sm text-text-secondary">
        {displayPrompt || 'Prompt unavailable.'}
      </p>
      {needsCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 text-xs font-semibold text-accent underline underline-offset-2 transition hover:text-accentSoft"
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show full prompt'}
        </button>
      ) : null}
    </div>
  );
}
