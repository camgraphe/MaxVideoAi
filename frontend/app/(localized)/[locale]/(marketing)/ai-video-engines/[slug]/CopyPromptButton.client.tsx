'use client';

import { useState } from 'react';

export function CopyPromptButton({
  prompt,
  copyLabel = 'Copy prompt',
  copiedLabel = 'Copied',
}: {
  prompt: string;
  copyLabel?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(prompt);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-3"
    >
      {copied ? copiedLabel : copyLabel}
    </button>
  );
}
