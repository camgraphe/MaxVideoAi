'use client';

import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';
import { McpIntegrationMark } from '@/components/marketing/mcp/McpIntegrationMark';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/lib/i18n/types';
import { AppAssistantConnections, appMcpIntegrations, getAppMcpCopy } from './AppAssistantConnections';
import { AppGlyph } from './AppGlyph';

export function AppMcpShortcuts({ locale }: { locale: Locale }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const copy = getAppMcpCopy(locale);
  const close = () => dialogRef.current?.close();

  useEffect(() => {
    const dialog = dialogRef.current;
    const restoreFocus = () => triggerRef.current?.focus();
    dialog?.addEventListener('close', restoreFocus);
    return () => dialog?.removeEventListener('close', restoreFocus);
  }, []);

  if (!appMcpIntegrations.length) return null;
  return <>
    <nav className="app-mcp-shortcuts" aria-label={copy.title}>
      <span className="app-mcp-label">MCP</span>
      {appMcpIntegrations.map(integration => <Link key={integration.id} href={getPathname({ locale, href: integration.href })} target="_blank" rel="noopener noreferrer" prefetch={false} title={`${integration.name} — ${copy.connect}`}>
        <McpIntegrationMark integration={integration.id} size={20} className="h-5 w-5" />
        <span>{integration.name}</span><span className="sr-only"> ({copy.newTab})</span>
      </Link>)}
    </nav>
    <button ref={triggerRef} className="app-mcp-trigger" type="button" aria-label={copy.title} aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
      <AppGlyph name="connect" /><span>MCP</span>
    </button>
    <dialog ref={dialogRef} className="app-site-dialog app-mcp-dialog" aria-labelledby={titleId} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="app-site-dialog-heading"><h2 id={titleId}>{copy.title}</h2><button type="button" onClick={close} autoFocus>{copy.close} ×</button></div>
      <div className="app-site-dialog-body"><AppAssistantConnections locale={locale} onNavigate={close} showTitle={false} /></div>
    </dialog>
  </>;
}
