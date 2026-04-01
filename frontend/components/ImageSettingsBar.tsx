'use client';

import clsx from 'clsx';
import { SelectMenu } from '@/components/ui/SelectMenu';

type ControlOption = {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
};

interface ImageSettingsBarProps {
  numImages?: {
    value: number;
    options: ControlOption[];
    onChange: (value: number) => void;
  };
  aspectRatio?: {
    value: string;
    options: ControlOption[];
    onChange: (value: string) => void;
  };
  resolution?: {
    value: string;
    options: ControlOption[];
    onChange: (value: string) => void;
    disabled?: boolean;
  };
  outputFormat?: {
    value: string;
    options: ControlOption[];
    onChange: (value: string) => void;
  };
}

function ControlIcon({ kind }: { kind: 'images' | 'aspect' | 'resolution' | 'format' }) {
  if (kind === 'images') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <path d="M4.5 6.2h7v8h-7z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8.5 4.2h7v8h-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'aspect') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <rect x="3.5" y="5.5" width="13" height="9" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 8v4m4-4v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'resolution') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <rect x="3.5" y="4.5" width="13" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 9.8h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
      <path
        d="M5 4.5h10v11H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7.5 8h5m-5 4h3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function createInlineLabel(kind: 'images' | 'aspect' | 'resolution' | 'format', label: string) {
  return (
    <span className="inline-flex items-center gap-2">
      <ControlIcon kind={kind} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function InlineControl({
  kind,
  options,
  value,
  onChange,
  disabled,
}: {
  kind: 'images' | 'aspect' | 'resolution' | 'format';
  options: ControlOption[];
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  disabled?: boolean;
}) {
  if (!options.length) return null;
  return (
    <div className="min-w-0">
      <SelectMenu
        options={options.map((option) => ({
          ...option,
          label: createInlineLabel(kind, String(option.label)),
        }))}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="min-w-0"
        buttonClassName="min-h-0 h-10 rounded-full border-border bg-surface px-3 py-0 text-[12px] font-medium shadow-none dark:border-white/10 dark:bg-white/[0.07] dark:text-white/92 dark:hover:border-white/16 dark:hover:bg-white/[0.1]"
        menuPlacement="top"
      />
    </div>
  );
}

export function ImageSettingsBar({ numImages, aspectRatio, resolution, outputFormat }: ImageSettingsBarProps) {
  return (
    <div className="min-w-0 flex-1">
      <div className={clsx('flex flex-wrap items-center gap-2')}>
        {numImages ? (
          <InlineControl
            kind="images"
            options={numImages.options}
            value={numImages.value}
            onChange={(value) => numImages.onChange(Number(value))}
          />
        ) : null}
        {aspectRatio ? (
          <InlineControl
            kind="aspect"
            options={aspectRatio.options}
            value={aspectRatio.value}
            onChange={(value) => aspectRatio.onChange(String(value))}
          />
        ) : null}
        {resolution ? (
          <InlineControl
            kind="resolution"
            options={resolution.options}
            value={resolution.value}
            onChange={(value) => resolution.onChange(String(value))}
            disabled={resolution.disabled}
          />
        ) : null}
        {outputFormat ? (
          <InlineControl
            kind="format"
            options={outputFormat.options}
            value={outputFormat.value}
            onChange={(value) => outputFormat.onChange(String(value))}
          />
        ) : null}
      </div>
    </div>
  );
}
