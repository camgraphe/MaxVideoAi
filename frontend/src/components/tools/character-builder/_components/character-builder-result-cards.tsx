'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { Check, Download, Loader2, Sparkles, WandSparkles } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { CharacterBuilderResult } from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';

export function ResultCard({
  result,
  selected,
  title,
  subtitle,
  badge,
  onOpen,
  onSelect,
  onDownload,
  onSave,
  onDuplicateSettings,
  saving,
  copy,
}: {
  result: CharacterBuilderResult;
  selected: boolean;
  title: string;
  subtitle: string;
  badge?: string | null;
  onOpen: () => void;
  onSelect: () => void;
  onDownload: () => void;
  onSave: () => void;
  onDuplicateSettings: () => void;
  saving: boolean;
  copy: CharacterCopy;
}) {
  return (
    <Card
      className={clsx(
        'overflow-hidden border bg-surface p-0 transition',
        selected ? 'border-brand shadow-[0_0_0_1px_rgba(11,107,255,0.2)]' : 'border-border'
      )}
    >
      <div className="relative">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <img src={result.thumbUrl ?? result.url} alt={copy.resultCard.generatedAlt} className="h-44 w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-micro text-white/70">{subtitle}</p>
            <p className="mt-1 text-sm font-semibold text-white">{title}</p>
          </div>
        </button>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {selected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-900 shadow-sm">
              <Check className="h-3.5 w-3.5" />
              {copy.resultCard.selected}
            </span>
          ) : <span />}
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-brand/90 px-2 py-1 text-[11px] font-semibold text-on-brand shadow-sm">
              {badge}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <Button variant={selected ? 'primary' : 'outline'} size="sm" onClick={onSelect} className="min-w-[92px]">
          {selected ? copy.resultCard.selected : copy.resultCard.select}
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDuplicateSettings}
            className="h-9 w-9 px-0"
            aria-label={copy.resultCard.duplicate}
            title={copy.resultCard.duplicate}
          >
            <WandSparkles className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="h-9 w-9 px-0"
            aria-label={copy.resultCard.save}
            title={copy.resultCard.save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            className="h-9 w-9 px-0"
            aria-label={copy.resultCard.download}
            title={copy.resultCard.download}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function PendingResultCard({
  title,
  subtitle,
  badge,
  copy,
}: {
  title: string;
  subtitle: string;
  badge?: string | null;
  copy: CharacterCopy;
}) {
  return (
    <Card className="overflow-hidden border border-border bg-surface/90 p-0">
      <div className="relative h-44 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(11,107,255,0.14),_transparent_60%),linear-gradient(180deg,rgba(148,163,184,0.08),transparent)]">
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_40%,rgba(11,107,255,0.08)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-micro text-white/70">{subtitle}</p>
          <p className="mt-1 text-sm font-semibold text-white">{title}</p>
        </div>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-900 shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {copy.resultCard.pending}
          </span>
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-brand/90 px-2 py-1 text-[11px] font-semibold text-on-brand shadow-sm">
              {badge}
            </span>
          ) : null}
        </div>
      </div>
      <div className="p-3">
        <p className="text-xs text-text-secondary">{copy.resultCard.pendingBody}</p>
      </div>
    </Card>
  );
}

export function EmptyResultsRail({ copy }: { copy: CharacterCopy }) {
  return (
    <Card className="border border-dashed border-border bg-bg/40 p-5">
      <p className="text-sm font-semibold text-text-primary">{copy.top.resultsTitle}</p>
      <p className="mt-2 text-sm text-text-secondary">{copy.resultCard.pendingBody}</p>
    </Card>
  );
}
