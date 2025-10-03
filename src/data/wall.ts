export type ClipTier = "Premium" | "Pro" | "Budget" | "Open";

export type ClipPriceBilling = "per_clip" | "per_second";

export interface ClipCost {
  currency: "USD";
  amount: number;
  billing: ClipPriceBilling;
  display: string;
  notes?: string;
}

export interface ClipEnhanceOption {
  id: string;
  label: string;
  description: string;
  priceDisplay: string;
}

export interface ClipParameter {
  label: string;
  value: string;
}

export interface ClipAnalytics {
  trendingScore: number;
  freshnessScore: number;
  valueScore: number;
}

export interface ClipMedia {
  video: string;
  poster: string;
  sprite?: string;
  fallback?: string;
}

export interface ClipUsage {
  rights: string;
  licenseUrl: string;
  watermark: boolean;
}

export interface ClipItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  tier: ClipTier;
  engine: string;
  engineVersion: string;
  durationSeconds: number;
  resolution: "720p" | "1080p" | "4K";
  aspect: "16:9" | "9:16" | "1:1" | "21:9" | "4:5" | "5:4";
  hasAudio: boolean;
  badges: string[];
  cost: ClipCost;
  pricePerSecondUsd?: number;
  media: ClipMedia;
  tags: string[];
  category: string;
  editorPick?: boolean;
  parameters: {
    prompt: string;
    negativePrompt?: string;
    extras: ClipParameter[];
  };
  enhanceOptions: ClipEnhanceOption[];
  usage: ClipUsage;
  analytics: ClipAnalytics;
}

export interface CollectionDefinition {
  slug: string;
  title: string;
  category: string;
  description: string;
  whenToUse: string;
  heroClipIds: string[];
  filter: {
    tiers?: ClipTier[];
    engines?: string[];
    aspects?: Array<ClipItem["aspect"]>;
    priceCeilingUsd?: number;
    tags?: string[];
  };
}

export interface ChainDefinition {
  id: string;
  title: string;
  summary: string;
  description: string;
  priceDisplay: string;
  steps: string[];
  heroClipId?: string;
  slug: string;
}

export const clipItems: ClipItem[] = [
  {
    id: "veo3-cinematic-board",
    slug: "veo3-cinematic-board",
    title: "Veo 3 cinematic boardroom",
    summary: "Slow dolly push across a glass boardroom as sunlight hits the table.",
    tier: "Premium",
    engine: "Veo",
    engineVersion: "Veo 3",
    durationSeconds: 8,
    resolution: "1080p",
    aspect: "16:9",
    hasAudio: true,
    badges: ["Veo 3", "8s", "1080p", "16:9", "audio on"],
    cost: {
      currency: "USD",
      amount: 3.2,
      billing: "per_clip",
      display: "$3.20",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Mt_Baker.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4",
      poster: "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["cinematic", "b-roll", "premium"],
    category: "Corporate",
    editorPick: true,
    parameters: {
      prompt:
        "ultra wide cinematic shot of a modern glass boardroom at sunrise, beam of warm light catching floating dust, slow dolly push, volumetric lighting",
      extras: [
        { label: "Seed", value: "4821" },
        { label: "CFG", value: "9" },
        { label: "Audio", value: "licensed score" },
      ],
    },
    enhanceOptions: [
      {
        id: "veo3-cinematic-board-upscale",
        label: "Upscale to 4K",
        description: "Temporal upscale via SeedVR2 for campaigns.",
        priceDisplay: "$1.80",
      },
      {
        id: "veo3-cinematic-board-reframe",
        label: "Dual export 9:16",
        description: "Subject-aware reframe with Ray-2 in one click.",
        priceDisplay: "$0.90",
      },
    ],
    usage: {
      rights: "Commercial with credit",
      licenseUrl: "/legal",
      watermark: false,
    },
    analytics: {
      trendingScore: 0.92,
      freshnessScore: 0.66,
      valueScore: 0.81,
    },
  },
  {
    id: "veo3-vertical-hightide",
    slug: "veo3-vertical-hightide",
    title: "Veo 3 coastal high tide",
    summary: "Vertical drift shot over surfboards stacked against a tiki bar at dusk.",
    tier: "Premium",
    engine: "Veo",
    engineVersion: "Veo 3",
    durationSeconds: 6,
    resolution: "1080p",
    aspect: "9:16",
    hasAudio: true,
    badges: ["Veo 3", "6s", "1080p", "9:16", "audio on"],
    cost: {
      currency: "USD",
      amount: 2.6,
      billing: "per_clip",
      display: "$2.60",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Surfing.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Surfing.mp4",
      poster: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["vertical", "travel", "premium"],
    category: "Lifestyle",
    parameters: {
      prompt:
        "drone style glide down a row of vibrant surfboards leaning on a tiki bar, golden hour, teal ocean backdrop, lively bokeh lights",
      extras: [
        { label: "Seed", value: "672" },
        { label: "Audio", value: "beach ambient" },
      ],
    },
    enhanceOptions: [
      {
        id: "veo3-vertical-hightide-reframe",
        label: "Reframe 16:9",
        description: "Landscape version for YouTube pre-rolls.",
        priceDisplay: "$0.90",
      },
    ],
    usage: {
      rights: "Commercial with credit",
      licenseUrl: "/legal",
      watermark: false,
    },
    analytics: {
      trendingScore: 0.88,
      freshnessScore: 0.74,
      valueScore: 0.79,
    },
  },
  {
    id: "kling-fast-lifestyle",
    slug: "kling-fast-lifestyle",
    title: "Kling Turbo lifestyle hook",
    summary: "Handheld loop of sneakers hitting the pavement with neon reflections.",
    tier: "Pro",
    engine: "Kling",
    engineVersion: "Kling 2.5 Turbo",
    durationSeconds: 5,
    resolution: "720p",
    aspect: "1:1",
    hasAudio: false,
    badges: ["Kling Turbo", "5s", "720p", "1:1", "audio off"],
    cost: {
      currency: "USD",
      amount: 1.15,
      billing: "per_clip",
      display: "$1.15",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Street_Vibes.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Street_Vibes.mp4",
      poster: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["hook", "product", "street"],
    category: "Product",
    editorPick: true,
    parameters: {
      prompt:
        "close-up of neon-lit sneakers pounding wet pavement, particles of water splashing in slow motion, gritty handheld camera, urban night",
      extras: [
        { label: "Seed", value: "94" },
        { label: "CFG", value: "7.5" },
      ],
    },
    enhanceOptions: [
      {
        id: "kling-fast-lifestyle-audio",
        label: "Add audio pulse",
        description: "Layer a royalty-free heartbeat bass loop.",
        priceDisplay: "$0.30",
      },
      {
        id: "kling-fast-lifestyle-upscale",
        label: "Upscale 1080p",
        description: "Topaz temporal upscale for crisp highlights.",
        priceDisplay: "$0.80",
      },
    ],
    usage: {
      rights: "Commercial",
      licenseUrl: "/legal",
      watermark: false,
    },
    analytics: {
      trendingScore: 0.77,
      freshnessScore: 0.55,
      valueScore: 0.84,
    },
  },
  {
    id: "pika-loop-illustration",
    slug: "pika-loop-illustration",
    title: "Pika stylised loop",
    summary: "Looped illustration of a botanist desk with animated pencil lines.",
    tier: "Pro",
    engine: "Pika",
    engineVersion: "Pika 2.2",
    durationSeconds: 5,
    resolution: "720p",
    aspect: "1:1",
    hasAudio: false,
    badges: ["Pika 2.2", "5s", "720p", "1:1", "audio off"],
    cost: {
      currency: "USD",
      amount: 0.9,
      billing: "per_clip",
      display: "$0.90",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Iceland.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Iceland.mp4",
      poster: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["loop", "illustration", "organic"],
    category: "Design",
    parameters: {
      prompt:
        "animated illustration of a botanist desk filled with notebooks, fern leaves and microscopes, pencil lines sketch in and out, looping seamlessly",
      extras: [
        { label: "Seed", value: "768" },
        { label: "CFG", value: "6.5" },
      ],
    },
    enhanceOptions: [
      {
        id: "pika-loop-reframe",
        label: "Reframe 4:5",
        description: "Optimise for Pinterest placement.",
        priceDisplay: "$0.35",
      },
    ],
    usage: {
      rights: "Commercial",
      licenseUrl: "/legal",
      watermark: false,
    },
    analytics: {
      trendingScore: 0.69,
      freshnessScore: 0.6,
      valueScore: 0.88,
    },
  },
  {
    id: "wan-open-studio",
    slug: "wan-open-studio",
    title: "WAN studio pan",
    summary: "Budget-friendly pan across a design studio moodboard.",
    tier: "Budget",
    engine: "WAN",
    engineVersion: "WAN 2.2",
    durationSeconds: 6,
    resolution: "720p",
    aspect: "16:9",
    hasAudio: false,
    badges: ["WAN 2.2", "6s", "720p", "16:9", "audio off"],
    cost: {
      currency: "USD",
      amount: 0.45,
      billing: "per_clip",
      display: "$0.45",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Design_Studio.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Design_Studio.mp4",
      poster: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["budget", "workspace", "pan"],
    category: "Workspace",
    parameters: {
      prompt:
        "slow lateral pan of a creative studio desk covered with color palettes, typography samples and sketches under soft daylight",
      extras: [{ label: "Seed", value: "318" }],
    },
    enhanceOptions: [
      {
        id: "wan-open-upscale",
        label: "Upscale 1080p",
        description: "Lift clarity for presentations.",
        priceDisplay: "$0.70",
      },
    ],
    usage: {
      rights: "Commercial",
      licenseUrl: "/legal",
      watermark: true,
    },
    analytics: {
      trendingScore: 0.52,
      freshnessScore: 0.48,
      valueScore: 0.91,
    },
  },
  {
    id: "hunyuan-logo-morph",
    slug: "hunyuan-logo-morph",
    title: "Hunyuan logo morph",
    summary: "Logo melts into refracted glass shapes before snapping back.",
    tier: "Budget",
    engine: "Hunyuan",
    engineVersion: "Hunyuan Video",
    durationSeconds: 5,
    resolution: "720p",
    aspect: "1:1",
    hasAudio: false,
    badges: ["Hunyuan", "5s", "720p", "1:1", "audio off"],
    cost: {
      currency: "USD",
      amount: 0.35,
      billing: "per_clip",
      display: "$0.35",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Abstract_Flow.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Abstract_Flow.mp4",
      poster: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["logo", "morph", "abstract"],
    category: "Branding",
    parameters: {
      prompt:
        "brand logo morphing through translucent glass forms, refractive caustics, loop that resolves back to clean logo, studio lighting",
      extras: [
        { label: "Seed", value: "145" },
        { label: "CFG", value: "8" },
      ],
    },
    enhanceOptions: [
      {
        id: "hunyuan-logo-audio",
        label: "Add whoosh audio",
        description: "Layer premium whoosh pack for reveal.",
        priceDisplay: "$0.20",
      },
      {
        id: "hunyuan-logo-upscale",
        label: "Upscale 1080p",
        description: "Upgrade for event screens.",
        priceDisplay: "$0.70",
      },
    ],
    usage: {
      rights: "Commercial",
      licenseUrl: "/legal",
      watermark: true,
    },
    analytics: {
      trendingScore: 0.58,
      freshnessScore: 0.63,
      valueScore: 0.86,
    },
  },
  {
    id: "luma-dream-cafe",
    slug: "luma-dream-cafe",
    title: "Luma dream cafe",
    summary: "Drift through a painterly cafe interior with exaggerated brush strokes.",
    tier: "Pro",
    engine: "Luma",
    engineVersion: "Dream Machine",
    durationSeconds: 6,
    resolution: "1080p",
    aspect: "21:9",
    hasAudio: false,
    badges: ["Luma", "6s", "1080p", "21:9", "audio off"],
    cost: {
      currency: "USD",
      amount: 1.2,
      billing: "per_clip",
      display: "$1.20",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Cafe_Lifestyle.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Cafe_Lifestyle.mp4",
      poster: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["stylised", "wide", "concept"],
    category: "Hospitality",
    parameters: {
      prompt:
        "wide painterly camera glide through an artisanal cafe with oversized latte art and warm brush strokes, stylised motion blur",
      extras: [
        { label: "Seed", value: "290" },
        { label: "CFG", value: "7" },
      ],
    },
    enhanceOptions: [
      {
        id: "luma-dream-audio",
        label: "Add ambience",
        description: "Layer signature coffee shop ambience loop.",
        priceDisplay: "$0.45",
      },
    ],
    usage: {
      rights: "Commercial",
      licenseUrl: "/legal",
      watermark: false,
    },
    analytics: {
      trendingScore: 0.73,
      freshnessScore: 0.58,
      valueScore: 0.8,
    },
  },
  {
    id: "ray2-reframe-fashion",
    slug: "ray2-reframe-fashion",
    title: "Ray-2 reframe fashion walk",
    summary: "Demonstrates smart subject tracking when reframing between ratios.",
    tier: "Pro",
    engine: "Ray",
    engineVersion: "Ray-2 Reframe",
    durationSeconds: 6,
    resolution: "1080p",
    aspect: "16:9",
    hasAudio: false,
    badges: ["Ray-2", "6s", "1080p", "16:9", "audio off"],
    cost: {
      currency: "USD",
      amount: 0.95,
      billing: "per_clip",
      display: "$0.95",
      notes: "Source render required",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Fashion_Show.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Fashion_Show.mp4",
      poster: "https://images.unsplash.com/photo-1521337580396-0259d79ccf0b?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["reframe", "fashion", "workflow"],
    category: "Chains",
    parameters: {
      prompt: "Subject-aware reframing pass for fashion runway clip, maintaining headroom and feet placement across 16:9 and 9:16 outputs",
      extras: [
        { label: "Input", value: "Kling vertical base" },
        { label: "Output", value: "16:9" },
      ],
    },
    enhanceOptions: [
      {
        id: "ray2-dual-export",
        label: "Dual export",
        description: "Render 16:9 + 9:16 simultaneously.",
        priceDisplay: "$1.50",
      },
    ],
    usage: {
      rights: "Derivative",
      licenseUrl: "/legal",
      watermark: false,
    },
    analytics: {
      trendingScore: 0.68,
      freshnessScore: 0.47,
      valueScore: 0.83,
    },
  },
  {
    id: "seedvr-upscale-drone",
    slug: "seedvr-upscale-drone",
    title: "SeedVR upscale drone",
    summary: "Upscale pass that doubles resolution on a mountain drone pullback.",
    tier: "Pro",
    engine: "SeedVR2",
    engineVersion: "SeedVR2",
    durationSeconds: 8,
    resolution: "4K",
    aspect: "16:9",
    hasAudio: false,
    badges: ["SeedVR2", "8s", "4K", "16:9", "audio off"],
    cost: {
      currency: "USD",
      amount: 1.6,
      billing: "per_clip",
      display: "$1.60",
      notes: "Enhance add-on",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Morning_Glory.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Morning_Glory.mp4",
      poster: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["upscale", "mountain", "enhance"],
    category: "Chains",
    parameters: {
      prompt: "Temporal upscale of mountain drone pullback, preserving fine snow detail and removing flicker",
      extras: [
        { label: "Input", value: "WAN base render" },
        { label: "Scale", value: "2x" },
      ],
    },
    enhanceOptions: [
      {
        id: "seedvr-audio",
        label: "Add ambient score",
        description: "Soft cinematic bed for hero montage.",
        priceDisplay: "$0.40",
      },
    ],
    usage: {
      rights: "Derivative",
      licenseUrl: "/legal",
      watermark: false,
    },
    analytics: {
      trendingScore: 0.71,
      freshnessScore: 0.42,
      valueScore: 0.82,
    },
  },
  {
    id: "open-wildlife-loop",
    slug: "open-wildlife-loop",
    title: "Open wildlife loop",
    summary: "Open-model clip of hummingbird hovering over jungle flowers.",
    tier: "Open",
    engine: "Open",
    engineVersion: "SVD 1.1",
    durationSeconds: 5,
    resolution: "720p",
    aspect: "4:5",
    hasAudio: false,
    badges: ["Open", "5s", "720p", "4:5", "audio off"],
    cost: {
      currency: "USD",
      amount: 0.15,
      billing: "per_clip",
      display: "$0.15",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Hummingbird.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Hummingbird.mp4",
      poster: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["nature", "loop", "open"],
    category: "Nature",
    parameters: {
      prompt:
        "macro shot of hummingbird hovering around tropical flowers, vibrant feathers shimmering, looping gently",
      extras: [{ label: "Seed", value: "901" }],
    },
    enhanceOptions: [
      {
        id: "open-wildlife-upscale",
        label: "Upscale to 1080p",
        description: "Optional quality lift for hero placements.",
        priceDisplay: "$0.70",
      },
    ],
    usage: {
      rights: "Attribution required",
      licenseUrl: "/legal",
      watermark: true,
    },
    analytics: {
      trendingScore: 0.64,
      freshnessScore: 0.39,
      valueScore: 0.9,
    },
  },
  {
    id: "budget-kitchen-loop",
    slug: "budget-kitchen-loop",
    title: "Budget kitchen loop",
    summary: "Playful ingredient toss in a clean kitchen set for recipe intros.",
    tier: "Budget",
    engine: "WAN",
    engineVersion: "WAN 2.1",
    durationSeconds: 5,
    resolution: "720p",
    aspect: "16:9",
    hasAudio: false,
    badges: ["WAN 2.1", "5s", "720p", "16:9", "audio off"],
    cost: {
      currency: "USD",
      amount: 0.4,
      billing: "per_clip",
      display: "$0.40",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Healthy_Salad.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Healthy_Salad.mp4",
      poster: "https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["food", "loop", "budget"],
    category: "Food",
    parameters: {
      prompt:
        "slow motion toss of colourful vegetables above a modern kitchen counter, shallow depth of field, playful loop for recipes",
      extras: [{ label: "Seed", value: "217" }],
    },
    enhanceOptions: [
      {
        id: "budget-kitchen-audio",
        label: "Add sizzle audio",
        description: "Adds professional sizzling layer.",
        priceDisplay: "$0.25",
      },
    ],
    usage: {
      rights: "Commercial",
      licenseUrl: "/legal",
      watermark: true,
    },
    analytics: {
      trendingScore: 0.57,
      freshnessScore: 0.52,
      valueScore: 0.87,
    },
  },
  {
    id: "premium-logo-morph",
    slug: "premium-logo-morph",
    title: "Premium logo morph",
    summary: "High-end Veo morph of chrome logo emerging from liquid metal.",
    tier: "Premium",
    engine: "Veo",
    engineVersion: "Veo 3",
    durationSeconds: 8,
    resolution: "1080p",
    aspect: "16:9",
    hasAudio: true,
    badges: ["Veo 3", "8s", "1080p", "16:9", "audio on"],
    cost: {
      currency: "USD",
      amount: 3.5,
      billing: "per_clip",
      display: "$3.50",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Fluid_Metal.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Fluid_Metal.mp4",
      poster: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["logo", "premium", "liquid metal"],
    category: "Branding",
    parameters: {
      prompt:
        "chrome logo emerging from liquid mercury pool, macro lens, cinematic lighting, slow reveal with specular highlights",
      extras: [
        { label: "Seed", value: "520" },
        { label: "Audio", value: "impact swell" },
      ],
    },
    enhanceOptions: [
      {
        id: "premium-logo-reframe",
        label: "Reframe 9:16",
        description: "TikTok-ready layout with safe margins.",
        priceDisplay: "$1.10",
      },
      {
        id: "premium-logo-upscale",
        label: "Upscale 4K",
        description: "Top-tier delivery for broadcast.",
        priceDisplay: "$2.10",
      },
    ],
    usage: {
      rights: "Commercial",
      licenseUrl: "/legal",
      watermark: false,
    },
    analytics: {
      trendingScore: 0.83,
      freshnessScore: 0.61,
      valueScore: 0.78,
    },
  },
  {
    id: "budget-fitness-loop",
    slug: "budget-fitness-loop",
    title: "Budget fitness loop",
    summary: "Loop of athlete stretching in a loft studio with natural light.",
    tier: "Budget",
    engine: "WAN",
    engineVersion: "WAN 2.2",
    durationSeconds: 6,
    resolution: "720p",
    aspect: "9:16",
    hasAudio: false,
    badges: ["WAN 2.2", "6s", "720p", "9:16", "audio off"],
    cost: {
      currency: "USD",
      amount: 0.42,
      billing: "per_clip",
      display: "$0.42",
    },
    media: {
      video: "https://storage.googleapis.com/coverr-main/webm/Yoga.webm",
      fallback: "https://storage.googleapis.com/coverr-main/mp4/Yoga.mp4",
      poster: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80",
    },
    tags: ["fitness", "vertical", "budget"],
    category: "Lifestyle",
    parameters: {
      prompt:
        "vertical shot of athlete stretching in sunlit loft studio, dust particles glowing, loop for fitness reels",
      extras: [{ label: "Seed", value: "314" }],
    },
    enhanceOptions: [
      {
        id: "budget-fitness-upscale",
        label: "Upscale 1080p",
        description: "Sharper export for paid placements.",
        priceDisplay: "$0.70",
      },
    ],
    usage: {
      rights: "Commercial",
      licenseUrl: "/legal",
      watermark: true,
    },
    analytics: {
      trendingScore: 0.66,
      freshnessScore: 0.53,
      valueScore: 0.85,
    },
  },
];

export const collections: CollectionDefinition[] = [
  {
    slug: "cinematic-quality",
    title: "Cinematic Quality",
    category: "Premium",
    description: "Premium Veo and Luma picks when you need broadcast-level polish.",
    whenToUse: "Launch trailers, brand films, or cinematic overlays that need instant wow.",
    heroClipIds: ["veo3-cinematic-board", "premium-logo-morph", "luma-dream-cafe"],
    filter: {
      tiers: ["Premium"],
      tags: ["cinematic", "premium"],
    },
  },
  {
    slug: "best-value-hd",
    title: "Best Value HD",
    category: "Pro",
    description: "Pro tier engines that balance cost and clarity for daily delivery.",
    whenToUse: "Marketing sprints, paid social, or client work where speed matters.",
    heroClipIds: ["kling-fast-lifestyle", "pika-loop-illustration", "ray2-reframe-fashion"],
    filter: {
      tiers: ["Pro"],
      priceCeilingUsd: 1.2,
    },
  },
  {
    slug: "vertical-ads",
    title: "Vertical Ads",
    category: "Vertical",
    description: "Battle-tested portrait hooks ready for TikTok, Shorts, and Reels.",
    whenToUse: "Need a scroll-stopping vertical prototype fast? Start here.",
    heroClipIds: ["veo3-vertical-hightide", "budget-fitness-loop", "kling-fast-lifestyle"],
    filter: {
      aspects: ["9:16"],
    },
  },
  {
    slug: "logo-morphs",
    title: "Logo Morphs",
    category: "Branding",
    description: "Morphs from premium Veo reveals to budget-friendly open loops.",
    whenToUse: "For pitch decks, investor updates, or campaign idents.",
    heroClipIds: ["premium-logo-morph", "hunyuan-logo-morph"],
    filter: {
      tags: ["logo", "morph"],
    },
  },
  {
    slug: "budget-bangers",
    title: "Budget Bangers",
    category: "Budget",
    description: "Open and budget renders that still stand out with a polish pass.",
    whenToUse: "Validate ideas, crank out volume, or feed organic social calendars.",
    heroClipIds: ["wan-open-studio", "budget-kitchen-loop", "open-wildlife-loop"],
    filter: {
      tiers: ["Budget", "Open"],
      priceCeilingUsd: 0.5,
    },
  },
];

export const chains: ChainDefinition[] = [
  {
    id: "morph",
    slug: "morph",
    title: "Morph",
    summary: "Image A -> B morph built on Hailuo/WAN 2.2.",
    description:
      "Upload your start and end frames, set pacing, and generate smooth morphs that keep logos and icons sharp across frames.",
    priceDisplay: "$0.85 + base render",
    steps: [
      "Select start and end visuals",
      "Tune pacing and easing",
      "Preview morph and adjust key moments",
      "Render and push result to Wall",
    ],
    heroClipId: "hunyuan-logo-morph",
  },
  {
    id: "upscale-4k",
    slug: "upscale-4k",
    title: "Upscale 4K",
    summary: "Topaz + SeedVR2 pipeline for crispy hero exports.",
    description:
      "Drop in any Wall clip or upload your own render, then let the temporal pipeline build a stable 4K sequence with motion-aware sharpening.",
    priceDisplay: "$1.60 per clip",
    steps: [
      "Select source clip",
      "Choose quality target (2x or 4x)",
      "Run temporal preview",
      "Publish upgraded clip to Wall",
    ],
    heroClipId: "seedvr-upscale-drone",
  },
  {
    id: "reframe",
    slug: "reframe",
    title: "Reframe",
    summary: "Ray-2 subject-aware ratio swaps in one click.",
    description:
      "Keep the action centred as you jump between 16:9 and 9:16. Batch export both ratios for omnichannel launches.",
    priceDisplay: "$0.95 per output",
    steps: [
      "Pick the Wall clip or upload source",
      "Set focus mode (auto, face track, product)",
      "Choose dual export or single",
      "Review alignment and render",
    ],
    heroClipId: "ray2-reframe-fashion",
  },
  {
    id: "add-audio",
    slug: "add-audio",
    title: "Add Audio",
    summary: "Choose music or VO, align to beats, export instantly.",
    description:
      "Layer curated audio across renders, pull from our library or upload stems, and auto-trim to the loop length.",
    priceDisplay: "$0.30 per clip",
    steps: [
      "Select soundtrack from library",
      "Fine-tune beat alignment",
      "Adjust fade in/out",
      "Render and push to Wall",
    ],
  },
];
