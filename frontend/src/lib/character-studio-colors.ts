/** Custom colors share the existing trait value/snapshot contract. */
export type StudioColorTrait = 'hairColor' | 'eyeColor' | 'skinTone';

export function isStudioColorTrait(key: string): key is StudioColorTrait {
  return key === 'hairColor' || key === 'eyeColor' || key === 'skinTone';
}

export function normalizeStudioColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const color = value.trim();
  if (/^#[\da-f]{6}$/i.test(color)) return color.toUpperCase();
  if (/^#[\da-f]{3}$/i.test(color)) {
    return `#${color
      .slice(1)
      .split('')
      .map((digit) => digit.repeat(2))
      .join('')
      .toUpperCase()}`;
  }
  return null;
}

export function getStudioColorPrompt(key: string, value: unknown): string | null {
  if (!isStudioColorTrait(key)) return null;
  const color = normalizeStudioColor(value);
  if (!color) return null;
  const target = {
    hairColor: 'hair color',
    eyeColor: 'iris color',
    skinTone: 'skin or character surface color',
  }[key];
  return `${target} ${color} (sRGB color reference, adapted to the scene lighting)`;
}
