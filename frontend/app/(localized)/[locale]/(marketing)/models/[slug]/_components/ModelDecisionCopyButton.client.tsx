'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';

import { copyTextToClipboard } from '@/lib/clipboard';
import { UIIcon } from '@/components/ui/UIIcon';

type ModelDecisionCopyButtonProps = {
  copyText: string;
  label: string;
  copiedLabel: string;
};

export function ModelDecisionCopyButton({ copyText, label, copiedLabel }: ModelDecisionCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<number | null>(null);
  const hasCopyText = copyText.trim().length > 0;

  useEffect(() => {
    setCopied(false);
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, [copyText]);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!hasCopyText) {
      setCopied(false);
      return;
    }

    const copiedToClipboard = await copyTextToClipboard(copyText);
    if (copiedToClipboard) {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
      setCopied(true);
      resetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimeoutRef.current = null;
      }, 1600);
    } else {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!hasCopyText}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
      <UIIcon icon={Copy} size={15} />
    </button>
  );
}
