import type { AppLocale } from '@/i18n/locales';

export const PREFERRED_MEDIA: Record<string, { hero: string | null; demo: string | null }> = {
  'sora-2': {
    hero: 'job_74677d4f-9f28-4e47-b230-64accef8e239',
    demo: 'job_7fbd6334-8535-438a-98a2-880205744b6b',
  },
  'sora-2-pro': {
    hero: 'job_4d97a93f-1582-4a50-bff1-72894c302164',
    demo: null,
  },
  'veo-3-1': {
    hero: 'job_a3e088db-b1e2-430f-83b3-2efce518c282',
    demo: 'job_8547a19e-ebad-4376-8889-1d88355c0f52',
  },
  'veo-3-1-fast': {
    hero: 'job_4db2339c-000a-4b81-a68c-9314dd7940b2',
    demo: 'job_e34e8979-9056-4564-bbfd-27e8d886fa26',
  },
  'veo-3-1-lite': {
    hero: 'job_a424b7be-5f70-491b-b70e-6cbbbe223d21',
    demo: 'job_43c4c8cd-246a-4c96-80a9-ab647b2eade7',
  },
  'pika-text-to-video': {
    hero: 'job_2c958e35-92e7-4c0f-8828-ec49476c8c4e',
    demo: 'job_f5992c71-a197-482f-8d0f-028f261ed27b',
  },
  'wan-2-5': {
    hero: 'job_4b882003-b595-4d4e-b62c-1ae22f002bcf',
    demo: 'job_f77a31c6-1549-471a-8fb1-1eb44c523390',
  },
  'kling-2-5-turbo': {
    hero: null,
    demo: 'job_b8db408a-7b09-4268-ad10-48e9cb8fc4a7',
  },
  'kling-3-pro': {
    hero: 'job_665a317f-f4dc-41c8-ade4-4a0a891627c8',
    demo: 'job_3092cc94-f948-42e8-abd0-744534f5b38e',
  },
  'kling-3-standard': {
    hero: 'job_99e0f0fa-6092-4b8a-8c08-e329c579d0f2',
    demo: 'job_6e7885fd-e180-46b2-9bf0-f84d3a92ca28',
  },
  'kling-3-4k': {
    hero: 'marketing-kling-3-4k-hero-6s',
    demo: 'marketing-kling-3-4k-demo-6s',
  },
  'seedance-1-5-pro': {
    hero: 'job_3f82e69d-ef44-4c46-aded-16d06dd4a1ab',
    demo: 'job_b748b50c-30bc-42ba-a83b-208abbd4fb7f',
  },
  'seedance-2-0': {
    hero: 'job_39509619-83fe-4f46-8a15-c164b17c414e',
    demo: 'job_99e1ef37-e7f6-4002-9339-021f9e20f485',
  },
  'seedance-2-0-fast': {
    hero: 'job_bdf3583a-264e-42ec-bfc2-cd866969374c',
    demo: 'job_cd3036e6-a6a3-4f4a-b139-0c7a31a918f2',
  },
  'ltx-2-3-pro': {
    hero: 'job_2a07e085-4764-4e9b-8850-c3941dbf303a',
    demo: 'job_ff7bf5c5-44f2-4d8d-92a6-851ecc5a59ab',
  },
  'ltx-2-3-fast': {
    hero: 'job_78cb3e71-cab5-48e2-9965-9f521ba51c0f',
    demo: 'job_a3197eac-62e4-4043-a0d6-7b62a8f57ff0',
  },
  'luma-ray-2': {
    hero: 'job_c4c9b10e-839f-4935-bbd9-de2d5731126a',
    demo: 'job_e17eaa6a-7bb7-47b8-8287-8aa8dc4efd8a',
  },
  'luma-ray-2-flash': {
    hero: 'job_e658a8d1-8ed8-4494-8247-19ef4e45102d',
    demo: 'job_b13fdbfe-eb04-4000-b88f-abd2dcde7e1b',
  },
  'happy-horse-1-0': {
    hero: 'job_24d59992-532b-43e3-b382-12310d973af1',
    demo: 'job_b67e3f62-b117-4e89-997d-e11eb8f48c4a',
  },
};

export const PREP_LINK_VISUALS = {
  '/app/image': {
    imageSrc:
      'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/1212fdd0-0299-4e07-8546-c8fc0925432d.webp',
    summary: {
      en: 'Build or clean the source still first.',
      fr: "Construisez ou nettoyez d'abord l'image source.",
      es: 'Construye o limpia primero la imagen base.',
    },
    alt: {
      en: 'Generate Image workspace example',
      fr: 'Exemple du studio Generate Image',
      es: 'Ejemplo del espacio Generate Image',
    },
  },
  '/tools/character-builder': {
    imageSrc:
      'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/762032e6-d6f1-41cd-a1f3-690a60188a74.webp',
    summary: {
      en: 'Lock identity, outfit, and reference quality.',
      fr: "Verrouillez l'identité, la tenue et la qualité de référence.",
      es: 'Fija la identidad, el vestuario y la calidad de referencia.',
    },
    alt: {
      en: 'Character Builder reference example',
      fr: 'Exemple de référence Character Builder',
      es: 'Ejemplo de referencia de Character Builder',
    },
  },
  '/tools/angle': {
    imageSrc:
      'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/6cff997e-f531-455d-819f-a0481b4cda5c-tool_angle_57d123d8-acdd-4667-9ad4-fdb256313b6a-1.webp',
    summary: {
      en: 'Change the viewpoint before you spend video credits.',
      fr: 'Changez le point de vue avant de dépenser des crédits vidéo.',
      es: 'Cambia el punto de vista antes de gastar créditos de video.',
    },
    alt: {
      en: 'Angle tool example',
      fr: "Exemple de l'outil Angle",
      es: 'Ejemplo de la herramienta Angle',
    },
  },
} as const;

type FocusVsCopy = { title: string; items: string[] };
type FocusVsLocalizedCopy = Record<AppLocale, FocusVsCopy>;
type FocusVsPair = {
  slugA: string;
  slugB: string;
  nameA: string;
  nameB: string;
  copyA: FocusVsLocalizedCopy;
  copyB: FocusVsLocalizedCopy;
  onlyFor?: string[];
};

export type FocusVsConfig = {
  title: string;
  ctaLabel: string;
  ctaSlug: string;
  leftTitle: string;
  leftItems: string[];
  rightTitle: string;
  rightItems: string[];
};

const FOCUS_VS_PAIRS: FocusVsPair[] = [
  {
    slugA: 'sora-2',
    slugB: 'sora-2-pro',
    nameA: 'Sora 2',
    nameB: 'Sora 2 Pro',
    copyA: {
      en: {
        title: 'Use Sora 2 when you want:',
        items: [
          'Fast idea → clip iteration',
          'Storyboards, concepts, UGC-style beats, short ads',
          'A quick first pass where 720p is enough',
        ],
      },
      fr: {
        title: 'Utilisez Sora 2 quand vous voulez :',
        items: [
          'Itération rapide d’idée → clip',
          'Storyboards, concepts, beats UGC, pubs courtes',
          'Un premier jet rapide où le 720p suffit',
        ],
      },
      es: {
        title: 'Usa Sora 2 cuando quieras:',
        items: [
          'Iteración rápida de idea → clip',
          'Storyboards, conceptos, beats estilo UGC, anuncios cortos',
          'Un primer borrador rápido cuando 720p es suficiente',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Sora 2 Pro when you need:',
        items: [
          'Higher resolution output',
          'More control for finals (including audio control in the UI)',
          'Cleaner final takes after you’ve validated the idea',
        ],
      },
      fr: {
        title: 'Utilisez Sora 2 Pro quand vous avez besoin :',
        items: [
          'Sortie en plus haute résolution',
          'Plus de contrôle pour les finals (y compris le contrôle audio dans l’UI)',
          'Plans finaux plus propres après validation de l’idée',
        ],
      },
      es: {
        title: 'Usa Sora 2 Pro cuando necesites:',
        items: [
          'Salida de mayor resolución',
          'Más control para finales (incluye control de audio en la UI)',
          'Tomas finales más limpias tras validar la idea',
        ],
      },
    },
  },
  {
    slugA: 'veo-3-1-fast',
    slugB: 'veo-3-1',
    nameA: 'Veo 3.1 Fast',
    nameB: 'Veo 3.1',
    copyA: {
      en: {
        title: 'Use Veo 3.1 Fast when you want:',
        items: [
          'Rapid concept testing and volume drafts',
          'Cheaper A/B ad variants and social loops',
          'Quick iteration before upgrading winners',
        ],
      },
      fr: {
        title: 'Utilisez Veo 3.1 Fast quand vous voulez :',
        items: [
          'Tests de concepts rapides et tests en volume',
          'Variantes A/B moins chères et boucles social',
          'Itération rapide avant de passer les meilleurs en version supérieure',
        ],
      },
      es: {
        title: 'Usa Veo 3.1 Fast cuando quieras:',
        items: [
          'Pruebas rápidas de concepto y borradores en volumen',
          'Variantes A/B más baratas y loops sociales',
          'Iteración rápida antes de pasar a los ganadores',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Veo 3.1 when you need:',
        items: [
          'Higher-fidelity frames and polish',
          'Sound in the same pass when you want it',
          'More reliable follow-through on prompts',
        ],
      },
      fr: {
        title: 'Utilisez Veo 3.1 quand vous avez besoin :',
        items: [
          'Fidélité d’image plus élevée et finition',
          'Son dans le même rendu quand vous en avez besoin',
          'Suivi des prompts plus fiable',
        ],
      },
      es: {
        title: 'Usa Veo 3.1 cuando necesites:',
        items: [
          'Mayor fidelidad y pulido',
          'Sonido en la misma pasada cuando lo necesitas',
          'Seguimiento de prompts más fiable',
        ],
      },
    },
  },
  {
    slugA: 'wan-2-5',
    slugB: 'wan-2-6',
    nameA: 'Wan 2.5',
    nameB: 'Wan 2.6',
    copyA: {
      en: {
        title: 'Use Wan 2.5 when you want:',
        items: [
          'Native audio in the same render',
          'Simple short beats at lower cost',
          'Quick ideation with sound-led timing',
        ],
      },
      fr: {
        title: 'Utilisez Wan 2.5 quand vous voulez :',
        items: [
          'Audio natif dans le même rendu',
          'Beats courts simples à moindre coût',
          'Idéation rapide avec timing guidé par le son',
        ],
      },
      es: {
        title: 'Usa Wan 2.5 cuando quieras:',
        items: [
          'Audio nativo en el mismo render',
          'Beats cortos simples a menor coste',
          'Ideación rápida con timing guiado por el audio',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Wan 2.6 when you need:',
        items: [
          'Reference-to-video consistency',
          'Timestamped multi-shot sequences',
          'More aspect-ratio control and structure',
        ],
      },
      fr: {
        title: 'Utilisez Wan 2.6 quand vous avez besoin :',
        items: [
          'Cohérence en reference-to-video',
          'Séquences multi-shots horodatées',
          'Plus de contrôle de format et de structure',
        ],
      },
      es: {
        title: 'Usa Wan 2.6 cuando necesites:',
        items: [
          'Consistencia en reference-to-video',
          'Secuencias multi-shot con timestamps',
          'Más control de formato y estructura',
        ],
      },
    },
  },
  {
    slugA: 'kling-2-5-turbo',
    slugB: 'kling-2-6-pro',
    nameA: 'Kling 2.5 Turbo',
    nameB: 'Kling 2.6 Pro',
    copyA: {
      en: {
        title: 'Use Kling 2.5 Turbo when you want:',
        items: [
          'Fast silent clips with strong motion',
          'Budget B-roll loops for edits',
          'Quick look-dev and drafts',
        ],
      },
      fr: {
        title: 'Utilisez Kling 2.5 Turbo quand vous voulez :',
        items: [
          'Clips silencieux rapides avec forte motion',
          'Boucles B-roll budget pour le montage',
          'Look-dev rapide et tests',
        ],
      },
      es: {
        title: 'Usa Kling 2.5 Turbo cuando quieras:',
        items: [
          'Clips silenciosos rápidos con motion fuerte',
          'Loops B-roll económicos para edición',
          'Look-dev rápido y borradores',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Kling 2.6 Pro when you need:',
        items: [
          'Native audio with dialogue and SFX',
          'Polished ad/story beats',
          'Stronger continuity on camera direction',
        ],
      },
      fr: {
        title: 'Utilisez Kling 2.6 Pro quand vous avez besoin :',
        items: [
          'Audio natif avec dialogue et SFX',
          'Beats pub/story plus polis',
          'Continuité plus forte sur la direction caméra',
        ],
      },
      es: {
        title: 'Usa Kling 2.6 Pro cuando necesites:',
        items: [
          'Audio nativo con diálogo y SFX',
          'Beats publicitarios/story más pulidos',
          'Continuidad más fuerte en la dirección de cámara',
        ],
      },
    },
  },
  {
    slugA: 'kling-2-6-pro',
    slugB: 'kling-3-pro',
    nameA: 'Kling 2.6 Pro',
    nameB: 'Kling 3 Pro',
    copyA: {
      en: {
        title: 'Use Kling 2.6 Pro when you want:',
        items: [
          'Native audio with dialogue and SFX',
          'Short cinematic beats without extra setup',
          'Solid results for 5–10s clips',
        ],
      },
      fr: {
        title: 'Utilisez Kling 2.6 Pro quand vous voulez :',
        items: [
          'Audio natif avec dialogue et SFX',
          'Beats ciné courts sans setup complexe',
          'Résultats solides sur 5–10s',
        ],
      },
      es: {
        title: 'Usa Kling 2.6 Pro cuando quieras:',
        items: [
          'Audio nativo con diálogo y SFX',
          'Beats cinemáticos cortos sin setup extra',
          'Resultados sólidos en clips de 5–10s',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Kling 3 Pro when you need:',
        items: [
          'Multi-prompt sequencing across scenes',
          'Element references for stronger continuity',
          'Voice IDs and shot-type control up to 15s',
        ],
      },
      fr: {
        title: 'Utilisez Kling 3 Pro quand vous avez besoin :',
        items: [
          'Séquençage multi-prompts par scène',
          'Éléments de référence pour plus de continuité',
          'Voice IDs et shot-type jusqu’à 15s',
        ],
      },
      es: {
        title: 'Usa Kling 3 Pro cuando necesites:',
        items: [
          'Secuencias multi-prompt por escena',
          'Referencias de elementos para mayor continuidad',
          'Voice IDs y control de shot type hasta 15s',
        ],
      },
    },
  },
  {
    slugA: 'kling-3-standard',
    slugB: 'kling-3-pro',
    nameA: 'Kling 3 Standard',
    nameB: 'Kling 3 Pro',
    onlyFor: ['kling-3-standard'],
    copyA: {
      en: {
        title: 'Use Kling 3 Standard when you want:',
        items: [
          'Multi-shot control at a lower cost',
          'Quick ad variants and social promos',
          'Elements + end frame for consistency',
        ],
      },
      fr: {
        title: 'Utilisez Kling 3 Standard quand vous voulez :',
        items: [
          'Contrôle multi‑shot à moindre coût',
          'Variantes rapides d’ads et promos social',
          'Elements + image de fin pour la cohérence',
        ],
      },
      es: {
        title: 'Usa Kling 3 Standard cuando quieras:',
        items: [
          'Control multi‑shot a menor costo',
          'Variantes rápidas de anuncios y promos sociales',
          'Elements + end frame para consistencia',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Kling 3 Pro when you need:',
        items: [
          'Shot type control + voice IDs',
          'More precise coverage for storyboards',
          'Premium takes and iteration depth',
        ],
      },
      fr: {
        title: 'Utilisez Kling 3 Pro quand vous avez besoin :',
        items: [
          'Shot type + voice IDs',
          'Couverture plus précise pour storyboard',
          'Takes premium et itérations plus poussées',
        ],
      },
      es: {
        title: 'Usa Kling 3 Pro cuando necesites:',
        items: [
          'Shot type + voice IDs',
          'Cobertura más precisa para storyboards',
          'Tomas premium y más iteración',
        ],
      },
    },
  },
  {
    slugA: 'seedance-1-5-pro',
    slugB: 'kling-3-standard',
    nameA: 'Seedance 1.5 Pro',
    nameB: 'Kling 3 Standard',
    onlyFor: ['seedance-1-5-pro'],
    copyA: {
      en: {
        title: 'Use Seedance 1.5 Pro when you want:',
        items: [
          'Camera-fixed stability and repeatable takes',
          'Seed control for variants',
          'Short 4–12s clips with audio on/off',
        ],
      },
      fr: {
        title: 'Utilisez Seedance 1.5 Pro quand vous voulez :',
        items: [
          'Stabilité camera_fixed et prises répétables',
          'Seed control pour variantes',
          'Clips courts 4–12 s avec audio on/off',
        ],
      },
      es: {
        title: 'Usa Seedance 1.5 Pro cuando quieras:',
        items: [
          'Estabilidad camera_fixed y tomas repetibles',
          'Seed control para variantes',
          'Clips cortos 4–12 s con audio on/off',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Kling 3 Standard when you need:',
        items: [
          'Multi-shot storyboards up to 15s',
          'Elements for consistent characters/props',
          'Voice IDs + optional end frame',
        ],
      },
      fr: {
        title: 'Utilisez Kling 3 Standard quand vous avez besoin :',
        items: [
          'Storyboards multi‑shot jusqu’à 15 s',
          'Elements pour personnages/props cohérents',
          'Voice IDs + image de fin optionnelle',
        ],
      },
      es: {
        title: 'Usa Kling 3 Standard cuando necesites:',
        items: [
          'Storyboards multi‑shot hasta 15 s',
          'Elements para personajes/props consistentes',
          'Voice IDs + end frame opcional',
        ],
      },
    },
  },
  {
    slugA: 'seedance-2-0-fast',
    slugB: 'seedance-2-0',
    nameA: 'Seedance 2.0 Fast',
    nameB: 'Seedance 2.0',
    onlyFor: ['seedance-2-0', 'seedance-2-0-fast'],
    copyA: {
      en: {
        title: 'Use Seedance 2.0 Fast when you want:',
        items: [
          'Rapid draft passes before client-facing finals',
          'Quick shot planning, pacing checks, and A/B motion tests',
          'A lighter Seedance tier for early creative exploration',
        ],
      },
      fr: {
        title: 'Utilisez Seedance 2.0 Fast quand vous voulez :',
        items: [
          'Des tests rapides avant les finals client',
          'Du shot planning, des checks de pacing et des tests A/B motion',
          'Un tier Seedance plus léger pour explorer tôt',
        ],
      },
      es: {
        title: 'Usa Seedance 2.0 Fast cuando quieras:',
        items: [
          'Borradores rápidos antes de los finales para cliente',
          'Shot planning, checks de pacing y tests A/B de motion',
          'Un tier Seedance más ligero para explorar antes',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Seedance 2.0 when you need:',
        items: [
          'More polished motion and native audio for finals',
          'Stronger multi-shot continuity for launch work',
          'The main Seedance tier for flagship ads and hero scenes',
        ],
      },
      fr: {
        title: 'Utilisez Seedance 2.0 quand vous avez besoin :',
        items: [
          'D’un motion plus premium et d’un audio natif pour les finals',
          'D’une continuité multi-plans plus sûre pour les livrables de lancement',
          'Du tier principal Seedance pour pubs flagship et hero scenes',
        ],
      },
      es: {
        title: 'Usa Seedance 2.0 cuando necesites:',
        items: [
          'Más acabado de motion y audio nativo para finales',
          'Continuidad multi-shot más fiable para entregables de lanzamiento',
          'El tier principal de Seedance para anuncios flagship y hero scenes',
        ],
      },
    },
  },
  {
    slugA: 'ltx-2-fast',
    slugB: 'ltx-2',
    nameA: 'LTX 2 Fast',
    nameB: 'LTX 2',
    copyA: {
      en: {
        title: 'Use LTX 2 Fast when you want:',
        items: [
          'High-volume drafts and iteration speed',
          'Quick concept testing and pacing checks',
          'Rough cuts before finals',
        ],
      },
      fr: {
        title: 'Utilisez LTX 2 Fast quand vous voulez :',
        items: [
          'Tests en volume et vitesse d’itération',
          'Tests de concepts rapides et vérification du pacing',
          'Rough cuts avant les finals',
        ],
      },
      es: {
        title: 'Usa LTX 2 Fast cuando quieras:',
        items: [
          'Borradores en volumen y velocidad de iteración',
          'Pruebas rápidas de concepto y pacing',
          'Rough cuts antes de finales',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use LTX 2 when you need:',
        items: [
          'Polished client-ready deliverables',
          'Higher resolution and smoother motion',
          'Audio-visual sync for finals',
        ],
      },
      fr: {
        title: 'Utilisez LTX 2 quand vous avez besoin :',
        items: [
          'Livrables clients plus soignés',
          'Résolution plus élevée et mouvement plus fluide',
          'Sync audio-visuelle pour les finals',
        ],
      },
      es: {
        title: 'Usa LTX 2 cuando necesites:',
        items: [
          'Entregables más pulidos para cliente',
          'Más resolución y motion más suave',
          'Sincronía audio-visual para finales',
        ],
      },
    },
  },
  {
    slugA: 'nano-banana',
    slugB: 'nano-banana-pro',
    nameA: 'Nano Banana',
    nameB: 'Nano Banana Pro',
    copyA: {
      en: {
        title: 'Use Nano Banana when you want:',
        items: [
          'Fast drafts and quick edits',
          'Rapid concepting and exploration',
          'Lightweight layout tests',
        ],
      },
      fr: {
        title: 'Utilisez Nano Banana quand vous voulez :',
        items: [
          'Tests rapides et edits rapides',
          'Concepting rapide et exploration',
          'Tests de mise en page légers',
        ],
      },
      es: {
        title: 'Usa Nano Banana cuando quieras:',
        items: [
          'Borradores rápidos y ediciones rápidas',
          'Concepting rápido y exploración',
          'Pruebas de layout ligeras',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Nano Banana Pro when you need:',
        items: [
          'Clean typography and layouts',
          'Consistent product families',
          'High-res finals for campaigns',
        ],
      },
      fr: {
        title: 'Utilisez Nano Banana Pro quand vous avez besoin :',
        items: [
          'Typo et layouts propres',
          'Familles produit cohérentes',
          'Finals haute résolution pour campagnes',
        ],
      },
      es: {
        title: 'Usa Nano Banana Pro cuando necesites:',
        items: [
          'Tipografía y layouts limpios',
          'Familias de producto consistentes',
          'Finales en alta resolución para campañas',
        ],
      },
    },
  },
  {
    slugA: 'pika-text-to-video',
    slugB: 'kling-2-5-turbo',
    nameA: 'Pika 2.2',
    nameB: 'Kling 2.5 Turbo',
    onlyFor: ['pika-text-to-video'],
    copyA: {
      en: {
        title: 'Use Pika 2.2 when you want:',
        items: [
          'Stylized, social-first motion',
          'Fast loops and playful variants',
          'Edit-friendly silent clips',
        ],
      },
      fr: {
        title: 'Utilisez Pika 2.2 quand vous voulez :',
        items: [
          'Motion stylisé, social-first',
          'Boucles rapides et variantes ludiques',
          'Clips silencieux faciles à monter',
        ],
      },
      es: {
        title: 'Usa Pika 2.2 cuando quieras:',
        items: [
          'Motion estilizado y social-first',
          'Loops rápidos y variantes lúdicas',
          'Clips silenciosos fáciles de editar',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use Kling 2.5 Turbo when you need:',
        items: [
          'More cinematic motion and physics',
          'Camera-forward action beats',
          'Cleaner realism for product shots',
        ],
      },
      fr: {
        title: 'Utilisez Kling 2.5 Turbo quand vous avez besoin :',
        items: [
          'Motion et physique plus cinématiques',
          'Beats d’action camera-forward',
          'Réalisme plus propre pour produits',
        ],
      },
      es: {
        title: 'Usa Kling 2.5 Turbo cuando necesites:',
        items: [
          'Motion y física más cinematográficas',
          'Beats de acción camera-forward',
          'Realismo más limpio para productos',
        ],
      },
    },
  },
  {
    slugA: 'minimax-hailuo-02-text',
    slugB: 'ltx-2-fast',
    nameA: 'Hailuo 02',
    nameB: 'LTX 2 Fast',
    onlyFor: ['minimax-hailuo-02-text'],
    copyA: {
      en: {
        title: 'Use Hailuo 02 when you want:',
        items: [
          'Physics-heavy motion drafts',
          'Fast visual iteration on a budget',
          'Quick storyboard animatics',
        ],
      },
      fr: {
        title: 'Utilisez Hailuo 02 quand vous voulez :',
        items: [
          'Tests motion axés physique',
          'Itération visuelle rapide à petit budget',
          'Animatics storyboard rapides',
        ],
      },
      es: {
        title: 'Usa Hailuo 02 cuando quieras:',
        items: [
          'Borradores de motion con física',
          'Iteración visual rápida con bajo presupuesto',
          'Animatics de storyboard rápidos',
        ],
      },
    },
    copyB: {
      en: {
        title: 'Use LTX 2 Fast when you need:',
        items: [
          'More room per clip for pacing',
          'Drafts that stay closer to camera intent',
          'An easy upgrade path to LTX 2.3 Pro',
        ],
      },
      fr: {
        title: 'Utilisez LTX 2 Fast quand vous avez besoin :',
        items: [
          'Plus de durée par clip pour le pacing',
          'Tests plus proches de l’intention caméra',
          'Chemin simple vers LTX 2.3 Pro',
        ],
      },
      es: {
        title: 'Usa LTX 2 Fast cuando necesites:',
        items: [
          'Más duración por clip para el pacing',
          'Borradores más cercanos a la intención de cámara',
          'Camino fácil hacia LTX 2.3 Pro',
        ],
      },
    },
  },
];

export function resolveFocusVsConfig(currentSlug: string, locale: AppLocale): FocusVsConfig | null {
  const entry = FOCUS_VS_PAIRS.find((pair) => {
    if (pair.onlyFor && !pair.onlyFor.includes(currentSlug)) {
      return false;
    }
    return pair.slugA === currentSlug || pair.slugB === currentSlug;
  });
  if (!entry) return null;
  const isA = entry.slugA === currentSlug;
  const currentName = isA ? entry.nameA : entry.nameB;
  const otherName = isA ? entry.nameB : entry.nameA;
  const currentCopy = (isA ? entry.copyA : entry.copyB)[locale] ?? (isA ? entry.copyA : entry.copyB).en;
  const otherCopy = (isA ? entry.copyB : entry.copyA)[locale] ?? (isA ? entry.copyB : entry.copyA).en;
  const ctaSlug = isA ? entry.slugB : entry.slugA;
  const ctaLabel = (() => {
    if (locale === 'fr') return `Voir les détails ${otherName} →`;
    if (locale === 'es') return `Ver detalles de ${otherName} →`;
    return `View ${otherName} details →`;
  })();
  return {
    title: `${currentName} vs ${otherName}`,
    ctaLabel,
    ctaSlug,
    leftTitle: currentCopy.title,
    leftItems: currentCopy.items,
    rightTitle: otherCopy.title,
    rightItems: otherCopy.items,
  };
}
