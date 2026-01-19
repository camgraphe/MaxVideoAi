'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

export type SelectOption = {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
};

interface SelectMenuProps {
  options: SelectOption[];
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  disabled?: boolean;
  className?: string;
}

const BUTTON_BASE =
  'inline-flex w-full min-w-[140px] items-center justify-between gap-2 rounded-input border border-hairline bg-white px-3 py-2 text-[12px] text-text-primary shadow-sm transition hover:border-text-muted hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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

export function SelectMenu({ options, value, onChange, disabled = false, className }: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = useMemo(
    () => options.findIndex((option) => String(option.value) === String(value)),
    [options, value]
  );
  const selectedOption = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!open) return;
    const nextIndex = selectedIndex >= 0 ? selectedIndex : findFirstEnabled(options);
    setHighlightedIndex(nextIndex);
  }, [open, options, selectedIndex]);

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
      if (!containerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((current) => {
          const base = current >= 0 ? current : selectedIndex;
          return findNextEnabled(options, base, 1);
        });
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((current) => {
          const base = current >= 0 ? current : selectedIndex;
          return findNextEnabled(options, base, -1);
        });
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        if (highlightedIndex < 0 || highlightedIndex >= options.length) return;
        event.preventDefault();
        const option = options[highlightedIndex];
        if (option?.disabled) return;
        onChange(option.value);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [highlightedIndex, onChange, open, options, selectedIndex]);

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
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        onKeyDown={handleTriggerKeyDown}
        className={clsx(BUTTON_BASE, disabled && 'cursor-not-allowed opacity-60')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
      >
        <span className="truncate">{selectedOption?.label ?? String(value)}</span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={clsx('h-4 w-4 text-text-muted transition-transform', open && 'rotate-180')}
        >
          <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 z-[50] mt-2 max-h-60 overflow-y-auto rounded-[12px] border border-border bg-white/95 p-1 shadow-card backdrop-blur">
          <ul role="listbox" className="space-y-1 text-[12px]">
            {options.map((option, index) => {
              const isSelected = String(option.value) === String(value);
              const isHighlighted = index === highlightedIndex;
              return (
                <li key={`${String(option.value)}-${index}`}>
                  <button
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => {
                      if (option.disabled) return;
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={clsx(
                      'flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      option.disabled
                        ? 'cursor-not-allowed text-text-muted/60'
                        : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
                      isSelected && !option.disabled && 'bg-surface-2 text-text-primary',
                      isHighlighted && !option.disabled && !isSelected && 'bg-surface-2'
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
