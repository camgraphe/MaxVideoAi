'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

type CopyPromptButtonProps = {
  prompt?: string;
  promptElementId?: string;
  copyLabel?: string;
  copiedLabel?: string;
};

export function CopyPromptButton({
  prompt,
  promptElementId,
  copyLabel = 'Copy prompt',
  copiedLabel = 'Copied!',
}: CopyPromptButtonProps) {
  const [copied, setCopied] = useState(false);
  const disabled = !prompt?.trim() && !promptElementId;

  const handleCopy = async () => {
    if (disabled) return;
    const text = prompt?.trim()
      ? prompt
      : promptElementId
        ? document.getElementById(promptElementId)?.textContent ?? ''
        : '';
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy prompt', error);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="px-3 py-2 text-xs font-semibold uppercase tracking-micro text-text-primary hover:bg-bg"
      aria-label={copyLabel}
      disabled={disabled}
    >
      {copied ? copiedLabel : copyLabel}
    </Button>
  );
}
