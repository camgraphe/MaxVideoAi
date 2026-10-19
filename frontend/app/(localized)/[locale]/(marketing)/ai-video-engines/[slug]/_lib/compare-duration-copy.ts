import type { AppLocale } from '@/i18n/locales';
import type { CompareSpecValues } from './compare-page-types';

export function compareDurationLabels(locale: AppLocale) {
  return {
    en: { newClip: 'New clip · maximum', extension: 'Extension · added duration', conditions: 'Duration choices depend on mode and resolution; check the creation settings.', modes: { t2v: 'Text to video', i2v: 'Image to video', fl2v: 'First / last frame', ref2v: 'Image references', r2v: 'References', a2v: 'Audio to video' } },
    fr: { newClip: 'Nouveau clip · maximum', extension: 'Extension · durée ajoutée', conditions: 'Les durées dépendent du mode et de la résolution ; vérifiez les réglages de création.', modes: { t2v: 'Texte vers vidéo', i2v: 'Image vers vidéo', fl2v: 'Images de début / fin', ref2v: 'Images de référence', r2v: 'Références', a2v: 'Audio vers vidéo' } },
    es: { newClip: 'Clip nuevo · máximo', extension: 'Extensión · duración añadida', conditions: 'Las duraciones dependen del modo y la resolución; comprueba los ajustes de creación.', modes: { t2v: 'Texto a video', i2v: 'Imagen a video', fl2v: 'Imagen inicial / final', ref2v: 'Imágenes de referencia', r2v: 'Referencias', a2v: 'Audio a video' } },
  }[locale];
}

export function compareDurationDetails(specs: CompareSpecValues, locale: AppLocale): string[] {
  const copy = compareDurationLabels(locale);
  // Group equal duration choices without merging their distinct modes.
  const groups = new Map<string, string[]>();
  for (const { mode, seconds } of specs.generationDurations ?? []) {
    const consecutive = seconds.length > 3 && seconds.every((n, i) => i === 0 || n === seconds[i - 1] + 1);
    const value = consecutive ? `${seconds[0]}–${seconds.at(-1)} s` : `${seconds.join(' / ')} s`;
    const names = groups.get(value) ?? [];
    names.push(copy.modes[mode as keyof typeof copy.modes] ?? mode);
    groups.set(value, names);
  }
  return [...groups].map(([value, names]) => `${names.join(', ')}: ${value}`);
}
