'use client';

import { useState } from 'react';

type CopyPromptButtonProps = {
  prompt: string;
  copyLabel?: string;
  copiedLabel?: string;
};

export function CopyPromptButton({
  prompt,
  copyLabel = 'Copy prompt',
  copiedLabel = 'Copied!',
}: CopyPromptButtonProps) {
  const [copied, setCopied] = useState(false);
  const disabled = !prompt?.trim();

  const handleCopy = async () => {
    if (disabled) return;
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
      className="rounded-input border border-border px-3 py-2 text-xs font-semibold uppercase tracking-micro text-text-primary transition hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={copyLabel}
      disabled={disabled}
    >
      {copied ? copiedLabel : copyLabel}
    </button>
  );
}
