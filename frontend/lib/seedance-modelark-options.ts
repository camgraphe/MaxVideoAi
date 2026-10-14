import type { EngineCaps, EngineInputField } from '@/types/engines';
import { isUnifiedSeedanceEngineId } from './seedance-workflow';

export const SEEDANCE_MODELARK_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff', 'gif', 'heic', 'heif'];

/** Authored creative fields shared by the current ModelArk Seedance models. */
export function withSeedanceModelArkOptions(engine: EngineCaps): EngineCaps {
  if (!isUnifiedSeedanceEngineId(engine.id) || !engine.inputSchema) return engine;
  const flagship = engine.id === 'seedance-2-5';
  const images = flagship ? 30 : 9;
  const videos = flagship ? 10 : 3;
  const audios = flagship ? 10 : 3;
  const adaptField = (field: EngineInputField): EngineInputField => {
    if (field.type === 'image') field = { ...field, acceptedFileExtensions: [...SEEDANCE_MODELARK_IMAGE_FORMATS],
      acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff', 'image/gif', 'image/heic', 'image/heif'] };
    if (field.id === 'image_urls' || field.id === 'audio_urls') return { ...field, modes: ['ref2v', 'v2v', 'extend'] };
    if (field.id === 'video_urls') return { ...field, modes: ['ref2v', 'v2v'] };
    if (field.id === 'extension_source_videos') return { ...field, maxCount: videos,
      label: `Source clips to extend (up to ${videos})`, description: 'Extend a source clip or connect source clips within the combined video duration limit.' };
    if (field.id === 'duration') return { ...field, values: ['auto', ...Array.from({length: (flagship ? 30 : 15) - 3}, (_, index) => String(index + 4))] };
    if (field.id === 'aspect_ratio') return { ...field, values: ['auto', ...(field.values ?? []).filter(value => value !== 'auto')] };
    return field;
  };
  const outputs: EngineInputField[] = [
    ...(flagship ? [{ id: 'output_format', type: 'enum' as const, label: 'Output format', values: ['mp4', 'mov'], default: 'mp4',
      description: 'MP4 for sharing; MOV preserves professional colour and audio fidelity. The original remains available to download.' }] : []),
    { id: 'return_last_frame', type: 'boolean', label: 'Return last frame', default: false,
      description: 'Save the final JPEG frame as a separate image to continue the next video.' },
    { id: 'watermark', type: 'boolean', label: 'AI watermark', default: false,
      description: 'Include the provider’s AI-generated watermark in the video.' },
  ];
  const required = (engine.inputSchema.required ?? []).map(adaptField);
  const optional = [...(engine.inputSchema.optional ?? []).map(adaptField), ...outputs];
  return { ...engine, inputLimits: { ...engine.inputLimits, videoMaxMB: 200,
    videoMaxDurationSec: flagship ? 30 : 15, audioMaxDurationSec: flagship ? 30 : 15 }, inputSchema: { ...engine.inputSchema, required, optional,
    referenceBudget: { fieldIds: [...required, ...optional].filter(field => ['image','video','audio'].includes(field.type)).map(field => field.id),
      modes: ['i2v','ref2v','v2v','extend'], maxTotal: images + videos + audios, countUniqueUrls: true,
      maxByType: { image: images, video: videos, audio: audios } },
    constraints: { ...engine.inputSchema.constraints,
      maxVideoSizeMB: 200,
      maxCombinedVideoDurationSec: flagship ? 30.2 : 15,
      maxCombinedAudioDurationSec: flagship ? 30 : 15,
      supportedFormats: [...SEEDANCE_MODELARK_IMAGE_FORMATS, 'mp4', 'mov', 'mp3', 'wav'],
      atLeastOneReferenceField: flagship ? ['image_urls','video_urls','audio_urls'] : ['image_urls','video_urls'],
      referenceAudioRequiresVisual: !flagship,
    },
  } };
}

export function localizeSeedanceOutputField(field: EngineInputField, locale: string): EngineInputField {
  const copy: Record<string, Record<string, [string, string]>> = {
    fr: {
      output_format: ['Format de sortie', 'MP4 pour partager ; MOV pour conserver la fidélité des couleurs et du son. L’original reste téléchargeable.'],
      return_last_frame: ['Récupérer la dernière image', 'Enregistrer la dernière image JPEG séparément pour poursuivre la vidéo suivante.'],
      watermark: ['Filigrane IA', 'Ajouter le filigrane du fournisseur indiquant une création par IA.'],
    },
    es: {
      output_format: ['Formato de salida', 'MP4 para compartir; MOV conserva la fidelidad del color y del audio. El original se puede descargar.'],
      return_last_frame: ['Guardar el último fotograma', 'Guardar el último fotograma JPEG como imagen para continuar el siguiente vídeo.'],
      watermark: ['Marca de agua IA', 'Incluir la marca del proveedor que indica que el vídeo fue generado por IA.'],
    },
  };
  const entry = copy[locale.split('-')[0]]?.[field.id];
  return entry ? { ...field, label: entry[0], description: entry[1] } : field;
}

export function getSeedanceAutomaticPricingNote(input: {
  engineId: string; mode: string; durationOption?: number | string | null; aspectRatio?: string | null;
  locale: string; inheritsSourceVideo?: boolean;
}): string | null {
  if (!isUnifiedSeedanceEngineId(input.engineId) || input.inheritsSourceVideo) return null;
  const max = input.engineId === 'seedance-2-5' ? 30 : 15;
  const automaticDuration = input.durationOption === 'auto';
  const automaticFormat = input.aspectRatio === 'auto' && ['t2v','ref2v'].includes(input.mode);
  const language = input.locale.split('-')[0];
  const durationNote = automaticDuration ? language === 'fr'
    ? `Durée Auto : tarif fixe calculé sur ${max} s, même si la vidéo est plus courte.`
    : language === 'es' ? `Duración Auto: precio fijo calculado para ${max} s, aunque el vídeo sea más corto.`
      : `Auto duration: fixed price calculated for ${max}s, even if the video is shorter.` : null;
  const formatNote = automaticFormat ? language === 'fr'
    ? 'Format Auto : tarif fixe du plus cher des six formats possibles.'
    : language === 'es' ? 'Formato Auto: precio fijo del más caro de los seis formatos posibles.'
      : 'Auto format: fixed price of the most expensive of the six possible formats.' : null;
  return [durationNote, formatNote].filter(Boolean).join(' ') || null;
}
