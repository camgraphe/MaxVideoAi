'use client';

import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import controls from '../../_styles/studio-controls.module.css';

type StudioDialogProps = {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  closeOnOverlayMouseDown?: boolean;
  dialogClassName?: string;
  id?: string;
  initialFocusSelector?: string;
  onClose: () => void;
  open: boolean;
  overlayClassName?: string;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'details > summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => (
    element.getAttribute('aria-hidden') !== 'true' &&
    getComputedStyle(element).visibility !== 'hidden'
  ));
}

export function StudioDialog({
  ariaLabel,
  ariaLabelledBy,
  children,
  closeOnOverlayMouseDown = true,
  dialogClassName,
  id,
  initialFocusSelector,
  onClose,
  open,
  overlayClassName,
}: StudioDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        window.requestAnimationFrame(() => previousFocusRef.current?.focus());
      }
      return;
    }

    wasOpenRef.current = true;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const preferred = initialFocusSelector
        ? dialogRef.current?.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      (preferred ?? focusableElements(dialogRef.current)[0] ?? dialogRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialFocusSelector, open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusables = focusableElements(dialogRef.current);
    if (!focusables.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const handleOverlayMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!closeOnOverlayMouseDown || event.target !== event.currentTarget) return;
    onClose();
  };

  if (!open) return null;

  return (
    <div className={overlayClassName} role="presentation" onMouseDown={handleOverlayMouseDown}>
      <div
        ref={dialogRef}
        id={id}
        className={`${controls.focusScope} ${dialogClassName ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
