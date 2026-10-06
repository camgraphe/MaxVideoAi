'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n/types';
import { AppAssistantConnections, appMcpIntegrations } from './AppAssistantConnections';

export function AppMcpShortcuts({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFocus = useRef<'first' | 'last' | null>(null);
  const pinned = useRef(false);
  const panelId = useId();
  const titleId = useId();
  const cancelLeave = useCallback(() => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }, []);
  const close = useCallback((restoreFocus = false) => {
    cancelLeave();
    pendingFocus.current = null;
    pinned.current = false;
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, [cancelLeave]);

  useEffect(() => cancelLeave, [cancelLeave]);
  useEffect(() => {
    if (!open) return;
    if (pendingFocus.current) {
      const links = panelRef.current?.querySelectorAll<HTMLAnchorElement>('a');
      const index = pendingFocus.current === 'last' ? (links?.length ?? 1) - 1 : 0;
      links?.[index]?.focus();
      pendingFocus.current = null;
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof window.Node && !rootRef.current?.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close(rootRef.current?.contains(document.activeElement) ?? false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, close]);

  if (!appMcpIntegrations.length) return null;
  return <div ref={rootRef} className="app-connect"
    onPointerEnter={event => { if (event.pointerType === 'mouse') { cancelLeave(); setOpen(true); } }}
    onPointerLeave={event => {
      if (event.pointerType !== 'mouse') return;
      cancelLeave();
      leaveTimer.current = setTimeout(() => {
        if (!pinned.current && !rootRef.current?.contains(document.activeElement)) close();
      }, 160);
    }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <button ref={triggerRef} className="app-connect-trigger" type="button" aria-expanded={open} aria-controls={panelId}
      onClick={() => {
        cancelLeave();
        if (pinned.current) close();
        else { pinned.current = true; setOpen(true); }
      }}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        pinned.current = true;
        const end = event.key === 'ArrowUp';
        if (open) {
          const links = panelRef.current?.querySelectorAll<HTMLAnchorElement>('a');
          links?.[end ? links.length - 1 : 0]?.focus();
        } else {
          pendingFocus.current = end ? 'last' : 'first';
          setOpen(true);
        }
      }}>
      <span>Connect</span><ChevronDown size={14} strokeWidth={1.6} aria-hidden="true" />
    </button>
    <nav ref={panelRef} id={panelId} className="app-connect-panel" aria-labelledby={titleId} hidden={!open}>
      <AppAssistantConnections locale={locale} onNavigate={() => close(true)} compact titleId={titleId} />
    </nav>
  </div>;
}
