'use client';

import { useState } from 'react';

import type { IntegrationPageCopy } from '../_lib/integration-copy';

type CopyState = 'instruction' | 'endpoint' | 'error' | null;

export function IntegrationInstallCopy({
  copy,
  instruction,
  resourceUrl,
}: {
  copy: IntegrationPageCopy['setup']['installAction'];
  instruction: string;
  resourceUrl: string;
}) {
  const [state, setState] = useState<CopyState>(null);

  async function copyText(value: string, nextState: Exclude<CopyState, 'error' | null>) {
    setState(null);
    try {
      await navigator.clipboard.writeText(value);
      setState(nextState);
    } catch {
      setState('error');
    }
  }

  const status = state === 'instruction'
    ? copy.copiedInstruction
    : state === 'endpoint'
      ? copy.copiedEndpoint
      : state === 'error'
        ? copy.copyError
        : '';

  return (
    <div className="rounded-[14px] border border-text-primary/15 bg-bg px-5 py-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] dark:border-white/[0.16] dark:bg-white/[0.055] dark:shadow-none sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">
        {copy.eyebrow}
      </p>
      <h4 className="mt-1 text-xl font-semibold tracking-tight text-text-primary dark:text-white">{copy.title}</h4>
      <p className="mt-2 max-w-[760px] text-sm leading-6 text-text-secondary dark:text-white/68">{copy.body}</p>
      <button
        type="button"
        data-copy-install-instructions
        onClick={() => void copyText(instruction, 'instruction')}
        className="mt-4 min-h-12 w-full rounded-[10px] bg-text-primary px-5 text-sm font-semibold text-bg transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:bg-white dark:text-black sm:w-auto sm:min-w-[320px]"
      >
        {copy.copyInstruction}
      </button>
      <p className="mt-2 min-h-5 text-xs text-text-secondary dark:text-white/68" role="status" aria-live="polite">
        {status}
      </p>
      <details className="group mt-2 border-t border-hairline pt-3 dark:border-white/[0.12]">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-text-secondary marker:content-none dark:text-white/68">
          {copy.showInstruction}
          <span aria-hidden="true" className="transition group-open:rotate-180">⌄</span>
        </summary>
        <p className="mt-3 whitespace-pre-wrap border-l-2 border-text-primary/25 pl-3 text-sm leading-6 text-text-primary dark:border-white/30 dark:text-white">
          {instruction}
        </p>
        <button
          type="button"
          data-copy-endpoint
          onClick={() => void copyText(resourceUrl, 'endpoint')}
          className="mt-3 min-h-10 text-sm font-semibold text-text-primary underline decoration-hairline underline-offset-4 transition hover:decoration-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-white"
        >
          {copy.copyEndpoint}
        </button>
      </details>
    </div>
  );
}
