'use client';

import {useEffect, useId, useRef, type ReactNode, type RefObject} from 'react';
import {X} from 'lucide-react';
import styles from '../studio-mobile.module.css';

/** Desktop renders the existing surface. Mobile keeps it in an accessible sheet. */
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
  useEffect(() => {
    const element = dialog.current;
    if (!mobile || !open || !element) return;
    const opener = trigger.current;
    element.showModal();
    return () => {
      element.close();
      if (opener?.isConnected) opener.focus({preventScroll: true});
    };
  }, [mobile, open, trigger]);
  if (!mobile) return <>{children}</>;
  return <dialog ref={dialog} className={styles.panel} data-studio-panel={kind} aria-labelledby={titleId}
    onCancel={event => {if (event.target === event.currentTarget) {event.preventDefault(); onClose();}}}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <header className={styles.panelHeading}><h2 id={titleId}>{title}</h2><button autoFocus type="button" aria-label={closeLabel} onClick={onClose}><X size={20}/></button></header>
    {children}
  </dialog>;
}
