import type { EngineCaps } from '@/types/engines';
import { resolveRuntimeEngineInput } from '@/config/model-runtime';

// Shortened from content/models/en/{model-id}.json; keep editorial copy local
// rather than shipping the full marketing documents in the workspace bundle.
const summaries: Record<string, [string, string, string]> = {
  'kling-o3-pro': ['References · shot control', 'Références · contrôle des plans', 'Referencias · control de planos'],
  'kling-o3-standard': ['References · lower-cost drafts', 'Références · brouillons à coût réduit', 'Referencias · borradores a menor coste'],
  'seedance-2-0': ['Multi-shot sequences · native audio', 'Séquences multi-plans · audio natif', 'Secuencias multiplano · audio nativo'],
};

// Presentation only: describe supported workflows from the existing catalogue.
// Model identity, availability and prices remain with their current owners.
export function workspaceModelSummary(engine: EngineCaps, locale: string): string {
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const editorial = summaries[resolveRuntimeEngineInput(engine.id)?.id ?? engine.id];
  if (editorial) return editorial[fr ? 1 : es ? 2 : 0];
  const fields = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])];
  const multiShot = fields.some(field => ['multi_prompt', 'multi_shots'].includes(field.id));
  const references = engine.modes.includes('ref2v');
  const edit = engine.modes.includes('v2v');
  const firstLast = engine.keyframes || fields.some(field => field.id === 'end_image_url');
  const features = [
    multiShot ? (fr ? 'Séquences multi-plans' : es ? 'Secuencias multiplano' : 'Multi-shot sequences') :
      references ? (fr ? 'Références multiples' : es ? 'Referencias múltiples' : 'Multiple references') :
      edit ? (fr ? 'Transformation vidéo' : es ? 'Transformación de vídeo' : 'Video transformation') :
      firstLast ? (fr ? 'Images de début et fin' : es ? 'Fotogramas inicial y final' : 'First and last frames') :
      engine.modes.includes('i2v') ? (fr ? 'Animation d’images' : es ? 'Animación de imágenes' : 'Image animation') :
        (fr ? 'Création par texte' : es ? 'Creación desde texto' : 'Text to video'),
    engine.audio ? (fr ? 'audio natif' : es ? 'audio nativo' : 'native audio') :
      (fr ? 'sans audio' : es ? 'sin audio' : 'silent video'),
  ];
  return features.join(' · ');
}
