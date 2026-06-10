'use client';

import type { ReactNode } from 'react';
import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';

const styles = { ...baseStyles, ...inspectorStyles };

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className={styles.settingsLabel}>{children}</label>;
}

export function SelectControl({
  value,
  onChange,
  children,
}: {
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select className={styles.settingsInput} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
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
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      className={styles.settingsInput}
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
    />
  );
}
