'use client';

import {useLayoutEffect, useId, useRef, type ReactNode, type RefObject} from 'react';
import {X} from 'lucide-react';
import styles from '../studio-mobile.module.css';

/** Keep children mounted across breakpoints: timeline insertion identities live there. */
export function ConversationMobilePanel({mobile, open, title, closeLabel, kind, trigger, onClose, children}: {
  mobile: boolean;
  open: boolean;
  title: string;
  closeLabel: string;
  kind: 'references' | 'film';
  trigger: RefObject<HTMLButtonElement>;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!mobile) {
      if (!element.open) element.show();
      return;
    }
    if (!open) {
      if (element.open) element.close();
      return;
    }
    const opener = trigger.current;
    element.showModal();
    return () => {
      element.close();
      if (opener?.isConnected) opener.focus({preventScroll: true});
    };
  }, [mobile, open, trigger]);
  return <dialog ref={dialog} open={!mobile || undefined} className={mobile ? styles.panel : styles.desktopPanel} data-studio-panel={kind} role={mobile ? undefined : 'presentation'} aria-labelledby={mobile ? titleId : undefined}
    onCancel={event => {if (event.target === event.currentTarget) {event.preventDefault(); onClose();}}}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    {mobile && <header className={styles.panelHeading}><h2 id={titleId}>{title}</h2><button autoFocus type="button" aria-label={closeLabel} onClick={onClose}><X size={20}/></button></header>}
    {children}
  </dialog>;
}
