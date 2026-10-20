'use client';
import { Check } from 'lucide-react';
import type { SubtitleStyle } from '@/lib/subtitles/document';
import { activeSubtitleWordStyle, subtitleAppearance, subtitlePresetCopy, SUBTITLE_PRESETS } from '@/lib/subtitles/presets';

export function SubtitleStylePicker({ locale, value, onChange, disabled = false }: {
  locale: string; value: SubtitleStyle['preset']; onChange(value: SubtitleStyle['preset']): void; disabled?: boolean;
}) {
  const copy = subtitlePresetCopy(locale);
  return <fieldset className="subtitle-style-picker" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
    <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{copy.title}</legend>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
      {SUBTITLE_PRESETS.map((preset, index) => <button key={preset} type="button" disabled={disabled} aria-pressed={value === preset} aria-label={copy.names[index]} onClick={() => onChange(preset)}
        style={{ minWidth: 0, border: `1px solid ${value === preset ? 'var(--creator-accent,var(--app-accent,#795024))' : 'var(--creator-line,var(--app-line,#d6d6cd))'}`, borderRadius: 9, padding: 5, background: value === preset ? 'rgba(127,86,39,.06)' : 'transparent', color: 'inherit', cursor: disabled ? 'default' : 'pointer', textAlign: 'left', opacity: disabled ? .6 : 1 }}>
        <span aria-hidden="true" style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', gap: '0 .25em', background: '#373b3e', color: '#fff', height: 67, borderRadius: 5, fontFamily: 'Arial, sans-serif', fontSize: 12, lineHeight: 1.65, ...subtitleAppearance(preset) }}>
          {preset === 'high-contrast' ? <span style={{ background: '#000', padding: '0 .3em' }}>{copy.sample.join(' ')}</span> : copy.sample.map((word, n) => <span key={word} style={preset === 'active-word' && n === 1 ? activeSubtitleWordStyle('#FDE047') : undefined}>{word}</span>)}
        </span>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 3, padding: '8px 3px 5px', fontSize: 12, fontWeight: 600 }}>{copy.names[index]}{value === preset ? <Check size={13} aria-hidden="true" /> : null}</span>
      </button>)}
    </div>
    <p aria-live="polite" style={{ fontSize: 12, lineHeight: 1.5, margin: '9px 0 0', opacity: .75 }}>{copy.descriptions[SUBTITLE_PRESETS.indexOf(value)]}</p>
  </fieldset>;
}
