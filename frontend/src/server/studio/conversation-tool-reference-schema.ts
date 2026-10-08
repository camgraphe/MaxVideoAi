import type {ResolvedReference} from '@/server/agent-api/reference-types';

type ReferenceSchema={properties?:Record<string,ReferenceSchema>;enum?:readonly unknown[];anyOf?:ReferenceSchema[];[key:string]:unknown};
function assetKind(schema:ReferenceSchema):string|undefined {
  return schema.properties?.type?.enum?.includes('asset')?schema.properties.kind?.enum?.[0] as string|undefined:undefined;
}
function scopeReferences(schema:ReferenceSchema,references:readonly ResolvedReference[]):void {
  const kind=assetKind(schema);
  if(kind&&schema.properties?.assetId){
    const ids=[...new Set(references.filter(reference=>reference.mediaKind===kind).map(reference=>reference.assetId))];
    if(ids.length)schema.properties.assetId.enum=ids;
  }
  if(schema.anyOf){
    // Missing media kinds lose only their asset branch. Ready job outputs keep
    // their independent identities and project ownership validation.
    schema.anyOf=schema.anyOf.filter(branch=>!assetKind(branch)||references.some(reference=>reference.mediaKind===assetKind(branch)));
  }
  for(const child of Object.values(schema)){
    if(Array.isArray(child)){for(const item of child)if(item&&typeof item==='object')scopeReferences(item as ReferenceSchema,references);}
    else if(child&&typeof child==='object')scopeReferences(child as ReferenceSchema,references);
  }
}

function freezeProperties<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeProperties(child);
    Object.freeze(value);
  }
  return value;
}

/** Current reviewed media only; server ownership and executable authority remain independent. */
export function studioToolReferenceProperties<T extends Record<string, unknown>>(
  name: string,
  properties: T,
  references: readonly ResolvedReference[],
): Readonly<T> {
  if (!['image_prepare','pricing_read','pricing_compare','video_prepare','voice_prepare','music_prepare','audio_prepare','analysis_prepare'].includes(name)) return properties;
  const eligible=name==='image_prepare'?references.filter(ref=>ref.mediaKind==='image'):references;
  if (!eligible.length) return properties;

  // Clone before freezing: shared tool definitions must remain context-independent.
  const scoped = structuredClone(properties);
  scopeReferences(scoped as ReferenceSchema,eligible);
  return freezeProperties(scoped);
}
