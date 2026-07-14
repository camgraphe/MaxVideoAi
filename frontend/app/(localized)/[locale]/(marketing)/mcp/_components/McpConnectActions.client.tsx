'use client';

import { useState, type MouseEvent } from 'react';

import clientActionFlagsJson from '@/config/mcp-client-actions.json';
import { dispatchGaEvent } from '@/lib/analytics/ga-events';
import type { AppLocale } from '@/i18n/locales';
import type {
  McpClientActionCopy,
  McpClientId,
  McpConnectActionsCopy,
} from '../_lib/mcp-page-types';
import { McpClientActions } from './McpClientActions';

const NAVIGATION_WAIT_MS = 750;
const clientActionFlags = clientActionFlagsJson as Record<
  McpClientId,
  { deepLinkEnabled: boolean; deepLink: string | null }
>;

type CopyStatus = { client: McpClientId; state: 'copied' | 'error' } | null;

function resolvedActions(actions: McpClientActionCopy[]): McpClientActionCopy[] {
  return actions.map((action) => {
    const flag = clientActionFlags[action.client];
    return flag.deepLinkEnabled && flag.deepLink
      ? { ...action, href: flag.deepLink }
      : action;
  });
}

function isPlainPrimaryClick(event: MouseEvent<HTMLDivElement>): boolean {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

async function recordAcquisition(client: McpClientId, action: 'connect' | 'copy_endpoint') {
  try {
    return await fetch('/api/mcp/acquisition', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        source: 'mcp_landing',
        medium: 'owned',
        campaign: 'mcp_connect',
        client,
      }),
    });
  } catch {
    return null;
  }
}

export function McpConnectActions({
  actions,
  copy,
  resourceUrl,
  locale,
}: {
  actions: McpClientActionCopy[];
  copy: McpConnectActionsCopy;
  resourceUrl: string;
  locale: AppLocale;
}) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);
  const renderedActions = resolvedActions(actions);

  function handleActionClick(event: MouseEvent<HTMLDivElement>) {
    if (!isPlainPrimaryClick(event) || !(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>('a[data-client]');
    if (!anchor || !event.currentTarget.contains(anchor)) return;
    const client = anchor.dataset.client;
    if (client !== 'claude' && client !== 'codex') return;

    event.preventDefault();
    const usesDeepLink =
      clientActionFlags[client].deepLinkEnabled && Boolean(clientActionFlags[client].deepLink);
    void dispatchGaEvent('mcp_landing_cta_clicked', {
      action: 'connect',
      client,
      destination: usesDeepLink ? 'verified_deep_link' : 'setup_guide',
      locale,
    });

    let navigated = false;
    const navigate = () => {
      if (navigated) return;
      navigated = true;
      window.location.assign(anchor.href);
    };
    const timeout = window.setTimeout(navigate, NAVIGATION_WAIT_MS);
    void recordAcquisition(client, 'connect').finally(() => {
      window.clearTimeout(timeout);
      navigate();
    });
  }

  async function copyEndpoint(client: McpClientId) {
    setCopyStatus(null);
    void dispatchGaEvent('mcp_endpoint_copy_clicked', {
      action: 'copy_endpoint',
      client,
      destination: 'manual_setup',
      locale,
    });
    void recordAcquisition(client, 'copy_endpoint');
    try {
      await navigator.clipboard.writeText(resourceUrl);
      setCopyStatus({ client, state: 'copied' });
    } catch {
      setCopyStatus({ client, state: 'error' });
    }
  }

  return (
    <div className="rounded-[12px] border border-hairline bg-bg p-3 text-text-primary dark:border-white/[0.12] dark:bg-bg dark:text-white">
      <div onClick={handleActionClick}>
        <McpClientActions actions={renderedActions} />
      </div>
      <div className="mt-3 rounded-[10px] border border-hairline bg-surface p-3 dark:border-white/[0.12] dark:bg-white/[0.045]">
        <p className="text-xs font-semibold text-text-secondary dark:text-white/70">
          {copy.endpointLabel}
        </p>
        <code className="mt-1 block select-all overflow-x-auto text-xs text-text-primary dark:text-white">
          {resourceUrl}
        </code>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {renderedActions.map((action) => (
            <button
              key={action.client}
              type="button"
              data-copy-endpoint={action.client}
              onClick={() => void copyEndpoint(action.client)}
              className="min-h-10 rounded-[10px] border border-hairline bg-bg px-3 text-sm font-semibold text-text-primary transition hover:border-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:border-white/[0.14] dark:bg-neutral-900 dark:text-white dark:hover:border-white/[0.28]"
            >
              {copy.copyEndpoint} · {action.client === 'claude' ? 'Claude' : 'Codex'}
            </button>
          ))}
        </div>
        <p
          className="mt-2 min-h-5 text-xs text-text-muted dark:text-white/60"
          role="status"
          aria-live="polite"
        >
          {copyStatus ? (copyStatus.state === 'copied' ? copy.copied : copy.copyError) : ''}
        </p>
      </div>
    </div>
  );
}
