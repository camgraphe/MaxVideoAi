export const presentationFields = [
  'role',
  'presentation',
  'age',
  'surface',
  'face',
  'eyes',
  'hair',
  'build',
  'outfit',
  'details',
  'scene',
] as const;
export type PresentationField = (typeof presentationFields)[number];
export type StudioPresentation = Partial<Record<PresentationField, string>>;
export const PRESENTATION_FIELD_LIMIT = 600;
export function parseStudioPresentation(value: unknown): StudioPresentation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: StudioPresentation = {};
  for (const [key, text] of Object.entries(value)) {
    if (
      !presentationFields.includes(key as PresentationField) ||
      typeof text !== 'string' ||
      text.length > PRESENTATION_FIELD_LIMIT
    )
      return null;
    if (text.trim()) result[key as PresentationField] = text.trim();
  }
  return result;
}
