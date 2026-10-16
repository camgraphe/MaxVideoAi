import { resolveSeedanceEditSourceFacts } from '@/lib/seedance-edit-source';
import { resolveBytePlusTransport } from '@/server/video-providers/byteplus-modelark-transport';

export function resolveSeedance25ModelArkEditSource(engineId: string, mode: string, references: readonly {
  kind: string; fieldId?: string; durationSec?: number | null; width?: number | null; height?: number | null;
}[], transport?: 'modelark' | 'las') {
  if (engineId !== 'seedance-2-5' || mode !== 'v2v' || (transport ?? resolveBytePlusTransport(engineId, mode)) !== 'modelark') return undefined;
  const sources = references.filter(reference => reference.kind === 'video'
    && (reference.fieldId === 'video_url' || (!reference.fieldId && references.filter(item => item.kind === 'video').length === 1)));
  if (sources.length !== 1) throw new Error('Exactly one verified owned source video is required for ModelArk Edit.');
  return resolveSeedanceEditSourceFacts(sources[0]!);
}
