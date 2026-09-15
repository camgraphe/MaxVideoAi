import type { FalEngineEntry } from '@/config/falEngines';
import { getSuggestedOpponentSlugs } from '@/lib/compare-hub/data';
import { normalizeMaxResolution } from './model-page-hero-specs';
import {
  isPending,
  isUnsupported,
} from './model-page-spec-status';
import type { KeySpecValues } from './model-page-specs-types';

export function pickCompareEngines(allEngines: FalEngineEntry[], currentSlug: string, limit = 3): FalEngineEntry[] {
  const filtered = allEngines.filter((entry) => {
    if (entry.modelSlug === currentSlug) return false;
    const modes = entry.engine?.modes ?? [];
    const hasVideoMode = modes.some((mode) => mode.endsWith('v'));
    return hasVideoMode;
  });
  const filteredBySlug = new Map(filtered.map((entry) => [entry.modelSlug, entry]));

  const selected: FalEngineEntry[] = [];
  const usedFamilies = new Set<string>();
  const usedSlugs = new Set<string>();
  const registerEngine = (entry: FalEngineEntry) => {
    if (usedSlugs.has(entry.modelSlug)) return;
    selected.push(entry);
    usedSlugs.add(entry.modelSlug);
    const familyKey = entry.family ?? entry.brandId ?? entry.provider ?? entry.modelSlug;
    usedFamilies.add(familyKey);
  };

  const priorityTargets = getSuggestedOpponentSlugs(currentSlug, limit);
  for (const targetSlug of priorityTargets) {
    const target = filteredBySlug.get(targetSlug);
    if (!target) continue;
    registerEngine(target);
    if (selected.length >= limit) return selected;
  }

  for (const entry of filtered) {
    const familyKey = entry.family ?? entry.brandId ?? entry.provider ?? entry.modelSlug;
    if (usedFamilies.has(familyKey)) continue;
    registerEngine(entry);
    if (selected.length >= limit) return selected;
  }

  for (const entry of filtered) {
    if (selected.includes(entry)) continue;
    selected.push(entry);
    if (selected.length >= limit) break;
  }

  return selected;
}

export function buildVideoBoundaries(values: KeySpecValues | null, locale: 'en' | 'fr' | 'es' = 'en'): string[] {
  const copy = {
    en: { duration: (v: string) => `Clip duration: ${v}. Assemble several clips for longer edits.`, resolution: (v: string) => `Available resolutions: ${v}.`, video: 'Video input is not supported on this model.', image: 'Image-to-video is not supported on this model.', audio: 'This model does not generate native audio.', iteration: 'Refine your prompt and compare variations before choosing a result.' },
    fr: { duration: (v: string) => `Durée des clips : ${v}. Assemblez plusieurs clips pour un montage plus long.`, resolution: (v: string) => `Résolutions disponibles : ${v}.`, video: 'Ce modèle n’accepte pas de vidéo en entrée.', image: 'Ce modèle ne permet pas de générer une vidéo à partir d’une image.', audio: 'Ce modèle ne génère pas d’audio natif.', iteration: 'Affinez votre prompt et comparez les variantes avant de retenir un résultat.' },
    es: { duration: (v: string) => `Duración de los clips: ${v}. Combina varios clips para crear un video más largo.`, resolution: (v: string) => `Resoluciones disponibles: ${v}.`, video: 'Este modelo no acepta videos como entrada.', image: 'Este modelo no permite generar videos a partir de una imagen.', audio: 'Este modelo no genera audio nativo.', iteration: 'Ajusta tu prompt y compara las variantes antes de elegir un resultado.' },
  }[locale];
  if (!values) return [copy.iteration];
  const items: string[] = [];
  if (values.maxDuration && !isPending(values.maxDuration)) items.push(copy.duration(values.maxDuration));
  if (values.maxResolution && !isPending(values.maxResolution)) items.push(copy.resolution(normalizeMaxResolution(values.maxResolution)));
  if (isUnsupported(values.videoToVideo)) items.push(copy.video);
  if (isUnsupported(values.imageToVideo)) items.push(copy.image);
  if (isUnsupported(values.audioOutput)) items.push(copy.audio);
  items.push(copy.iteration);
  return items;
}
