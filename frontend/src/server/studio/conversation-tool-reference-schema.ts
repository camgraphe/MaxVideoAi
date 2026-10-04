import type {ResolvedReference} from '@/server/agent-api/reference-types';

type ReferenceSchema = {
  properties?: {type?: {enum?: readonly string[]}; assetId?: Record<string, unknown>};
  anyOf?: ReferenceSchema[];
};
type ReferenceToolProperties = {
  source?: ReferenceSchema;
  references: {items: {properties: {ref: ReferenceSchema}}};
};

function scopeAssetIds(schema: ReferenceSchema, assetIds: readonly string[]): void {
  if (schema.properties?.type?.enum?.includes('asset') && schema.properties.assetId)
    schema.properties.assetId.enum = assetIds;
  for (const branch of schema.anyOf ?? []) scopeAssetIds(branch, assetIds);
}

function freezeProperties<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeProperties(child);
    Object.freeze(value);
  }
  return value;
}

/** Limit saved-image selection to this context; executable authority remains server-owned. */
export function studioToolReferenceProperties<T extends Record<string, unknown>>(
  name: string,
  properties: T,
  references: readonly ResolvedReference[],
): Readonly<T> {
  if (name !== 'image_prepare' && name !== 'pricing_read' && name !== 'video_prepare') return properties;
  const assetIds = [...new Set(references.filter(ref => ref.mediaKind === 'image').map(ref => ref.assetId))];
  if (!assetIds.length) return properties;

  // Clone before freezing: shared tool definitions must remain context-independent.
  const scoped = structuredClone(properties) as T & ReferenceToolProperties;
  scopeAssetIds(scoped.references.items.properties.ref, assetIds);
  // Ready project outputs keep their independent jobId/outputId contract.
  if (name === 'video_prepare' && scoped.source) scopeAssetIds(scoped.source, assetIds);
  return freezeProperties(scoped);
}
