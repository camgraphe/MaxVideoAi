'use client';

import type { ReactNode } from 'react';
import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';

const styles = { ...baseStyles, ...inspectorStyles };

export function FieldLabel({ children, title }: { children: ReactNode; title?: string }) {
  return <label className={styles.settingsLabel} title={title}>{children}</label>;
}

export function SelectControl({
  value,
  onChange,
  children,
  disabled,
}: {
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <select className={styles.settingsInput} value={value} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)}>
      {children}
    </select>
  );
}

export function NumberControl({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      className={styles.settingsInput}
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
    />
  );
}
