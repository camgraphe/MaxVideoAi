import { toolAssetRefSchema } from '@/lib/toolbox/contract';
import { readMediaFacts } from '@/lib/media-identity';

/** Structural transport validation only. Connected writers must re-resolve under the authenticated account. */
export function workspaceMediaContractFields(value: { ref?: unknown; mediaFacts?: unknown }, kind: unknown) {
  const parsed = toolAssetRefSchema.safeParse(value.ref);
  return { ref: parsed.success && parsed.data.kind === kind ? parsed.data : undefined, mediaFacts: readMediaFacts(value.mediaFacts) };
}
