'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';

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

function isPlainPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  const target = event.currentTarget.getAttribute('target');
  return (
    event.button === 0 &&
    (!target || target === '_self') &&
    !event.currentTarget.hasAttribute('download') &&
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
  navigate = (href) => window.location.assign(href),
}: {
  actions: McpClientActionCopy[];
  copy: McpConnectActionsCopy;
  resourceUrl: string;
  locale: AppLocale;
  navigate?: (href: string) => void;
}) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);
  const mountedRef = useRef(true);
  const pendingNavigationRef = useRef<{
    href: string;
    navigated: boolean;
    timerId: number | null;
  } | null>(null);
  const renderedActions = resolvedActions(actions);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const pending = pendingNavigationRef.current;
      if (pending?.timerId !== null && pending?.timerId !== undefined) {
        window.clearTimeout(pending.timerId);
      }
      pendingNavigationRef.current = null;
    };
  }, []);

  function trackConnectAction(client: McpClientId) {
    const usesDeepLink =
      clientActionFlags[client].deepLinkEnabled && Boolean(clientActionFlags[client].deepLink);
    void dispatchGaEvent('mcp_landing_cta_clicked', {
      action: 'connect',
      client,
      destination: usesDeepLink ? 'verified_deep_link' : 'setup_guide',
      locale,
    });
    return recordAcquisition(client, 'connect');
  }

  function handleActionClick(action: McpClientActionCopy) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isPlainPrimaryClick(event)) {
        void trackConnectAction(action.client);
        return;
      }

      event.preventDefault();
      if (pendingNavigationRef.current) return;

      const pending = {
        href: event.currentTarget.href,
        navigated: false,
        timerId: null as number | null,
      };
      pendingNavigationRef.current = pending;

      const navigateOnce = () => {
        if (!mountedRef.current || pending.navigated) return;
        pending.navigated = true;
        if (pending.timerId !== null) window.clearTimeout(pending.timerId);
        navigate(pending.href);
      };
      pending.timerId = window.setTimeout(navigateOnce, NAVIGATION_WAIT_MS);
      void trackConnectAction(action.client).finally(navigateOnce);
    };
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
      <McpClientActions actions={renderedActions} onActionClick={handleActionClick} />
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
