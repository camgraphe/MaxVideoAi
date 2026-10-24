import type { EngineCaps, EngineModeUiCaps, Mode } from '@/types/engines';

/** Shared capability policy; verified media supplies inherited timing and canonical pricing. */
export function videoDurationPolicy(
  engine: EngineCaps,
  mode: Mode | 'i2v_standard',
  caps: EngineModeUiCaps | undefined = engine.modeCaps?.[mode as Mode],
): 'requested' | 'source_video' | 'source_audio' {
  if (mode === 'a2v') return 'source_audio';
  const inheritsSource = engine.modeAvailability?.[mode as Mode]?.inheritsSourceVideo;
  if (mode === 'v2v' && inheritsSource !== undefined) {
    return inheritsSource ? 'source_video' : 'requested';
  }
  if (caps?.durationPolicy) return caps.durationPolicy;
  if (mode === 'reframe' && engine.id !== 'luma-ray-3-2') return 'source_video';
  // getModeCaps can supply global duration defaults absent from the authored Modify mode.
  if (mode === 'v2v' && (!caps?.duration || [
    'gemini-omni-flash', 'luma-ray-3-2', 'lumaRay2', 'lumaRay2_flash', 'happy-horse-1-0',
  ].includes(engine.id))) return 'source_video';
  return 'requested';
}

export function videoSourceDurationLabel(locale:string):string {
  return locale==='fr'?'Durée de la vidéo source':locale==='es'?'Duración del vídeo original':'Source video duration';
}

export function videoModifySettingsCopy(locale: string) {
  return locale === 'fr'
    ? { duration: 'Durée du résultat', format: 'Format du résultat', audio: 'Audio généré' }
    : locale === 'es'
      ? { duration: 'Duración del resultado', format: 'Formato del resultado', audio: 'Audio generado' }
      : { duration: 'Output duration', format: 'Output format', audio: 'Generated audio' };
}

export type VideoWorkflowNotice=Readonly<{code:'seedance_recognizable_people';message:string}>;
export function videoWorkflowNotices(engineId:string,mode:string,locale='en'):readonly VideoWorkflowNotice[] {
  if(!['seedance-2-0','seedance-2-0-fast','seedance-2-0-mini','seedance-2-5'].includes(engineId)
    ||!['v2v','extend','ref2v'].includes(mode))return [];
  const message=locale==='fr'
    ? 'Seedance peut refuser les vidéos de référence montrant une personne reconnaissable. Pour modifier ou prolonger une vidéo avec une personne réelle, envisagez un autre modèle compatible.'
    : locale==='es'
      ? 'Seedance puede rechazar vídeos de referencia con una persona reconocible. Para modificar o ampliar un vídeo con una persona real, considera otro modelo compatible.'
      : 'Seedance may reject reference videos showing a recognizable person. To edit or extend a video featuring a real person, consider another compatible model.';
  return [{code:'seedance_recognizable_people',message}];
}

export function videoInheritsSourceFraming(engine: EngineCaps, mode: Mode): boolean {
  return mode === 'v2v' && (
    (engine.modeCaps?.[mode]?.durationPolicy === 'source_video' && !engine.modeCaps[mode]?.aspectRatio?.length) ||
    engine.id === 'gemini-omni-flash' || engine.modeAvailability?.[mode]?.inheritsSourceVideo === true
  );
}
