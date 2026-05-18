export type VideoSeoStatus = 'candidate' | 'draft' | 'needs_edits' | 'approved' | 'disabled';

export const VIDEO_SEO_STATUSES = ['candidate', 'draft', 'needs_edits', 'approved', 'disabled'] as const;

export type VideoSeoIntent =
  | 'prompt-example'
  | 'model-demo'
  | 'product-ad'
  | 'camera-motion'
  | 'image-to-video'
  | 'audio-enabled';

export const VIDEO_SEO_INTENTS = [
  'prompt-example',
  'model-demo',
  'product-ad',
  'camera-motion',
  'image-to-video',
  'audio-enabled',
] as const;

export type VideoSeoEditorialEntry = {
  id: string;
  seoStatus: VideoSeoStatus;
  seoTitle: string;
  metaDescription: string;
  h1: string;
  videoObjectName: string;
  shortDescription: string;
  targetKeyword: string;
  intent: VideoSeoIntent;
  modelSlug: string;
  examplesSlug: string;
  canonicalSlug?: string;
};

export const VIDEO_SEO_EDITORIAL_ENTRIES = [
  {
    id: 'job_b8e58d1b-7e9b-427b-a55c-17da2fafa48f',
    seoStatus: 'approved',
    seoTitle: 'Sora 2 Gorilla Dance Video Example with Strobe Lighting',
    metaDescription:
      'Watch a Sora 2 text-to-video example with a gorilla-mask dancer, strobe lighting, camera cuts, native audio and a 16:9 cinematic render.',
    h1: 'Sora 2 gorilla dance video example with strobe lighting',
    videoObjectName: 'Sora 2 gorilla dance video example with strobe lighting',
    shortDescription:
      'This Sora 2 watch page shows a gorilla-mask dance prompt rendered with strobe lighting, changing camera angles, native audio and a 16:9 output.',
    targetKeyword: 'Sora 2 gorilla dance video example',
    intent: 'audio-enabled',
    modelSlug: 'sora-2',
    examplesSlug: 'sora',
  },
  {
    id: 'job_b3ce25fd-01cc-4ee8-b225-a34984d864b7',
    seoStatus: 'approved',
    seoTitle: 'Kling 3 Pro Futuristic City Drone Flythrough Example',
    metaDescription:
      'Watch a Kling 3 Pro drone flythrough through a futuristic city, with smooth camera motion, 1080p output and a cinematic transition.',
    h1: 'Kling 3 Pro futuristic city drone flythrough example',
    videoObjectName: 'Kling 3 Pro futuristic city drone flythrough example',
    shortDescription:
      'This Kling 3 Pro example demonstrates a futuristic city flythrough with continuous drone-style motion and a seamless interior transition.',
    targetKeyword: 'Kling 3 Pro drone flythrough example',
    intent: 'camera-motion',
    modelSlug: 'kling-3-pro',
    examplesSlug: 'kling',
  },
  {
    id: 'job_43254cb2-e2ba-4d17-a5a1-4cf621ae535f',
    seoStatus: 'approved',
    seoTitle: 'Veo 3.1 Fast Living Room TV Commercial Example',
    metaDescription:
      'Watch a Veo 3.1 Fast living room TV commercial example with audio, polished staging, 16:9 framing and a short ad-style prompt.',
    h1: 'Veo 3.1 Fast living room TV commercial example',
    videoObjectName: 'Veo 3.1 Fast living room TV commercial example',
    shortDescription:
      'This Veo 3.1 Fast watch page shows a bright living-room TV commercial prompt with native audio, controlled staging and a 16:9 ad format.',
    targetKeyword: 'Veo 3.1 living room commercial example',
    intent: 'product-ad',
    modelSlug: 'veo-3-1-fast',
    examplesSlug: 'veo',
  },
  {
    id: 'job_f77a31c6-1549-471a-8fb1-1eb44c523390',
    seoStatus: 'approved',
    seoTitle: 'Wan 2.5 Vertical Smartwatch Runner Ad Example',
    metaDescription:
      'Watch a Wan 2.5 vertical smartwatch ad example with runner motion, audio timing, rain details and a 9:16 social video format.',
    h1: 'Wan 2.5 vertical smartwatch runner ad example',
    videoObjectName: 'Wan 2.5 vertical smartwatch runner ad example',
    shortDescription:
      'This Wan 2.5 example turns a smartwatch prompt into a vertical runner ad with beat-timed motion, rain details and audio-enabled pacing.',
    targetKeyword: 'Wan 2.5 smartwatch ad example',
    intent: 'product-ad',
    modelSlug: 'wan-2-5',
    examplesSlug: 'wan',
  },
  {
    id: 'job_4a7df4d3-758b-4f41-9c46-6e483157b0ff',
    seoStatus: 'approved',
    seoTitle: 'Seedance 1.5 Pro Luxury Perfume Commercial Example',
    metaDescription:
      'Watch a Seedance 1.5 Pro perfume commercial example with premium lighting, product-focused framing, audio and 1080p output.',
    h1: 'Seedance 1.5 Pro luxury perfume commercial example',
    videoObjectName: 'Seedance 1.5 Pro luxury perfume commercial example',
    shortDescription:
      'This Seedance 1.5 Pro watch page shows a luxury perfume prompt rendered as a polished product commercial with premium studio lighting.',
    targetKeyword: 'Seedance perfume commercial example',
    intent: 'product-ad',
    modelSlug: 'seedance-1-5-pro',
    examplesSlug: 'seedance',
  },
  {
    id: 'job_d8aac7b7-d2ce-4d5b-85d8-81ac8552c5c0',
    seoStatus: 'approved',
    seoTitle: 'LTX 2.3 Pro Office Image-to-Video Transition Example',
    metaDescription:
      'Watch an LTX 2.3 Pro image-to-video transition example with start and end frame control, office motion, audio and 1080p output.',
    h1: 'LTX 2.3 Pro office image-to-video transition example',
    videoObjectName: 'LTX 2.3 Pro office image-to-video transition example',
    shortDescription:
      'This LTX 2.3 Pro example uses image-to-video controls to preserve a scene across a directed office transition with strong frame continuity.',
    targetKeyword: 'LTX image to video transition example',
    intent: 'image-to-video',
    modelSlug: 'ltx-2-3-pro',
    examplesSlug: 'ltx',
  },
  {
    id: 'job_685fb5c2-6f2a-4da3-a246-19ed5829e1c4',
    seoStatus: 'needs_edits',
    seoTitle: 'Pika 2.2 Cinematic Walk Toward Camera Example',
    metaDescription:
      'Review this Pika 2.2 walking-camera example before indexing; the current prompt is too short for a premium video SEO watch page.',
    h1: 'Pika 2.2 cinematic walk toward camera example',
    videoObjectName: 'Pika 2.2 cinematic walk toward camera example',
    shortDescription:
      'This Pika 2.2 example needs a stronger editorial prompt and richer copy before it should be included in the video sitemap.',
    targetKeyword: 'Pika walking camera example',
    intent: 'camera-motion',
    modelSlug: 'pika-text-to-video',
    examplesSlug: 'pika',
  },
  {
    id: 'job_b3daa54b-b57c-4b01-963e-a459d15b9011',
    seoStatus: 'approved',
    seoTitle: 'Hailuo 02 City-to-Studio Flythrough Video Example',
    metaDescription:
      'Watch a Hailuo 02 city-to-studio flythrough example with night city motion, cinematic camera travel and 16:9 text-to-video output.',
    h1: 'Hailuo 02 city-to-studio flythrough video example',
    videoObjectName: 'Hailuo 02 city-to-studio flythrough video example',
    shortDescription:
      'This Hailuo 02 watch page shows a night city flythrough that moves into an AI studio, highlighting camera travel and scene continuity.',
    targetKeyword: 'Hailuo city flythrough example',
    intent: 'camera-motion',
    modelSlug: 'minimax-hailuo-02-text',
    examplesSlug: 'hailuo',
  },
  {
    id: 'job_74677d4f-9f28-4e47-b230-64accef8e239',
    seoStatus: 'approved',
    seoTitle: 'Sora 2 Mouse Hallway Escape Video Example',
    metaDescription:
      'Watch a Sora 2 mouse hallway escape example with audio, character movement, obstacle timing and a short cinematic game-like sequence.',
    h1: 'Sora 2 mouse hallway escape video example',
    videoObjectName: 'Sora 2 mouse hallway escape video example',
    shortDescription:
      'This Sora 2 page showcases a mouse-style hallway escape prompt with audio, obstacle timing and a compact narrative sequence.',
    targetKeyword: 'Sora 2 mouse escape example',
    intent: 'audio-enabled',
    modelSlug: 'sora-2',
    examplesSlug: 'sora',
  },
  {
    id: 'job_4d97a93f-1582-4a50-bff1-72894c302164',
    seoStatus: 'approved',
    seoTitle: 'Sora 2 Pro CCTV Cat in Wet Cement Example',
    metaDescription:
      'Watch a Sora 2 Pro CCTV-style video example where a cat crosses wet cement, with fixed-camera framing and a short comedy prompt.',
    h1: 'Sora 2 Pro CCTV cat in wet cement example',
    videoObjectName: 'Sora 2 Pro CCTV cat in wet cement example',
    shortDescription:
      'This Sora 2 Pro watch page shows a CCTV-style construction scene where a cat crosses wet cement, testing fixed framing and comic timing.',
    targetKeyword: 'Sora 2 Pro CCTV cat example',
    intent: 'prompt-example',
    modelSlug: 'sora-2-pro',
    examplesSlug: 'sora',
  },
  {
    id: 'job_a3e088db-b1e2-430f-83b3-2efce518c282',
    seoStatus: 'approved',
    seoTitle: 'Veo 3.1 Fast FPV Apartment Commercial Example',
    metaDescription:
      'Watch a Veo 3.1 Fast FPV apartment commercial example with native audio, camera movement, 16:9 framing and ad-style staging.',
    h1: 'Veo 3.1 Fast FPV apartment commercial example',
    videoObjectName: 'Veo 3.1 Fast FPV apartment commercial example',
    shortDescription:
      'This Veo 3.1 Fast example uses an FPV-style camera move to reveal a staged apartment commercial with sound and polished lighting.',
    targetKeyword: 'Veo 3.1 FPV apartment commercial',
    intent: 'camera-motion',
    modelSlug: 'veo-3-1-fast',
    examplesSlug: 'veo',
  },
  {
    id: 'job_4db2339c-000a-4b81-a68c-9314dd7940b2',
    seoStatus: 'approved',
    seoTitle: 'Veo 3.1 Fast Studio Interview Push-In Example',
    metaDescription:
      'Watch a Veo 3.1 Fast studio interview push-in example with audio, controlled camera motion and a clean 16:9 documentary setup.',
    h1: 'Veo 3.1 Fast studio interview push-in example',
    videoObjectName: 'Veo 3.1 Fast studio interview push-in example',
    shortDescription:
      'This Veo 3.1 Fast watch page shows a studio interview prompt with a controlled push-in camera move, native audio and documentary-style staging.',
    targetKeyword: 'Veo studio interview push in',
    intent: 'camera-motion',
    modelSlug: 'veo-3-1-fast',
    examplesSlug: 'veo',
  },
  {
    id: 'job_2c958e35-92e7-4c0f-8828-ec49476c8c4e',
    seoStatus: 'needs_edits',
    seoTitle: 'Pika 2.2 Moody Portrait Turn Video Example',
    metaDescription:
      'Review this Pika 2.2 portrait-turn example before indexing; the prompt needs more detail for a premium video SEO page.',
    h1: 'Pika 2.2 moody portrait turn video example',
    videoObjectName: 'Pika 2.2 moody portrait turn video example',
    shortDescription:
      'This Pika 2.2 model demo needs a richer prompt and stronger editorial framing before it should be eligible for the video sitemap.',
    targetKeyword: 'Pika portrait turn example',
    intent: 'prompt-example',
    modelSlug: 'pika-text-to-video',
    examplesSlug: 'pika',
  },
  {
    id: 'job_e2cee5f4-54d9-4cda-a705-974e5500a404',
    seoStatus: 'approved',
    seoTitle: 'Kling 2.5 Turbo FPV Apartment Commercial Example',
    metaDescription:
      'Watch a Kling 2.5 Turbo FPV apartment commercial example with camera movement, indoor staging and a short 16:9 ad prompt.',
    h1: 'Kling 2.5 Turbo FPV apartment commercial example',
    videoObjectName: 'Kling 2.5 Turbo FPV apartment commercial example',
    shortDescription:
      'This Kling 2.5 Turbo example shows an FPV-style apartment commercial prompt with controlled indoor motion and clear ad pacing.',
    targetKeyword: 'Kling FPV apartment commercial',
    intent: 'camera-motion',
    modelSlug: 'kling-2-5-turbo',
    examplesSlug: 'kling',
  },
  {
    id: 'job_45f1fe48-ed93-452d-819b-9b956cd2d489',
    seoStatus: 'approved',
    seoTitle: 'Kling 2.6 Pro Futuristic Hangar Duel Example',
    metaDescription:
      'Watch a Kling 2.6 Pro futuristic hangar duel example with glowing weapons, audio-enabled action and a 16:9 cinematic prompt.',
    h1: 'Kling 2.6 Pro futuristic hangar duel example',
    videoObjectName: 'Kling 2.6 Pro futuristic hangar duel example',
    shortDescription:
      'This Kling 2.6 Pro watch page shows a futuristic hangar duel with glowing weapons, wet metal surfaces and audio-enabled action pacing.',
    targetKeyword: 'Kling futuristic hangar duel',
    intent: 'audio-enabled',
    modelSlug: 'kling-2-6-pro',
    examplesSlug: 'kling',
  },
  {
    id: 'job_665a317f-f4dc-41c8-ade4-4a0a891627c8',
    seoStatus: 'approved',
    seoTitle: 'Kling 3 Pro Neon Street Multi-Shot Example',
    metaDescription:
      'Watch a Kling 3 Pro neon street multi-shot example with rain, audio, cinematic lighting and a structured 15-second prompt.',
    h1: 'Kling 3 Pro neon street multi-shot example',
    videoObjectName: 'Kling 3 Pro neon street multi-shot example',
    shortDescription:
      'This Kling 3 Pro example demonstrates a multi-shot neon street sequence with rain reflections, native audio and structured scene anchors.',
    targetKeyword: 'Kling 3 Pro multi-shot example',
    intent: 'camera-motion',
    modelSlug: 'kling-3-pro',
    examplesSlug: 'kling',
  },
  {
    id: 'job_99e0f0fa-6092-4b8a-8c08-e329c579d0f2',
    seoStatus: 'approved',
    seoTitle: 'Kling 3 Standard Rainy Neon Street Multi-Shot Example',
    metaDescription:
      'Watch a Kling 3 Standard rainy neon street example with multi-shot structure, audio, wet reflections and 1080p 16:9 output.',
    h1: 'Kling 3 Standard rainy neon street multi-shot example',
    videoObjectName: 'Kling 3 Standard rainy neon street multi-shot example',
    shortDescription:
      'This Kling 3 Standard page shows a rainy neon street prompt with multi-shot structure, audio-enabled pacing and cinematic reflections.',
    targetKeyword: 'Kling 3 Standard rainy neon example',
    intent: 'camera-motion',
    modelSlug: 'kling-3-standard',
    examplesSlug: 'kling',
  },
  {
    id: 'job_3f82e69d-ef44-4c46-aded-16d06dd4a1ab',
    seoStatus: 'approved',
    seoTitle: 'Seedance 1.5 Pro Tabletop Product Commercial Example',
    metaDescription:
      'Watch a Seedance 1.5 Pro tabletop product commercial example with controlled camera motion, audio and clean studio lighting.',
    h1: 'Seedance 1.5 Pro tabletop product commercial example',
    videoObjectName: 'Seedance 1.5 Pro tabletop product commercial example',
    shortDescription:
      'This Seedance 1.5 Pro example shows a tabletop product commercial with subtle movement, clean landing frames and premium studio cues.',
    targetKeyword: 'Seedance tabletop product commercial',
    intent: 'product-ad',
    modelSlug: 'seedance-1-5-pro',
    examplesSlug: 'seedance',
  },
  {
    id: 'job_4b882003-b595-4d4e-b62c-1ae22f002bcf',
    seoStatus: 'approved',
    seoTitle: 'Wan 2.5 Vertical Spy-to-Zoom Comedy Video Example',
    metaDescription:
      'Watch a Wan 2.5 vertical comedy video example that starts like a spy action trailer and reveals a Zoom-call punchline.',
    h1: 'Wan 2.5 vertical spy-to-Zoom comedy video example',
    videoObjectName: 'Wan 2.5 vertical spy-to-Zoom comedy video example',
    shortDescription:
      'This Wan 2.5 watch page shows a vertical comedy prompt that opens like a spy action scene and ends with a Zoom-call reveal.',
    targetKeyword: 'Wan spy comedy video example',
    intent: 'audio-enabled',
    modelSlug: 'wan-2-5',
    examplesSlug: 'wan',
  },
  {
    id: 'job_bbad258b-fdd3-4315-95eb-4ed1d2e59382',
    seoStatus: 'approved',
    seoTitle: 'Wan 2.6 Rainy Neon Thriller Sequence Example',
    metaDescription:
      'Watch a Wan 2.6 rainy neon thriller example with multi-shot structure, audio, cinematic lighting and 15-second pacing.',
    h1: 'Wan 2.6 rainy neon thriller sequence example',
    videoObjectName: 'Wan 2.6 rainy neon thriller sequence example',
    shortDescription:
      'This Wan 2.6 page shows a rainy neon thriller prompt with multi-shot direction, smooth camera work and audio-enabled pacing.',
    targetKeyword: 'Wan 2.6 rainy neon thriller',
    intent: 'camera-motion',
    modelSlug: 'wan-2-6',
    examplesSlug: 'wan',
  },
  {
    id: 'job_71905754-c5e6-4078-864d-f17cd7f62d95',
    seoStatus: 'needs_edits',
    seoTitle: 'Hailuo 02 Playful Bento Unboxing Video Example',
    metaDescription:
      'Review this Hailuo 02 bento unboxing example before indexing; the prompt is too short for a premium video SEO watch page.',
    h1: 'Hailuo 02 playful bento unboxing video example',
    videoObjectName: 'Hailuo 02 playful bento unboxing video example',
    shortDescription:
      'This Hailuo 02 model demo needs a richer prompt and stronger editorial page copy before it should return to the video sitemap.',
    targetKeyword: 'Hailuo bento unboxing example',
    intent: 'prompt-example',
    modelSlug: 'minimax-hailuo-02-text',
    examplesSlug: 'hailuo',
  },
  {
    id: 'job_78cb3e71-cab5-48e2-9965-9f521ba51c0f',
    seoStatus: 'approved',
    seoTitle: 'LTX 2.3 Fast Neon Racer Reveal Example',
    metaDescription:
      'Watch an LTX 2.3 Fast neon racer reveal example with audio, cinematic tunnel lighting, product-style framing and 1080p output.',
    h1: 'LTX 2.3 Fast neon racer reveal example',
    videoObjectName: 'LTX 2.3 Fast neon racer reveal example',
    shortDescription:
      'This LTX 2.3 Fast example shows a neon racer reveal beside a futuristic motorcycle, testing character motion and product-ad framing.',
    targetKeyword: 'LTX neon racer reveal example',
    intent: 'product-ad',
    modelSlug: 'ltx-2-3-fast',
    examplesSlug: 'ltx',
  },
  {
    id: 'job_2a07e085-4764-4e9b-8850-c3941dbf303a',
    seoStatus: 'approved',
    seoTitle: 'LTX 2.3 Pro Rooftop Lightning Fashion Shot Example',
    metaDescription:
      'Watch an LTX 2.3 Pro rooftop fashion video example with lightning, wind, neon city atmosphere, audio and 1080p output.',
    h1: 'LTX 2.3 Pro rooftop lightning fashion shot example',
    videoObjectName: 'LTX 2.3 Pro rooftop lightning fashion shot example',
    shortDescription:
      'This LTX 2.3 Pro page shows a rooftop fashion prompt with storm lighting, neon city atmosphere and cinematic subject isolation.',
    targetKeyword: 'LTX rooftop fashion video example',
    intent: 'audio-enabled',
    modelSlug: 'ltx-2-3-pro',
    examplesSlug: 'ltx',
  },
  {
    id: 'job_d895c3b0-562a-4e36-ae06-4ce083a47126',
    seoStatus: 'approved',
    seoTitle: 'LTX 2.0 Fast Startup Office Walkthrough Example',
    metaDescription:
      'Watch an LTX 2.0 Fast startup office walkthrough example with continuous camera movement, audio and a 16:9 workplace prompt.',
    h1: 'LTX 2.0 Fast startup office walkthrough example',
    videoObjectName: 'LTX 2.0 Fast startup office walkthrough example',
    shortDescription:
      'This LTX 2.0 Fast watch page shows a continuous startup office walkthrough with glass-door entry, workplace motion and audio cues.',
    targetKeyword: 'LTX startup office walkthrough',
    intent: 'camera-motion',
    modelSlug: 'ltx-2-fast',
    examplesSlug: 'ltx',
  },
  {
    id: 'job_4597a819-c1d9-4a15-9893-5d399922df2e',
    seoStatus: 'approved',
    seoTitle: 'LTX 2.0 Pro Folding City Street Effect Example',
    metaDescription:
      'Watch an LTX 2.0 Pro folding city street example with dreamlike motion, 16:9 framing, audio and a cinematic urban effect.',
    h1: 'LTX 2.0 Pro folding city street effect example',
    videoObjectName: 'LTX 2.0 Pro folding city street effect example',
    shortDescription:
      'This LTX 2.0 Pro page shows a dreamlike city street folding upward, with a slow dolly move, urban scale and cinematic motion.',
    targetKeyword: 'LTX folding city street effect',
    intent: 'camera-motion',
    modelSlug: 'ltx-2',
    examplesSlug: 'ltx',
  },
] satisfies readonly VideoSeoEditorialEntry[];

const VIDEO_SEO_EDITORIAL_MAP = new Map(VIDEO_SEO_EDITORIAL_ENTRIES.map((entry) => [entry.id, entry] as const));

export function getVideoSeoEditorialEntry(id?: string | null): VideoSeoEditorialEntry | null {
  if (!id) return null;
  return VIDEO_SEO_EDITORIAL_MAP.get(id) ?? null;
}
