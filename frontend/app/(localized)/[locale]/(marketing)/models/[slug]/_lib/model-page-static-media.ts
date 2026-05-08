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
