'use client';

/**
 * Glossary
 * Letterboxing: horizontal matte bars preserve wide aspect ratios inside taller frames.
 * Pillarboxing: vertical matte bars preserve tall aspect ratios inside wider frames.
 * Windowboxing: both horizontal and vertical matte bars when aspect mismatch occurs.
 * Contain vs Cover: contain shows full media with matte padding; cover crops to fill.
 */

import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';

type KnownAspectRatio = '16:9' | '9:16' | '1:1';

const KNOWN_ASPECT_CLASS: Record<KnownAspectRatio, string> = {
  '16:9': 'ar-16-9',
  '9:16': 'ar-9-16',
  '1:1': 'ar-1-1',
};

interface NormalizedAspect {
  ratio?: string;
  data: string;
  width?: number;
  height?: number;
}

function normalizeAspect(value?: string | null): NormalizedAspect {
  if (!value) return { ratio: undefined, data: 'auto' };
  const trimmed = value.trim();
  const canonical = trimmed.replace(/\s+/g, '').replace('*', ':').replace('/', ':');
  const parts = canonical.split(':').map(Number);
  if (parts.length === 2 && parts.every((part) => Number.isFinite(part) && part > 0)) {
    const [w, h] = parts;
    const normalized = `${w}:${h}` as KnownAspectRatio | string;
    return { ratio: `${w} / ${h}`, data: normalized, width: w, height: h };
  }
  if (KNOWN_ASPECT_CLASS[trimmed as KnownAspectRatio]) {
    const [rawW, rawH] = trimmed.split(':');
    const width = Number(rawW);
    const height = Number(rawH);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { ratio: `${width} / ${height}`, data: trimmed, width, height };
    }
    return { ratio: trimmed.replace(':', ' / '), data: trimmed };
  }
  return { ratio: undefined, data: 'auto' };
}

export interface AspectBoxProps {
  aspectRatio?: string | null;
  className?: string;
  children: ReactNode;
}

export function AspectBox({ aspectRatio, className, children }: AspectBoxProps) {
  const { ratio, data, width, height } = normalizeAspect(aspectRatio);
  const aspectKey = (data && KNOWN_ASPECT_CLASS[data as KnownAspectRatio]) || 'ar-auto';
  const inlineStyle: CSSProperties = ratio
    ? {
        aspectRatio: ratio,
        ['--aspect-box-padding' as keyof CSSProperties]: typeof width === 'number' && typeof height === 'number' ? `${(height / width) * 100}%` : undefined,
      }
    : {};

  return (
    <div
      data-ar={data}
      className={clsx('aspect-box', aspectKey, className)}
      style={inlineStyle}
    >
      <div className="aspect-box__inner">{children}</div>
    </div>
  );
}
