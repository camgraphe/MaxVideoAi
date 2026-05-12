'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';

import { UIIcon } from '@/components/ui/UIIcon';

type ModelDecisionCopyButtonProps = {
  copyText: string;
  label: string;
  copiedLabel: string;
};

export function ModelDecisionCopyButton({ copyText, label, copiedLabel }: ModelDecisionCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <span>{copied ? copiedLabel : label}</span>
      <UIIcon icon={Copy} size={15} />
    </button>
  );
}
