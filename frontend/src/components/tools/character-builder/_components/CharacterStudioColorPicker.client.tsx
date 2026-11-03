'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Pipette } from 'lucide-react';
import { normalizeStudioColor } from '@/lib/character-studio-colors';
import type { StudioCopy } from '../_lib/character-studio-copy';

export type StudioColorCopy = Pick<
  StudioCopy,
  | 'customColor'
  | 'otherColor'
  | 'colorHex'
  | 'invalidColor'
  | 'applyColor'
  | 'cancelColor'
  | 'colorHint'
  | 'remove'
>;

export function CharacterStudioColorPicker({
  label,
  value,
  initialColor,
  onChange,
  copy,
}: {
  label: string;
  value: string | null | undefined;
  initialColor: string;
  onChange: (color: string | null) => void;
  copy: StudioColorCopy;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initialColor);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const custom = normalizeStudioColor(value);
  const color = normalizeStudioColor(draft);
  useEffect(() => {
    setOpen(false);
  }, [value]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`${copy.customColor} — ${label}${custom ? ` (${custom})` : ''}`}
        title={`${copy.customColor} — ${label}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setDraft(custom ?? initialColor);
          setOpen(!open);
        }}
        className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition ${custom ? 'border-brand bg-brand/10 text-text-primary' : 'border-dashed border-border bg-surface text-text-secondary hover:border-border-hover'}`}
      >
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full border border-black/10"
          style={{
            background: custom ?? 'conic-gradient(#f87171, #facc15, #4ade80, #38bdf8, #c084fc, #f87171)',
          }}
        >
          {!custom ? <Pipette size={10} className="text-black" aria-hidden="true" /> : null}
        </span>
        {custom ?? copy.otherColor}
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={`${copy.customColor} — ${label}`}
          className="basis-full min-w-0 space-y-3 rounded-xl border border-border bg-surface p-3 shadow-sm"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className="flex items-end gap-3">
            <input
              type="color"
              aria-label={`${copy.customColor} — ${label}`}
              value={color ?? initialColor}
              onChange={(event) => setDraft(event.target.value)}
              className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-1"
            />
            <label className="min-w-0 flex-1 text-xs text-text-secondary">
              {copy.colorHex}
              <input
                type="text"
                value={draft}
                maxLength={7}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={!color}
                aria-describedby={`${panelId}-hint`}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && color) {
                    event.preventDefault();
                    onChange(color);
                    close();
                  }
                }}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-2.5 font-mono text-sm text-text-primary"
              />
            </label>
          </div>
          <p id={`${panelId}-hint`} className="text-xs leading-relaxed text-text-secondary">
            {color ? copy.colorHint : copy.invalidColor}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!color}
              onClick={() => {
                if (color) {
                  onChange(color);
                  close();
                }
              }}
              className="rounded-md bg-brand px-3 py-2 text-xs font-medium text-on-brand disabled:opacity-40"
            >
              {copy.applyColor}
            </button>
            <button type="button" onClick={close} className="px-2 py-2 text-xs text-text-secondary">
              {copy.cancelColor}
            </button>
            {custom ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  close();
                }}
                className="ml-auto px-1 py-2 text-xs text-text-secondary underline underline-offset-4"
              >
                {copy.remove}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
