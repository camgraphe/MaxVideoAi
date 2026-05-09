export function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

export function replaceCriteriaCount(template: string, count: number) {
  return template
    .replace(/\b11 criteria\b/g, `${count} criteria`)
    .replace(/\b11 critères\b/g, `${count} critères`)
    .replace(/\b11 criterios\b/g, `${count} criterios`);
}

export function stripAudioReferencesForSilentPair(template: string, pairHasNativeAudio: boolean) {
  if (pairHasNativeAudio) return template;
  return template
    .replace(/\(duration,\s*resolution,\s*audio\)/g, '(duration and resolution)')
    .replace(/\(durée,\s*résolution,\s*audio\)/g, '(durée et résolution)')
    .replace(/\(duración,\s*resolución,\s*audio\)/g, '(duración y resolución)')
    .replace(
      /\(pricing,\s*inputs,\s*resolution,\s*duration,\s*aspect ratios,\s*audio,\s*and core controls\)/g,
      '(pricing, inputs, resolution, duration, aspect ratios, and core controls)'
    )
    .replace(
      /\(prix,\s*entrées,\s*résolution,\s*durée,\s*formats,\s*audio et contrôles\)/g,
      '(prix, entrées, résolution, durée, formats et contrôles)'
    )
    .replace(
      /\(precios,\s*entradas,\s*resolución,\s*duración,\s*formatos,\s*audio y controles\)/g,
      '(precios, entradas, resolución, duración, formatos y controles)'
    );
}
