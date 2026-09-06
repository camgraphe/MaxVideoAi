'use client';

import type { PublicVideoQuality } from '@/lib/public-video-playback';

const labels = {
  en: { quality: 'Quality', auto: 'Auto', original: 'Original' },
  fr: { quality: 'Qualité', auto: 'Auto', original: 'Original' },
  es: { quality: 'Calidad', auto: 'Auto', original: 'Original' },
};

export function PublicVideoQualitySelect({ value, onChange, title, locale = 'en' }: {
  value: PublicVideoQuality;
  onChange: (value: PublicVideoQuality) => void;
  title: string;
  locale?: string;
}) {
  const copy = labels[locale as keyof typeof labels] ?? labels.en;
  return (
    <label className="inline-flex items-center gap-2 rounded-lg bg-black/70 px-2 py-1 text-xs text-white">
      <span>{copy.quality}</span>
      <select
        aria-label={`${copy.quality}: ${title}`}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value === 'original' ? 'original' : 'auto')}
        className="min-h-8 cursor-pointer rounded bg-black px-1 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="auto">{copy.auto}</option>
        <option value="original">{copy.original}</option>
      </select>
    </label>
  );
}
