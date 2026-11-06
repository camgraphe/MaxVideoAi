'use client';
import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import type { StudioChoice, StudioLocale } from '@/lib/character-studio-catalog';
import { normalizeStudioColor } from '@/lib/character-studio-colors';
import { CharacterStudioColorPicker, type StudioColorCopy } from './CharacterStudioColorPicker.client';

const atlases = {
  gallery: [4, 2],
  identity: [4, 3],
  creatures: [2, 2],
  eyes: [3, 2],
  hairCatalog: [4, 3],
  fashion: [4, 2],
  scenes: [6, 4],
} as const;
export function StudioImage({
  atlas,
  tile,
  className = '',
}: {
  atlas: keyof typeof atlases;
  tile: number;
  className?: string;
}) {
  const [cols, rows] = atlases[atlas];
  return (
    <span
      aria-hidden="true"
      className={`block bg-no-repeat ${className}`}
      style={
        {
          backgroundImage: `url(/assets/tools/character-studio/${atlas}.webp)`,
          backgroundSize: `${cols * 100}% ${rows * 100}%`,
          backgroundPosition: `${((tile % cols) * 100) / (cols - 1)}% ${(Math.floor(tile / cols) * 100) / (rows - 1)}%`,
        } as CSSProperties
      }
    />
  );
}
export function StudioVisualChoices({
  options,
  value,
  onChange,
  atlas,
  locale,
  wide = false,
}: {
  options: StudioChoice[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  atlas: keyof typeof atlases;
  locale: StudioLocale;
  wide?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          className={`group relative flex min-w-0 flex-col overflow-hidden rounded-xl border text-left shadow-sm transition hover:-translate-y-0.5 motion-reduce:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${value === option.id ? 'border-brand ring-1 ring-brand' : 'border-border hover:border-border-hover hover:shadow-md'}`}
          onClick={() => onChange(value === option.id ? null : option.id)}
        >
          {atlas === 'eyes' ? (
            <span className="flex aspect-[3/2] w-full items-center overflow-hidden">
              <StudioImage atlas={atlas} tile={option.tile} className="aspect-square w-full shrink-0" />
            </span>
          ) : (
            <StudioImage
              atlas={option.atlas ?? atlas}
              tile={option.tile}
              className={`w-full ${atlas === 'hairCatalog' || atlas === 'identity' || atlas === 'creatures' ? 'aspect-square' : wide ? 'aspect-[4/3]' : 'aspect-[3/4]'}`}
            />
          )}
          <span className="block w-full flex-1 bg-surface px-2 py-2 text-xs leading-snug text-text-primary">
            {option.label[locale]}
          </span>
          {value === option.id ? (
            <span className="absolute right-1 top-1 rounded-full bg-brand p-1 text-on-brand">
              <Check size={12} />
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
export function StudioChips({
  label,
  options,
  value,
  onChange,
  colorCopy,
}: {
  label: string;
  options: Array<{ id: string; label: string; swatch?: string }>;
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  colorCopy?: StudioColorCopy;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-xs font-medium text-text-secondary">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            type="button"
            key={option.id}
            aria-pressed={value === option.id}
            onClick={() => onChange(value === option.id ? null : option.id)}
            className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition ${value === option.id ? 'border-brand bg-brand/10 text-text-primary' : 'border-border bg-surface text-text-secondary hover:border-border-hover'}`}
          >
            {option.swatch ? (
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/10"
                style={{ backgroundColor: option.swatch }}
              />
            ) : null}
            {option.label}
          </button>
        ))}
        {colorCopy ? (
          <CharacterStudioColorPicker
            label={label}
            value={value}
            initialColor={normalizeStudioColor(value) ?? options.find((option) => option.id === value)?.swatch ?? '#8B5CF6'}
            onChange={onChange}
            copy={colorCopy}
          />
        ) : null}
      </div>
    </fieldset>
  );
}
