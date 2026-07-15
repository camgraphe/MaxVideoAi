import type { AppLocale } from '@/i18n/locales';

export type ModelPromptingUiCopy = {
  tipPrefix: string;
  source: string;
  global: string;
  quirks: string;
  subject: string;
  action: string;
  camera: string;
  style: string;
  audio: string;
  output: string;
  viewFull: string;
  showPrompt: string;
  copyPrompt: string;
  copyTemplate: string;
  copied: string;
  example: string;
  viewRender: string;
  usePrompt: string;
  textToVideo: string;
  audioOn: string;
  audioOff: string;
  silent: string;
  demoPreview: string;
};

const COPY: Record<AppLocale, ModelPromptingUiCopy> = {
  en: { tipPrefix: 'Tip', source: 'Source: ', global: 'Global principles', quirks: 'Engine quirks / what to watch for', subject: 'Subject', action: 'Action', camera: 'Camera', style: 'Style', audio: 'Audio', output: 'Output', viewFull: 'View full render', showPrompt: 'View full prompt', copyPrompt: 'Copy prompt', copyTemplate: 'Copy template', copied: 'Copied', example: 'EXAMPLE', viewRender: 'View example render', usePrompt: 'Use this prompt', textToVideo: 'Text-to-video', audioOn: 'Audio on', audioOff: 'Audio off', silent: 'Silent', demoPreview: 'Demo preview.' },
  fr: { tipPrefix: 'Astuce', source: 'Source : ', global: 'Principes globaux', quirks: 'Points moteur à surveiller', subject: 'Sujet', action: 'Action', camera: 'Caméra', style: 'Style', audio: 'Audio', output: 'Sortie', viewFull: 'Voir le rendu complet', showPrompt: 'Voir le prompt complet', copyPrompt: 'Copier le prompt', copyTemplate: 'Copier le template', copied: 'Copié', example: 'EXEMPLE', viewRender: 'Voir le rendu exemple', usePrompt: 'Utiliser ce prompt', textToVideo: 'Texte-vers-vidéo', audioOn: 'Audio activé', audioOff: 'Audio désactivé', silent: 'Silencieux', demoPreview: 'Aperçu de démonstration.' },
  es: { tipPrefix: 'Consejo', source: 'Fuente: ', global: 'Principios globales', quirks: 'Puntos del motor a vigilar', subject: 'Sujeto', action: 'Acción', camera: 'Cámara', style: 'Estilo', audio: 'Audio', output: 'Salida', viewFull: 'Ver resultado completo', showPrompt: 'Ver prompt completo', copyPrompt: 'Copiar prompt', copyTemplate: 'Copiar plantilla', copied: 'Copiado', example: 'EJEMPLO', viewRender: 'Ver ejemplo', usePrompt: 'Usar este prompt', textToVideo: 'Texto a video', audioOn: 'Audio activado', audioOff: 'Audio desactivado', silent: 'Sin audio', demoPreview: 'Vista previa de demostración.' },
};

export function getModelPromptingUiCopy(locale: AppLocale): ModelPromptingUiCopy {
  return COPY[locale];
}
