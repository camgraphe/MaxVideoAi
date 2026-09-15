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

  return <div className="mcp-install-copy">
    <h4>{copy.title}</h4><p>{copy.body}</p>
    <div className="mcp-copy-buttons">{copy.copyInstructionEnabled ? <button type="button" data-copy-install-instructions onClick={() => void copyText(instruction, 'instruction')}>{copy.copyInstruction}</button> : null}<button type="button" data-copy-endpoint onClick={() => void copyText(resourceUrl, 'endpoint')}>{copy.copyEndpoint}</button></div>
    <p role="status" aria-live="polite">{status}</p>
    <details><summary>{copy.showInstruction}<span aria-hidden="true">+</span></summary><p>{instruction}</p></details>
  </div>;
}
