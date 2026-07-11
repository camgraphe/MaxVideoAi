'use client';

import { SelectMenu } from '@/components/ui/SelectMenu';

type ControlOption = {
  value: string | number | boolean;
  label: string;
};

export type ImageAdvancedSettingsContentProps = {
  seed?: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
  };
  maskUrl?: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
  };
  customImageSize?: {
    widthLabel: string;
    heightLabel: string;
    widthValue: string;
    heightValue: string;
    min: number;
    max: number;
    step: number;
    onWidthChange: (value: string) => void;
    onHeightChange: (value: string) => void;
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
  watermark?: {
    label: string;
    value: boolean;
    options: ControlOption[];
    onChange: (value: boolean) => void;
  };
};

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

export function ImageAdvancedSettingsContent({
  seed,
  maskUrl,
  customImageSize,
  enableWebSearch,
  thinkingLevel,
  limitGenerations,
  watermark,
}: ImageAdvancedSettingsContentProps) {
  return (
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
      {customImageSize ? (
        <>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
              {customImageSize.widthLabel}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={customImageSize.min}
              max={customImageSize.max}
              step={customImageSize.step}
              value={customImageSize.widthValue}
              onChange={(event) => customImageSize.onWidthChange(event.currentTarget.value)}
              className="h-10 rounded-input border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
              {customImageSize.heightLabel}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={customImageSize.min}
              max={customImageSize.max}
              step={customImageSize.step}
              value={customImageSize.heightValue}
              onChange={(event) => customImageSize.onHeightChange(event.currentTarget.value)}
              className="h-10 rounded-input border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </>
      ) : null}
      {maskUrl ? (
        <label className="flex min-w-0 flex-col gap-1.5 md:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{maskUrl.label}</span>
          <input
            type="url"
            inputMode="url"
            placeholder={maskUrl.placeholder}
            value={maskUrl.value}
            onChange={(event) => maskUrl.onChange(event.currentTarget.value)}
            className="h-10 rounded-input border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
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
      {watermark ? (
        <AdvancedSelect
          label={watermark.label}
          value={watermark.value}
          options={watermark.options}
          onChange={(value) => watermark.onChange(Boolean(value))}
        />
      ) : null}
    </div>
  );
}
