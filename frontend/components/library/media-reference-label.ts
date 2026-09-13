import type { AssetFieldConfig } from '@/components/Composer';
import type { EngineCaps } from '@/types/engines';
import { getWorkspaceFrameCommand } from '@/components/composer/workspace-reference-commands';
import { resolveWorkspaceReferenceFieldTitle, workspaceReferenceCopy } from '@/components/composer/workspace-reference-copy';

/** Display projection only; schema identity and compatibility remain unchanged. */
export function mediaReferenceLabel(entry: AssetFieldConfig, locale: string, engine?: EngineCaps) {
  const copy = workspaceReferenceCopy(locale);
  const frame = engine ? getWorkspaceFrameCommand(entry, engine) : null;
  if (frame) return copy[frame];
  if (entry.field.id === 'image_urls' || entry.field.id === 'reference_images') return copy.title;
  return resolveWorkspaceReferenceFieldTitle(entry.field, entry.role ?? 'generic', locale);
}
