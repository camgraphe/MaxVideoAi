'use client';

import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SelectMenu } from '@/components/ui/SelectMenu';

type ControlOption = {
  value: string | number | boolean;
  label: string;
};

interface ImageAdvancedSettingsProps {
  title: string;
  seed?: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
  };
  enableWebSearch?: {
    label: string;
    value: boolean;
    options: ControlOption[];
    onChange: (value: boolean) => void;
  };
  thinkingLevel?: {
    label: string;
    value: string;
    options: ControlOption[];
    onChange: (value: string) => void;
  };
  limitGenerations?: {
    label: string;
    value: boolean;
    options: ControlOption[];
    onChange: (value: boolean) => void;
  };
}

function AdvancedSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | number | boolean;
  options: ControlOption[];
  onChange: (value: string | number | boolean) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{label}</span>
      <SelectMenu
        options={options}
        value={value}
        onChange={onChange}
        buttonClassName="h-10 rounded-input border-border bg-surface px-3 py-0 text-sm"
        menuPlacement="top"
      />
    </label>
  );
}

export function ImageAdvancedSettings({
  title,
  seed,
  enableWebSearch,
  thinkingLevel,
  limitGenerations,
}: ImageAdvancedSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasContent = useMemo(
    () => Boolean(seed || enableWebSearch || thinkingLevel || limitGenerations),
    [enableWebSearch, limitGenerations, seed, thinkingLevel]
  );

  if (!hasContent) return null;

  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="min-h-0 h-auto w-full justify-between px-0 py-0 text-left font-normal"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-expanded={isOpen}
      >
        <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{title}</span>
        <svg
          className={clsx('h-4 w-4 text-text-muted transition-transform', isOpen ? 'rotate-180' : 'rotate-0')}
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>
      {isOpen ? (
        <div className="grid gap-3 rounded-input border border-border bg-surface-glass-60 p-3 md:grid-cols-2 xl:grid-cols-4">
          {seed ? (
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{seed.label}</span>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                placeholder={seed.placeholder}
                value={seed.value}
                onChange={(event) => seed.onChange(event.currentTarget.value)}
                className="h-10 rounded-input border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          ) : null}
          {thinkingLevel ? (
            <AdvancedSelect
              label={thinkingLevel.label}
              value={thinkingLevel.value}
              options={thinkingLevel.options}
              onChange={(value) => thinkingLevel.onChange(String(value))}
            />
          ) : null}
          {enableWebSearch ? (
            <AdvancedSelect
              label={enableWebSearch.label}
              value={enableWebSearch.value}
              options={enableWebSearch.options}
              onChange={(value) => enableWebSearch.onChange(Boolean(value))}
            />
          ) : null}
          {limitGenerations ? (
            <AdvancedSelect
              label={limitGenerations.label}
              value={limitGenerations.value}
              options={limitGenerations.options}
              onChange={(value) => limitGenerations.onChange(Boolean(value))}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
