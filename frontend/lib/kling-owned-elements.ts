import { z } from 'zod';
import type { CanonicalGenerationRequest } from '@/server/agent-api/generation-types';
import type { ResolvedReference } from '@/server/agent-api/reference-types';

const slot = z.number().int().min(0).max(65);
/** Slots select existing owned reference assets (or Studio's resolved job outputs), never URLs. */
export const klingOwnedElementsSchema = z.array(z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('images'), frontalSlot: slot, referenceSlots: z.array(slot).min(1).max(3) }).strict(),
  z.object({ kind: z.literal('video'), videoSlot: slot }).strict(),
])).min(1).max(3);
export type KlingOwnedElements = z.infer<typeof klingOwnedElementsSchema>;
const slotProperty = { type: 'integer', minimum: 0, maximum: 65 };
export const klingOwnedElementsProperty = { anyOf: [{ type: 'array', minItems: 1, maxItems: 3, items: { anyOf: [
  { type: 'object', additionalProperties: false, required: ['kind','frontalSlot','referenceSlots'], properties: { kind: {type:'string',enum:['images']}, frontalSlot: slotProperty, referenceSlots: {type:'array',minItems:1,maxItems:3,items:slotProperty} } },
  { type: 'object', additionalProperties: false, required: ['kind','videoSlot'], properties: {kind:{type:'string',enum:['video']},videoSlot:slotProperty} },
] } }, { type: 'null' }],
  description: 'Kling Modify subjects: compose owned role=reference slots into image sets or video subjects. Slots are zero-based reference order. Used slots are element media, not separate guidance images; elements plus remaining guidance images must total at most four.' };
export function elementSlots(elements: KlingOwnedElements | undefined): number[] {
  return (elements ?? []).flatMap(element => element.kind === 'video' ? [element.videoSlot] : [element.frontalSlot, ...element.referenceSlots]);
}
export function isElementReference(reference: {role: string; slot?: number}, elements: KlingOwnedElements | undefined) {
  return reference.role === 'reference' && reference.slot !== undefined && elementSlots(elements).includes(reference.slot);
}
export function validateOwnedKlingElements(request: CanonicalGenerationRequest, resolved?: readonly ResolvedReference[]) {
  if (!request.elements) return;
  klingOwnedElementsSchema.parse(request.elements);
  if (request.surface !== 'video' || request.mode !== 'v2v' || !['kling-o3-standard','kling-o3-pro','kling-o3-4k'].includes(request.engineId)) throw new Error('Elements require Kling Modify.');
  const slots = elementSlots(request.elements);
  if (new Set(slots).size !== slots.length) throw new Error('Element slots must be distinct.');
  if (request.elements.length + request.references.filter(ref => ref.role === 'reference' && !isElementReference(ref, request.elements)).length > 4) throw new Error('At most four elements and guidance images combined.');
  for (const element of request.elements) {
    for (const index of elementSlots([element])) {
      const reference = request.references.find(ref => ref.role === 'reference' && ref.slot === index);
      if (!reference || reference.kind !== 'asset') throw new Error('Element slots require owned assets.');
      if (!resolved) continue;
      const matches = resolved.filter(ref => ref.assetId === reference.assetId && ref.role === reference.role && ref.slot === index);
      const media = matches[0];
      if (matches.length !== 1 || media.mediaKind !== (element.kind === 'video' ? 'video' : 'image')) throw new Error('Element asset media does not match.');
      if (!media.storageUrl.startsWith('https://') || !Number.isSafeInteger(media.width) || !Number.isSafeInteger(media.height) || Number(media.width) <= 0 || Number(media.height) <= 0) throw new Error('Element media requires verified dimensions.');
      if (element.kind === 'images' && (Number(media.width) < 300 || Number(media.height) < 300)) throw new Error('Element images require at least 300 pixels on each side.');
      if (!media.mimeType.startsWith(element.kind === 'images' ? 'image/' : 'video/')) throw new Error('Element media MIME does not match.');
      if (element.kind === 'video' && (!media.durationSec || media.durationSec <= 0 || !Number.isFinite(media.durationSec))) throw new Error('Element video requires verified timing.');
    }
  }
}
