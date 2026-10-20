'use client';

import { useState } from 'react';
import { ArrowUpRight, Check, Copy, Sparkles } from 'lucide-react';
import { McpIntegrationMark } from '@/components/marketing/mcp/McpIntegrationMark';
import { copyTextToClipboard } from '@/lib/clipboard';
import { buildAssistantRequestHref, buildExampleRequest, type ExampleRequestSource } from '@/lib/example-continuation';
import { exampleContinuationCopy } from '@/lib/example-continuation-copy';
import styles from './example-reader-styles';

export function ExampleContinuationActions({ source, locale }: { source: ExampleRequestSource; locale: string }) {
  const copy = exampleContinuationCopy(locale);
  const request = buildExampleRequest(source, locale, 'assistant');
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const studioHref = `/app/studio?${new URLSearchParams({ example: source.id, lang: locale })}`;
  async function copyRequest(button?: HTMLElement) {
    const copied = await copyTextToClipboard(request);
    if (button?.isConnected) button.focus({ preventScroll: true });
    setStatus(copied ? 'copied' : 'error');
  }
  return <div className={styles.continuation}>
    <a className={styles.studioCta} href={studioHref}>
      <Sparkles size={17} aria-hidden="true"/><span>{copy.studio}</span><ArrowUpRight size={16} aria-hidden="true"/>
    </a>
    <div className={styles.assistants}>
      <p className={styles.continuationLabel}>{copy.continueWith}</p>
      <div className={styles.assistantOptions}>
        {(['chatgpt', 'claude'] as const).map(assistant => <a key={assistant} className={styles.assistantCta}
          href={buildAssistantRequestHref(assistant, request)} target="_blank" rel="noopener noreferrer"
          aria-label={`${copy.continueWith} ${assistant === 'chatgpt' ? 'ChatGPT' : 'Claude'} (${copy.newTab})`}
          onClick={event => { void copyRequest(event.currentTarget); }}>
          <McpIntegrationMark integration={assistant} size={20} className="h-5 w-5"/>
          <span>{assistant === 'chatgpt' ? 'ChatGPT' : 'Claude'}</span><ArrowUpRight size={13} aria-hidden="true"/>
        </a>)}
      </div>
      <p className={styles.continuationHint}>{copy.hint}</p>
      <button type="button" className={styles.requestCopy} onClick={event => { void copyRequest(event.currentTarget); }}>
        {status === 'copied' ? <Check size={14} aria-hidden="true"/> : <Copy size={14} aria-hidden="true"/>}{status === 'copied' ? copy.copied : copy.copy}
      </button>
      <p className={status === 'error' ? styles.copyStatus : 'sr-only'} role="status">{status === 'copied' ? copy.copied : status === 'error' ? copy.copyError : ''}</p>
      {status === 'error' && <textarea className={styles.copyFallback} aria-label={copy.manualCopy} value={request} readOnly onFocus={event => event.currentTarget.select()}/>}
    </div>
  </div>;
}
