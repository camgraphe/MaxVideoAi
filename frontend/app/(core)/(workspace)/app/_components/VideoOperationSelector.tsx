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
  const isCharacterOrLightingEdit = operations.some(operation => operation.operation === 'h3-recast' || operation.operation === 'h3-relight');
  const label = isCharacterOrLightingEdit
    ? language === 'fr' ? 'Que souhaitez-vous changer ?' : language === 'es' ? '¿Qué quieres cambiar?' : 'What would you like to change?'
    : language === 'fr' ? 'Traitement vidéo' : language === 'es' ? 'Operación de vídeo' : 'Video workflow';
  const optionLabel = (label: string) => language === 'fr'
    ? (({ Reference: 'Référence', Edit: 'Modifier', Recast: 'Changer les personnages', Relight: 'Modifier l’éclairage', 'FAST Edit': 'Modifier en FAST', 'Enhance Draft': 'Améliorer le Draft', 'Reframe (LTX 2.3)': 'Recadrer (LTX 2.3)', Keyframes: 'Images clés' } as Record<string, string>)[label] ?? label)
    : language === 'es' ? (({ Reference: 'Referencia', Edit: 'Editar', Recast: 'Cambiar personajes', Relight: 'Cambiar iluminación', 'FAST Edit': 'Editar en FAST', 'Enhance Draft': 'Mejorar el Draft', 'Reframe (LTX 2.3)': 'Reencuadrar (LTX 2.3)', Keyframes: 'Fotogramas clave' } as Record<string, string>)[label] ?? label)
      : (({ Recast: 'Replace characters', Relight: 'Change lighting' } as Record<string, string>)[label] ?? label);
  const defaultOperation = operations.find(operation => operation.defaultForMode) ?? operations[0];
  const selectedOperation = form.operation ?? defaultOperation.operation;
  const hint = selectedOperation === 'h3-recast'
    ? language === 'fr' ? 'Ajoutez les portraits des nouveaux personnages, dans leur ordre de gauche à droite dans la vidéo.'
      : language === 'es' ? 'Añade los retratos de los nuevos personajes en su orden de izquierda a derecha en el vídeo.'
        : 'Add portraits of the replacement characters, in their left-to-right order in the video.'
    : selectedOperation === 'h3-relight'
      ? language === 'fr' ? 'Ajoutez une image de sphère d’éclairage pour définir la lumière de la scène.'
        : language === 'es' ? 'Añade una imagen de esfera de iluminación para definir la luz de la escena.'
          : 'Add a lighting sphere image to set the light in the scene.'
      : null;
  return <div className="space-y-1 text-xs text-text-secondary"><label className="flex flex-wrap items-center gap-2">
    <span>{label}</span>
    <select data-testid="video-operation-selector" aria-label={label} value={selectedOperation}
      className="rounded border border-border bg-surface px-2 py-1"
      onChange={event => {
        const operation = operations.find(candidate => candidate.operation === event.target.value)?.operation;
        if (operation) setForm(current => current ? { ...current, operation } : current);
      }}>
      {operations.map(operation => <option key={operation.operation} value={operation.operation}>{optionLabel(operation.label)}</option>)}
    </select>
  </label>{hint ? <p>{hint}</p> : null}</div>;
}
