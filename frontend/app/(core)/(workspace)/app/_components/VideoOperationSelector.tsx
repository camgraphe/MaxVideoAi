'use client';
import type { Dispatch, SetStateAction } from 'react';
import type { EngineCaps, Mode } from '@/types/engines';
import type { FormState } from '../_lib/workspace-form-state';

export function VideoOperationSelector({ engine, mode, form, setForm, locale = 'en' }: {
  locale?: string; engine: EngineCaps; mode: Mode; form: FormState; setForm: Dispatch<SetStateAction<FormState | null>>;
}) {
  const operations = Object.values(engine.operationCaps ?? {}).filter(operation => operation.mode === mode);
  if (!operations.length) return null;
  const language = locale.toLowerCase().split('-')[0];
  const label = language === 'fr' ? 'Traitement vidéo' : language === 'es' ? 'Operación de vídeo' : 'Video workflow';
  const optionLabel = (label: string) => language === 'fr'
    ? (({ Reference: 'Référence', Edit: 'Modifier', Recast: 'Changer les personnages', Relight: 'Modifier l’éclairage', 'FAST Edit': 'Modifier en FAST', 'Enhance Draft': 'Améliorer le Draft', 'Reframe (LTX 2.3)': 'Recadrer (LTX 2.3)', Keyframes: 'Images clés' } as Record<string, string>)[label] ?? label)
    : language === 'es' ? (({ Reference: 'Referencia', Edit: 'Editar', Recast: 'Cambiar personajes', Relight: 'Cambiar iluminación', 'FAST Edit': 'Editar en FAST', 'Enhance Draft': 'Mejorar el Draft', 'Reframe (LTX 2.3)': 'Reencuadrar (LTX 2.3)', Keyframes: 'Fotogramas clave' } as Record<string, string>)[label] ?? label) : label;
  const defaultOperation = operations.find(operation => operation.defaultForMode) ?? operations[0];
  return <label className="flex items-center gap-2 text-xs text-text-secondary">
    <span>{label}</span>
    <select data-testid="video-operation-selector" aria-label={label} value={form.operation ?? defaultOperation.operation}
      className="rounded border border-border bg-surface px-2 py-1"
      onChange={event => {
        const operation = operations.find(candidate => candidate.operation === event.target.value)?.operation;
        if (operation) setForm(current => current ? { ...current, operation } : current);
      }}>
      {operations.map(operation => <option key={operation.operation} value={operation.operation}>{optionLabel(operation.label)}</option>)}
    </select>
  </label>;
}
