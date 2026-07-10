'use client';

import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

export type SelectOption = {
  value: string | number | boolean;
  label: string | ReactNode;
  disabled?: boolean;
  title?: string;
};

interface SelectMenuProps {
  options: SelectOption[];
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  disabled?: boolean;
  className?: string;
  hideChevron?: boolean;
  buttonClassName?: string;
  menuClassName?: string;
  menuPlacement?: 'auto' | 'bottom' | 'top';
  portal?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  filterText?: (option: SelectOption) => string;
  noResultsLabel?: string;
}

const BUTTON_BASE =
  'inline-flex w-full min-w-[140px] items-center justify-between gap-2 rounded-input border border-hairline bg-surface px-3 py-2 text-[12px] text-text-primary shadow-sm transition hover:border-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-white/[0.06] dark:text-white/92 dark:shadow-none dark:hover:border-white/16 dark:hover:bg-white/[0.09]';

function findNextEnabled(options: SelectOption[], start: number, delta: number): number {
  if (!options.length) return -1;
  const total = options.length;
  for (let step = 1; step <= total; step += 1) {
    const index = (start + delta * step + total) % total;
    if (!options[index]?.disabled) return index;
  }
  return -1;
}

function findFirstEnabled(options: SelectOption[]): number {
  return options.findIndex((option) => !option.disabled);
}

function OptionalPortal({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  return enabled ? createPortal(children, document.body) : children;
}

export function SelectMenu({
  options,
  value,
  onChange,
  disabled = false,
  className,
  hideChevron = false,
  buttonClassName,
  menuClassName,
  menuPlacement = 'bottom',
  portal = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  filterText,
  noResultsLabel = 'No results',
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [resolvedPlacement, setResolvedPlacement] = useState<'bottom' | 'top'>(
    menuPlacement === 'top' ? 'top' : 'bottom'
  );
  const [portalStyle, setPortalStyle] = useState<CSSProperties | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const triggerId = useId();
  const listboxId = useId();

  const selectedIndex = useMemo(
    () => options.findIndex((option) => String(option.value) === String(value)),
    [options, value]
  );
  const selectedOption = options[selectedIndex] ?? options[0];
  const selectedLabel = selectedOption?.label ?? String(value);
  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => {
      const haystack = filterText
        ? filterText(option)
        : typeof option.label === 'string'
          ? option.label
          : String(option.value);
      return haystack.toLowerCase().includes(normalizedQuery);
    });
  }, [filterText, options, query, searchable]);
  const selectedFilteredIndex = useMemo(
    () => filteredOptions.findIndex((option) => String(option.value) === String(value)),
    [filteredOptions, value]
  );

  useEffect(() => {
    if (!open) return;
    const nextIndex = selectedFilteredIndex >= 0 ? selectedFilteredIndex : findFirstEnabled(filteredOptions);
    setHighlightedIndex(nextIndex);
  }, [filteredOptions, open, selectedFilteredIndex]);

  useLayoutEffect(() => {
    if (!open) return;
    if (menuPlacement !== 'auto') {
      setResolvedPlacement(menuPlacement === 'top' ? 'top' : 'bottom');
      return;
    }

    const updatePlacement = () => {
      const container = containerRef.current;
      const menu = menuRef.current;
      if (!container || !menu) return;

      const rect = container.getBoundingClientRect();
      const menuHeight = menu.offsetHeight;
      const viewportHeight = window.innerHeight;
      const gap = 8;
      const spaceBelow = viewportHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      setResolvedPlacement(spaceBelow < menuHeight && spaceAbove > spaceBelow ? 'top' : 'bottom');
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [menuPlacement, open, filteredOptions.length]);

  useLayoutEffect(() => {
    if (!open || !portal) return;

    const updatePortalPosition = () => {
      const container = containerRef.current;
      const menu = menuRef.current;
      if (!container || !menu) return;

      const rect = container.getBoundingClientRect();
      const viewportPadding = 12;
      const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
      const triggerWidth = Math.min(rect.width, availableWidth);
      const menuWidth = Math.min(Math.max(triggerWidth, menu.offsetWidth), availableWidth);
      const maxLeft = Math.max(viewportPadding, window.innerWidth - viewportPadding - menuWidth);
      const left = Math.min(Math.max(rect.left, viewportPadding), maxLeft);
      const nextStyle: CSSProperties =
        resolvedPlacement === 'top'
          ? { bottom: window.innerHeight - rect.top + 8, left, top: undefined, width: triggerWidth }
          : { bottom: undefined, left, top: rect.bottom + 8, width: triggerWidth };

      setPortalStyle((current) =>
        current?.bottom === nextStyle.bottom &&
        current?.left === nextStyle.left &&
        current?.top === nextStyle.top &&
        current?.width === nextStyle.width
          ? current
          : nextStyle
      );
    };

    updatePortalPosition();
    window.addEventListener('resize', updatePortalPosition);
    window.addEventListener('scroll', updatePortalPosition, true);
    return () => {
      window.removeEventListener('resize', updatePortalPosition);
      window.removeEventListener('scroll', updatePortalPosition, true);
    };
  }, [open, portal, portalStyle?.width, resolvedPlacement]);

  useEffect(() => {
    if (!open || !searchable) return;
    setQuery('');
  }, [open, searchable]);

  const previousValueRef = useRef(value);
  useEffect(() => {
    if (Object.is(previousValueRef.current, value)) return;
    previousValueRef.current = value;
    if (open) {
      setOpen(false);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as Node;
      const isWithinSelect = containerRef.current?.contains(target) || menuRef.current?.contains(target);
      if (!isWithinSelect) return;
      const targetTag = (event.target as HTMLElement | null)?.tagName;
      const isTypingTarget = targetTag === 'INPUT' || targetTag === 'TEXTAREA';
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (isTypingTarget && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((current) => {
          const base = current >= 0 ? current : selectedFilteredIndex;
          return findNextEnabled(filteredOptions, base, 1);
        });
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((current) => {
          const base = current >= 0 ? current : selectedFilteredIndex;
          return findNextEnabled(filteredOptions, base, -1);
        });
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        if (highlightedIndex < 0 || highlightedIndex >= filteredOptions.length) return;
        event.preventDefault();
        const option = filteredOptions[highlightedIndex];
        if (option?.disabled) return;
        onChange(option.value);
        setOpen(false);
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [filteredOptions, highlightedIndex, onChange, open, selectedFilteredIndex]);

  useEffect(() => {
    if (!open) return;
    if (!searchable) return;
    const nextIndex = selectedFilteredIndex >= 0 ? selectedFilteredIndex : findFirstEnabled(filteredOptions);
    setHighlightedIndex(nextIndex);
  }, [filteredOptions, open, searchable, selectedFilteredIndex]);

  useEffect(() => {
    if (!open) return;
    const target = optionRefs.current[highlightedIndex];
    if (target) {
      target.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, open]);

  if (!options.length) return null;

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <Button
        id={triggerId}
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        onKeyDown={handleTriggerKeyDown}
        className={clsx(BUTTON_BASE, disabled && 'cursor-not-allowed opacity-60', buttonClassName)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-disabled={disabled}
      >
        <span className="flex min-w-0 flex-1 items-center">
          {typeof selectedLabel === 'string' ? <span className="truncate">{selectedLabel}</span> : selectedLabel}
        </span>
        {!hideChevron ? (
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className={clsx('h-4 w-4 text-text-muted transition-transform', open && 'rotate-180')}
          >
            <path
              d="m6 8 4 4 4-4"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </Button>
      {open ? (
        <OptionalPortal enabled={portal}>
          <div
            ref={menuRef}
            className={clsx(
              'z-[80] w-full overflow-hidden rounded-card border border-border bg-surface p-1 shadow-card dark:border-white/10 dark:bg-[#121a25] dark:shadow-[0_18px_38px_rgba(0,0,0,0.42)]',
              portal ? 'fixed' : 'absolute left-0',
              !portal && (resolvedPlacement === 'top' ? 'bottom-full mb-2' : 'mt-2'),
              menuClassName
            )}
            style={portal ? portalStyle ?? { left: 0, top: 0, visibility: 'hidden', width: 0 } : undefined}
          >
            {searchable ? (
              <div className="px-1 pb-1">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-input border border-hairline bg-bg px-2 py-1 text-[12px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/35"
                />
              </div>
            ) : null}
            <ul
              id={listboxId}
              role="listbox"
              aria-labelledby={triggerId}
              className={clsx(
                'space-y-1 overflow-y-auto overflow-x-hidden text-[12px]',
                searchable ? 'max-h-56 pr-1' : 'max-h-60'
              )}
            >
              {filteredOptions.map((option, index) => {
                const isSelected = String(option.value) === String(value);
                const isHighlighted = index === highlightedIndex;
                return (
                  <li key={`${String(option.value)}-${index}`}>
                    <Button
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      type="button"
                      size="sm"
                      variant="ghost"
                      role="option"
                      aria-selected={isSelected}
                      title={option.title}
                      disabled={option.disabled}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => {
                        if (option.disabled) return;
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={clsx(
                        'min-h-0 h-auto w-full justify-between overflow-hidden rounded-input px-3 py-2 text-left',
                        option.disabled
                          ? 'cursor-not-allowed text-text-muted/60 dark:text-white/25'
                          : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary dark:text-white/70 dark:hover:bg-white/[0.08] dark:hover:text-white',
                        isSelected && !option.disabled && 'bg-surface-2 text-text-primary dark:bg-white/[0.12] dark:text-white',
                        isHighlighted && !option.disabled && !isSelected && 'bg-surface-2 dark:bg-white/[0.08]'
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center">
                        {typeof option.label === 'string' ? (
                          <span className="truncate">{option.label}</span>
                        ) : (
                          option.label
                        )}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
            {searchable && filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-text-muted">{noResultsLabel}</div>
            ) : null}
          </div>
        </OptionalPortal>
      ) : null}
    </div>
  );
}
