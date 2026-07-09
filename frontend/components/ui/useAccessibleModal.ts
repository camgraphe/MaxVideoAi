'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type UseAccessibleModalOptions = {
  onClose: () => void;
  closeDisabled?: boolean;
};

type ResolveModalTabTargetInput = {
  activeIndex: number;
  focusableCount: number;
  shiftKey: boolean;
  activeInside: boolean;
};

export function resolveModalTabTarget({
  activeIndex,
  focusableCount,
  shiftKey,
  activeInside,
}: ResolveModalTabTargetInput): number | null {
  if (focusableCount <= 0) return -1;
  if (!activeInside || activeIndex === -1) return shiftKey ? focusableCount - 1 : 0;
  if (shiftKey && activeIndex === 0) return focusableCount - 1;
  if (!shiftKey && activeIndex === focusableCount - 1) return 0;
  return null;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true' && element.tabIndex >= 0
  );
}

export function useAccessibleModal<T extends HTMLElement = HTMLDivElement>({
  onClose,
  closeDisabled = false,
}: UseAccessibleModalOptions) {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const preferred = dialog.querySelector<HTMLElement>('[data-modal-initial-focus="true"]');
      const target = preferred ?? getFocusableElements(dialog)[0] ?? dialog;
      target.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, []);

  const onDialogKeyDown = useCallback(
    (event: ReactKeyboardEvent<T>) => {
      if (event.key === 'Escape') {
        if (!closeDisabled) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusableElements(dialog);
      const active = document.activeElement;
      const activeIndex = focusable.findIndex((element) => element === active);
      const targetIndex = resolveModalTabTarget({
        activeIndex,
        focusableCount: focusable.length,
        shiftKey: event.shiftKey,
        activeInside: dialog.contains(active),
      });
      if (targetIndex === null) return;
      event.preventDefault();
      if (targetIndex === -1) {
        dialog.focus();
        return;
      }
      focusable[targetIndex]?.focus();
    },
    [closeDisabled]
  );

  return { dialogRef, onDialogKeyDown };
}
