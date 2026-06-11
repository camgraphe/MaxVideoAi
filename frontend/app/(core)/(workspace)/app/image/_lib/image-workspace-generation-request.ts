import type { EngineCaps, Mode } from '@/types/engines';

function fieldAppliesToMode(field: { modes?: Mode[]; requiredInModes?: Mode[] }, mode: Mode): boolean {
  if (field.modes?.includes(mode)) return true;
  if (field.requiredInModes?.includes(mode)) return true;
  return !field.modes && !field.requiredInModes;
}

export function shouldSendImageReferenceUrlsForMode(engine: EngineCaps, mode: Mode): boolean {
  const fields = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])];
  return fields.some((field) => field.id === 'image_urls' && field.type === 'image' && fieldAppliesToMode(field, mode));
}
