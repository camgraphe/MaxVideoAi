'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

import type { CharacterBuilderState } from '@/types/character-builder';

export const GENDER_CARD_META: Record<string, { glyph: string; background: string; accent: string }> = {
  woman: {
    glyph: 'W',
    background: 'linear-gradient(135deg, rgba(255,233,241,1), rgba(255,255,255,0.94))',
    accent: '#f472b6',
  },
  man: {
    glyph: 'M',
    background: 'linear-gradient(135deg, rgba(224,242,254,1), rgba(255,255,255,0.94))',
    accent: '#38bdf8',
  },
  androgynous: {
    glyph: 'A',
    background: 'linear-gradient(135deg, rgba(233,244,255,1), rgba(255,255,255,0.94))',
    accent: '#6366f1',
  },
  custom: {
    glyph: '+',
    background: 'linear-gradient(135deg, rgba(241,245,249,1), rgba(255,255,255,0.94))',
    accent: '#64748b',
  },
};

export const REALISM_CARD_META: Record<string, { background: string; accent: string }> = {
  photoreal: {
    background: 'linear-gradient(135deg, rgba(226,232,240,1), rgba(255,255,255,0.96))',
    accent: '#0f172a',
  },
  cinematic: {
    background: 'linear-gradient(135deg, rgba(254,242,242,1), rgba(255,255,255,0.96))',
    accent: '#b91c1c',
  },
  stylized: {
    background: 'linear-gradient(135deg, rgba(243,232,255,1), rgba(255,255,255,0.96))',
    accent: '#7c3aed',
  },
  animated: {
    background: 'linear-gradient(135deg, rgba(224,242,254,1), rgba(255,255,255,0.96))',
    accent: '#0284c7',
  },
};

const CHARACTER_SHEET_PREVIEW_URL =
  'https://media.maxvideoai.com/marketing/marketing/effc3c18-125d-4460-9adc-75216ac599cb.png';
const PORTRAIT_REFERENCE_PREVIEW_URL =
  'https://media.maxvideoai.com/marketing/marketing/cf56ca3b-ee2f-4daa-b328-e88b43efc390.png';

export function VisualChoiceCard({
  selected,
  onClick,
  title,
  subtitle,
  media,
  backgroundMedia,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  media?: ReactNode;
  backgroundMedia?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group isolate relative overflow-hidden rounded-[24px] border p-4 text-left transition',
        selected
          ? 'z-10 border-brand bg-brand/5 shadow-card'
          : 'border-border bg-surface hover:border-border-hover hover:bg-surface-hover hover:shadow-card',
        className
      )}
    >
      {backgroundMedia ? <div className="absolute inset-0">{backgroundMedia}</div> : null}
      {backgroundMedia ? (
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[rgba(0,0,0,0.82)] via-[rgba(0,0,0,0.42)] to-transparent" />
      ) : null}
      {selected ? (
        <span className="absolute right-3 top-3 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-on-brand shadow-[0_8px_18px_rgba(58,123,213,0.28)]">
          <Check className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {media ? <div className="relative z-10 mb-4">{media}</div> : null}
      <div
        className={clsx(
          backgroundMedia
            ? 'absolute inset-x-0 bottom-0 z-10 space-y-1 px-6 py-4'
            : 'relative z-10 space-y-1'
        )}
      >
        <p className={clsx('text-sm font-semibold', backgroundMedia ? 'text-white' : 'text-text-primary')}>
          {title}
        </p>
        {subtitle ? (
          <p className={clsx('text-xs', backgroundMedia ? 'text-white' : 'text-text-secondary')}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </button>
  );
}

export function IconChoiceCard({
  selected,
  title,
  glyph,
  background,
  accent,
  onClick,
}: {
  selected: boolean;
  title: string;
  glyph: string;
  background: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <VisualChoiceCard
      selected={selected}
      onClick={onClick}
      title={title}
      media={
        <div
          className="flex h-14 items-center justify-between rounded-[18px] border border-border/80 bg-surface-2/80 px-3.5"
          style={{ background }}
        >
          <div
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: `${accent}1f`, color: accent }}
          >
            {glyph}
          </div>
          <div className="flex items-end gap-1">
            <span className="h-5 w-5 rounded-full bg-surface shadow-sm" />
            <span className="h-7 w-7 rounded-[14px] bg-surface/80 shadow-sm" />
          </div>
        </div>
      }
      className="min-h-[120px] w-full max-w-[172px]"
    />
  );
}

export function StyleChoiceCard({
  selected,
  title,
  background,
  accent,
  onClick,
}: {
  selected: boolean;
  title: string;
  background: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <VisualChoiceCard
      selected={selected}
      onClick={onClick}
      title={title}
      media={
        <div
          className="relative h-[72px] overflow-hidden rounded-[18px] border border-border/80 bg-surface-2/80"
          style={{ background }}
        >
          <div
            className="absolute left-3 top-3 h-8 w-8 rounded-full"
            style={{ backgroundColor: `${accent}22` }}
          />
          <div
            className="absolute bottom-3 left-4 h-8 w-10 rounded-[16px]"
            style={{ backgroundColor: `${accent}cc` }}
          />
          <div className="absolute right-3 top-3 space-y-1">
            <div className="h-2 w-9 rounded-full bg-surface/85" />
            <div className="h-2 w-7 rounded-full bg-surface/65" />
          </div>
        </div>
      }
      className="min-h-[120px] w-full max-w-[172px]"
    />
  );
}

export function OutputPreviewCard({
  selected,
  title,
  subtitle,
  mode,
  onClick,
  compact = false,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  mode: CharacterBuilderState['outputMode'];
  onClick: () => void;
  compact?: boolean;
}) {
  return (
      <VisualChoiceCard
        selected={selected}
        onClick={onClick}
        title={title}
        subtitle={subtitle}
        backgroundMedia={
          mode === 'character-sheet' ? (
            <img
              src={CHARACTER_SHEET_PREVIEW_URL}
              alt={title}
              className="h-full w-full object-cover object-top"
              loading="lazy"
            />
          ) : mode === 'portrait-reference' ? (
            <img
              src={PORTRAIT_REFERENCE_PREVIEW_URL}
              alt={title}
              className="h-full w-full object-cover object-center"
              loading="lazy"
            />
          ) : undefined
        }
        className={clsx(
          compact ? 'min-w-0' : undefined,
          mode === 'character-sheet' || mode === 'portrait-reference'
            ? compact
              ? 'flex h-[150px] flex-col justify-end bg-black/5'
              : 'flex h-[260px] flex-col justify-end bg-black/5 md:h-[320px]'
            : undefined
        )}
      />
    );
}
