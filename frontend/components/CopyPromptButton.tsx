'use client';

import { useState } from 'react';

type CopyPromptButtonProps = {
  prompt: string;
};

export function CopyPromptButton({ prompt }: CopyPromptButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy prompt', error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-input border border-border px-3 py-2 text-xs font-semibold uppercase tracking-micro text-text-primary transition hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
      aria-label="Copy prompt"
    >
      {copied ? 'Copied!' : 'Copy prompt'}
    </button>
  );
}
