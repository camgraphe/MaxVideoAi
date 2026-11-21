import type { AppLocale } from '@/i18n/locales';
import { getLocalizedModeLabel } from '@/lib/ltx-localization';
import type { SamePromptCase, SamePromptClip } from './compare-same-prompt-data';

const exampleNotes = [
  {
    videoIds: [
      'job_d12164ca-1c6f-46da-9136-2255a136f124',
      'job_528fe01f-e2ea-4cc0-850c-e98190a17473',
    ],
    copy: {
      en: {
        title: 'Weather comedy in 15 seconds',
        observation: 'At 4.2 s, it is raining in both clips. Seedance 2.0 frames the reaction in a medium close-up. Fast holds a wide shot with the porch in view.',
      },
      fr: {
        title: 'Une comédie météo en 15 secondes',
        observation: 'À 4,2 s, il pleut dans les deux vidéos. Seedance 2.0 cadre la réaction en plan rapproché. Fast garde un plan large avec le porche dans le champ.',
      },
      es: {
        title: 'Una comedia sobre el tiempo en 15 segundos',
        observation: 'A los 4,2 s, llueve en ambos vídeos. Seedance 2.0 muestra la reacción en un encuadre cercano. Fast mantiene un plano general en el que se ve el porche.',
      },
    },
  },
  {
    videoIds: [
      'job_fa9f3068-9796-4f75-af35-e9fcdecf68a9',
      'job_465613de-519e-452e-b009-3a78552f0884',
    ],
    copy: {
      en: {
        title: 'Talking to the camera in 9:16',
        observation: 'Both clips open on a selfie shot. Veo Fast places its presenter beside a window. Veo Lite shows a bookshelf behind its presenter.',
      },
      fr: {
        title: 'Un selfie face caméra en 9:16',
        observation: 'Les deux vidéos s’ouvrent sur un cadrage selfie. Veo Fast place sa créatrice près d’une fenêtre. Veo Lite montre une bibliothèque derrière son créateur.',
      },
      es: {
        title: 'Un selfie hablando a cámara en 9:16',
        observation: 'Los dos vídeos empiezan con un encuadre de selfie. Veo Fast sitúa a su presentadora junto a una ventana. Veo Lite muestra una estantería detrás de su presentador.',
      },
    },
  },
];

export function samePromptExampleNote(example: SamePromptCase, locale: AppLocale) {
  return exampleNotes.find(note => note.videoIds.every(id => example.clips.some(clip => clip.id === id)))?.copy[locale];
}

export const samePromptText = {
  en: {
    heading: 'Same prompt, two renders',
    intro: 'Both renders share the same recorded prompt. Known settings are listed under each video.',
    prompt: 'Original prompt',
    render: 'Render',
    link: 'Link to this example',
    source: 'Video and source details',
    generated: 'Generated on',
    requested: 'requested',
    audio: 'With audio',
    silent: 'Without audio',
    more: (count: number) => count === 1 ? 'See 1 more example' : `See ${count} more examples`,
  },
  fr: {
    heading: 'Même prompt, deux rendus',
    intro: 'Les deux rendus partagent le même prompt enregistré. Les réglages connus figurent sous chaque vidéo.',
    prompt: 'Prompt original',
    render: 'Rendu',
    link: 'Lien vers cet essai',
    source: 'Vidéo et détails de la source',
    generated: 'Généré le',
    requested: 'demandé',
    audio: 'Avec audio',
    silent: 'Sans audio',
    more: (count: number) => count === 1 ? 'Voir 1 autre essai' : `Voir ${count} autres essais`,
  },
  es: {
    heading: 'Mismo prompt, dos resultados',
    intro: 'Los dos resultados comparten el mismo prompt registrado. Los ajustes conocidos se indican debajo de cada vídeo.',
    prompt: 'Prompt original',
    render: 'Resultado',
    link: 'Enlace a este ejemplo',
    source: 'Vídeo y detalles de la fuente',
    generated: 'Generado el',
    requested: 'solicitado',
    audio: 'Con audio',
    silent: 'Sin audio',
    more: (count: number) => count === 1 ? 'Ver 1 ejemplo más' : `Ver ${count} ejemplos más`,
  },
};

export function samePromptAnchor(promptHash: string) {
  return `same-prompt-${promptHash.slice(0, 12)}`;
}

export function samePromptClipFacts(clip: SamePromptClip, locale: AppLocale) {
  const copy = samePromptText[locale];
  return [
    clip.generationMode ? getLocalizedModeLabel(clip.generationMode, locale) : null,
    clip.durationSec > 0 ? `${new Intl.NumberFormat(locale).format(clip.durationSec)} s` : null,
    clip.aspectRatio,
    clip.width && clip.height ? `${clip.width} × ${clip.height} px` : null,
    clip.requestedResolution ? `${clip.requestedResolution} ${copy.requested}` : null,
    clip.hasAudio === null ? null : clip.hasAudio ? copy.audio : copy.silent,
  ].filter(Boolean);
}
