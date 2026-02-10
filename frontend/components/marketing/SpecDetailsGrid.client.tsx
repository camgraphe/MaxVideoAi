'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';

export type SpecDetailsSection = {
  title: string;
  intro?: string | null;
  items: string[];
};

export function SpecDetailsGrid({ sections }: { sections: SpecDetailsSection[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="grid grid-gap-sm sm:grid-cols-2">
      {sections.map((section) => (
        <article
          key={section.title}
          className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
        >
          <details
            open={open}
            onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
            className="group rounded-xl px-0 py-0 text-sm text-text-secondary"
          >
            <summary className="cursor-pointer list-none text-lg font-semibold text-text-primary">
              <span className="flex items-center justify-between gap-3">
                <span>{section.title}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                  Details
                  <UIIcon
                    icon={ChevronDown}
                    size={14}
                    className="text-text-muted transition group-open:rotate-180"
                  />
                </span>
              </span>
            </summary>
            <div className="mt-2 stack-gap-sm">
              {section.intro ? <p className="text-sm text-text-secondary">{section.intro}</p> : null}
              <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}
