'use client';

import clsx from 'clsx';
import { SelectMenu } from '@/components/ui/SelectMenu';

type ControlOption = {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
};

interface ImageSettingsBarProps {
  density?: 'default' | 'workspace';
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
  quality?: {
    value: string;
    options: ControlOption[];
    onChange: (value: string) => void;
  };
  style?: {
    value: string;
    options: ControlOption[];
    onChange: (value: string) => void;
  };
}

type InlineControlKind = 'images' | 'aspect' | 'resolution' | 'format' | 'quality' | 'style';

function ControlIcon({ kind }: { kind: InlineControlKind }) {
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
  if (kind === 'quality') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <path
          d="M10 3.5l1.8 4 4.2.5-3.1 2.9.8 4.1-3.7-2.1-3.7 2.1.8-4.1L4 8l4.2-.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'style') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <path
          d="M5.5 13.5c1.8-3.6 4.2-6.4 7.4-8.5 1.2-.8 2.7.7 1.9 1.9-2.1 3.2-4.9 5.6-8.5 7.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M4.5 15.5c1.2.2 2.4-.1 3.2-.9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

function createInlineLabel(kind: InlineControlKind, label: string) {
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
  compact = false,
}: {
  kind: InlineControlKind;
  options: ControlOption[];
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  disabled?: boolean;
  compact?: boolean;
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
        buttonClassName={clsx(
          'min-h-0 rounded-full border-border bg-surface py-0 font-medium shadow-none dark:border-white/10 dark:bg-white/[0.07] dark:text-white/92 dark:hover:border-white/16 dark:hover:bg-white/[0.1]',
          compact ? 'h-9 px-2.5 text-[11px]' : 'h-10 px-3 text-[12px]'
        )}
        menuClassName="min-w-[12rem]"
        menuPlacement="top"
        portal={compact}
      />
    </div>
  );
}

export function ImageSettingsBar({
  density = 'default',
  numImages,
  aspectRatio,
  resolution,
  outputFormat,
  quality,
  style,
}: ImageSettingsBarProps) {
  const workspaceDensity = density === 'workspace';
  return (
    <div className="min-w-0 flex-1">
      <div
        data-settings-density={density}
        className={clsx(
          'flex items-center gap-2',
          workspaceDensity ? 'w-max min-w-full flex-nowrap' : 'flex-wrap'
        )}
      >
        {numImages ? (
          <InlineControl
            kind="images"
            options={numImages.options}
            value={numImages.value}
            compact={workspaceDensity}
            onChange={(value) => numImages.onChange(Number(value))}
          />
        ) : null}
        {aspectRatio ? (
          <InlineControl
            kind="aspect"
            options={aspectRatio.options}
            value={aspectRatio.value}
            compact={workspaceDensity}
            onChange={(value) => aspectRatio.onChange(String(value))}
          />
        ) : null}
        {resolution ? (
          <InlineControl
            kind="resolution"
            options={resolution.options}
            value={resolution.value}
            compact={workspaceDensity}
            onChange={(value) => resolution.onChange(String(value))}
            disabled={resolution.disabled}
          />
        ) : null}
        {quality ? (
          <InlineControl
            kind="quality"
            options={quality.options}
            value={quality.value}
            compact={workspaceDensity}
            onChange={(value) => quality.onChange(String(value))}
          />
        ) : null}
        {style ? (
          <InlineControl
            kind="style"
            options={style.options}
            value={style.value}
            compact={workspaceDensity}
            onChange={(value) => style.onChange(String(value))}
          />
        ) : null}
        {outputFormat ? (
          <InlineControl
            kind="format"
            options={outputFormat.options}
            value={outputFormat.value}
            compact={workspaceDensity}
            onChange={(value) => outputFormat.onChange(String(value))}
          />
        ) : null}
      </div>
    </div>
  );
}
