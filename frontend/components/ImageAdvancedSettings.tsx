'use client';

import clsx from 'clsx';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import type { ImageAdvancedSettingsContentProps } from './image-advanced-settings/ImageAdvancedSettingsContent';

const ImageAdvancedSettingsContent = dynamic<ImageAdvancedSettingsContentProps>(
  () =>
    import('./image-advanced-settings/ImageAdvancedSettingsContent').then(
      (mod) => mod.ImageAdvancedSettingsContent
    ),
  { ssr: false }
);

export type ImageAdvancedSettingsProps = ImageAdvancedSettingsContentProps & {
  title: string;
};

export function ImageAdvancedSettings({
  title,
  seed,
  maskUrl,
  customImageSize,
  enableWebSearch,
  thinkingLevel,
  limitGenerations,
  watermark,
}: ImageAdvancedSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasContent = useMemo(
    () => Boolean(seed || maskUrl || customImageSize || enableWebSearch || thinkingLevel || limitGenerations || watermark),
    [customImageSize, enableWebSearch, limitGenerations, maskUrl, seed, thinkingLevel, watermark]
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
        <ImageAdvancedSettingsContent
          seed={seed}
          maskUrl={maskUrl}
          customImageSize={customImageSize}
          enableWebSearch={enableWebSearch}
          thinkingLevel={thinkingLevel}
          limitGenerations={limitGenerations}
          watermark={watermark}
        />
      ) : null}
    </div>
  );
}
