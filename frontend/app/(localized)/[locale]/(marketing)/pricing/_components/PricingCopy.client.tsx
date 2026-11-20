'use client';

import { useState } from 'react';

export function PricingCopy({ text, label, copied, manual }: { text: string; label: string; copied: string; manual: string }) {
  const [result, setResult] = useState<'copied' | 'manual' | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setResult('copied');
    } catch {
      setResult('manual');
    }
  }
  return <span className="inline-flex flex-wrap items-center gap-2">
    <button type="button" onClick={copy} className="rounded border border-hairline px-2 py-1 text-sm font-semibold">{label}</button>
    <span role="status" className="text-sm">{result === 'copied' ? copied : result === 'manual' ? manual : null}</span>
    {result === 'manual' && <textarea aria-label={label} readOnly value={text} onFocus={event => event.currentTarget.select()} />}
  </span>;
}
