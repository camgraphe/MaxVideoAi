'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import controls from '../../_styles/studio-controls.module.css';

type StudioMenuTriggerProps = {
  'aria-controls': string;
  'aria-expanded': boolean;
  'aria-haspopup': 'menu';
  id: string;
  onClick: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  ref: (node: HTMLButtonElement | null) => void;
};

type StudioMenuProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  label: string;
  menuClassName?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  trigger: (props: StudioMenuTriggerProps) => ReactNode;
};

const MENU_ITEM_SELECTOR = [
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
].join(',');

function stableControlId(prefix: string, reactId: string): string {
  return `${prefix}-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function enabledMenuItems(menu: HTMLElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)).filter((item) => (
    !item.hasAttribute('disabled') &&
    item.getAttribute('aria-disabled') !== 'true'
  ));
}

export function StudioMenu({
  children,
  className,
  id,
  label,
  menuClassName,
  onOpenChange,
  open,
  trigger,
}: StudioMenuProps) {
  const reactId = useId();
  const menuId = id ?? stableControlId('studio-menu', reactId);
  const triggerId = `${menuId}-trigger`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [pendingFocus, setPendingFocus] = useState<'first' | 'last'>('first');

  const closeMenu = useCallback((returnFocus = true) => {
    onOpenChange(false);
    if (!returnFocus) return;
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onOpenChange]);

  const focusMenuItem = useCallback((direction: 'first' | 'last') => {
    const items = enabledMenuItems(menuRef.current);
    const item = direction === 'last' ? items.at(-1) : items[0];
    item?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => focusMenuItem(pendingFocus));
    return () => window.cancelAnimationFrame(frame);
  }, [focusMenuItem, open, pendingFocus]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      closeMenu(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMenu(true);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, open]);

  const moveFocus = (direction: 1 | -1) => {
    const items = enabledMenuItems(menuRef.current);
    if (!items.length) return;
    const currentIndex = Math.max(0, items.findIndex((item) => item === document.activeElement));
    const nextIndex = (currentIndex + direction + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(-1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusMenuItem('first');
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusMenuItem('last');
    }
  };

  const triggerProps: StudioMenuTriggerProps = {
    'aria-controls': menuId,
    'aria-expanded': open,
    'aria-haspopup': 'menu',
    id: triggerId,
    onClick: () => {
      setPendingFocus('first');
      onOpenChange(!open);
    },
    onKeyDown: (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      setPendingFocus(event.key === 'ArrowUp' ? 'last' : 'first');
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
          ref={menuRef}
          id={menuId}
          className={`${controls.focusScope} ${menuClassName ?? ''}`}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
