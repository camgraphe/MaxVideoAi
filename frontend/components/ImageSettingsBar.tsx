'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import {
  FileImage,
  Images,
  Palette,
  Ratio,
  Scan,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { UIIcon } from '@/components/ui/UIIcon';
import { formatCompactResolutionLabel } from '@/lib/resolution-labels';

type ControlOption = {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
};

interface ImageSettingsBarProps {
  density?: 'default' | 'workspace';
  trailingControl?: ReactNode;
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
  const icons: Record<InlineControlKind, LucideIcon> = {
    images: Images,
    aspect: Ratio,
    resolution: Scan,
    format: FileImage,
    quality: Sparkles,
    style: Palette,
  };
  return <UIIcon icon={icons[kind]} size={16} strokeWidth={1.8} />;
}

function createInlineLabel(kind: InlineControlKind, label: string, compact: boolean, controlName: string) {
  return (
    <span className={clsx('inline-flex h-4 items-center leading-none', compact ? 'gap-1.5' : 'gap-2')}>
      <ControlIcon kind={kind} />
      <span className="sr-only">{controlName}: </span>
      <span className="block truncate leading-none">{label}</span>
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
  action = false,
}: {
  kind: InlineControlKind;
  options: ControlOption[];
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  action?: boolean;
}) {
  const { t } = useI18n();
  const names = { images: 'Images', aspect: 'Format', resolution: 'Resolution', format: 'File format', quality: 'Quality', style: 'Style' };
  const controlName = t(`workspace.header.controlLabels.${kind}`, names[kind]) ?? names[kind];
  if (!options.length) return null;
  return (
    <div className={clsx(compact ? 'min-w-0 flex-none' : 'min-w-0', action && 'app-output-count')}>
      <SelectMenu
        options={options.map((option) => ({
          ...option,
          label: createInlineLabel(
            kind,
            compact && kind === 'resolution'
              ? formatCompactResolutionLabel(String(option.label))
              : String(option.label),
            compact,
            controlName,
          ),
        }))}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="min-w-0"
        buttonClassName={clsx(
          'min-h-0 rounded-[7px] border-border bg-surface py-0 font-medium shadow-none dark:border-white/10 dark:bg-white/[0.07] dark:text-white/92 dark:hover:border-white/16 dark:hover:bg-white/[0.1]',
          action
            ? 'h-11 !min-w-0 gap-1.5 border-brand !bg-[image:var(--brand-gradient)] px-3 text-[11px] !text-on-brand shadow-card'
            : compact ? '!min-h-11 sm:h-9 sm:!min-h-0 !min-w-0 gap-1.5 px-2.5 text-xs' : 'h-10 px-3 text-[12px]'
        )}
        menuClassName={clsx('min-w-[12rem]', compact && 'app-experience app-settings-menu')}
        menuPlacement="top"
        portal={compact}
        hideChevron={false}
      />
    </div>
  );
}

export function ImageCountControl({
  value,
  options,
  onChange,
  action = false,
}: {
  value: number;
  options: ControlOption[];
  onChange: (value: number) => void;
  action?: boolean;
}) {
  return (
    <InlineControl
      kind="images"
      options={options}
      value={value}
      compact
      action={action}
      onChange={(nextValue) => onChange(Number(nextValue))}
    />
  );
}

export function ImageSettingsBar({
  density = 'default',
  trailingControl,
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
          'flex items-center',
          workspaceDensity ? 'w-full flex-wrap gap-1.5' : 'flex-wrap gap-2'
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
        {trailingControl}
      </div>
    </div>
  );
}
