'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import controls from '../../_styles/studio-controls.module.css';

type StudioPopoverTriggerProps = {
  'aria-controls': string;
  'aria-expanded': boolean;
  'aria-haspopup': 'dialog';
  id: string;
  onClick: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  ref: (node: HTMLButtonElement | null) => void;
};

type StudioPopoverProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  initialFocusSelector?: string;
  label: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  panelClassName?: string;
  trigger: (props: StudioPopoverTriggerProps) => ReactNode;
};

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function stableControlId(prefix: string, reactId: string): string {
  return `${prefix}-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function firstFocusable(root: HTMLElement | null): HTMLElement | null {
  return root?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? null;
}

export function StudioPopover({
  children,
  className,
  id,
  initialFocusSelector,
  label,
  onOpenChange,
  open,
  panelClassName,
  trigger,
}: StudioPopoverProps) {
  const reactId = useId();
  const popoverId = id ?? stableControlId('studio-popover', reactId);
  const triggerId = `${popoverId}-trigger`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const closePopover = useCallback((returnFocus = true) => {
    onOpenChange(false);
    if (!returnFocus) return;
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const preferred = initialFocusSelector
        ? panelRef.current?.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      (preferred ?? firstFocusable(panelRef.current) ?? panelRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialFocusSelector, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      closePopover(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePopover(true);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePopover, open]);

  const triggerProps: StudioPopoverTriggerProps = {
    'aria-controls': popoverId,
    'aria-expanded': open,
    'aria-haspopup': 'dialog',
    id: triggerId,
    onClick: () => onOpenChange(!open),
    onKeyDown: (event) => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      onOpenChange(true);
    },
    ref: (node) => {
      triggerRef.current = node;
    },
  };

  return (
    <div ref={rootRef} className={className}>
      {trigger(triggerProps)}
      {open ? (
        <div
          ref={panelRef}
          id={popoverId}
          className={`${controls.focusScope} ${panelClassName ?? ''}`}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
