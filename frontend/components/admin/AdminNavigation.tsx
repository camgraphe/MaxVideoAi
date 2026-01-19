'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';

type NavSection = {
  title: string;
  items: Array<{ label: string; href: string }>;
};

type AdminNavigationProps = {
  sections: NavSection[];
};

export function AdminNavigation({ sections }: AdminNavigationProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (openIndex === null) return;

    function handlePointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (!containerRef.current?.contains(target)) {
        setOpenIndex(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenIndex(null);
      }
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer, { passive: true });
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openIndex]);

  const navSections = useMemo(() => sections, [sections]);

  return (
    <div ref={containerRef} className="flex items-center gap-3 text-sm text-text-secondary">
      {navSections.map((section, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={section.title} className="relative">
            <button
              type="button"
              onClick={() => setOpenIndex((current) => (current === index ? null : index))}
              className={clsx(
                'flex items-center gap-1 rounded-pill px-2 py-1 text-xs font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isOpen ? 'bg-surface-2 text-text-primary' : 'text-text-muted hover:text-text-primary'
              )}
              aria-expanded={isOpen}
              aria-haspopup="true"
            >
              {section.title}
              <svg
                className={clsx('h-3 w-3 transition-transform', isOpen ? 'rotate-180' : 'rotate-0')}
                viewBox="0 0 12 12"
                aria-hidden
              >
                <path
                  d="M2.47 4.97a.75.75 0 0 1 1.06 0L6 7.44l2.47-2.47a.75.75 0 0 1 1.06 1.06L6.53 9.03a1.5 1.5 0 0 1-2.12 0L2.47 6.03a.75.75 0 0 1 0-1.06Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            {isOpen ? (
              <div className="absolute right-0 z-50 mt-3 w-60 overflow-hidden rounded-card border border-border bg-white shadow-2xl">
                <ul className="divide-y divide-border">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpenIndex(null)}
                        className="flex items-center justify-between px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span>{item.label}</span>
                        <span aria-hidden className="text-xs text-text-muted">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
