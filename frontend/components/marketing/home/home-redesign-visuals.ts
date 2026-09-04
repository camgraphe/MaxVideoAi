import {
  BadgeCheck,
  BadgeDollarSign,
  Atom,
  AudioWaveform,
  BarChart3,
  Box,
  Clapperboard,
  Film,
  ImageIcon,
  Images,
  Layers3,
  Mic2,
  RefreshCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  SplitSquareHorizontal,
  Type,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { ToolIconKey } from '@/components/marketing/home/home-redesign-types';

export const TOOL_ICONS: Record<ToolIconKey, LucideIcon> = {
  text: Film,
  image: Images,
  video: Clapperboard,
  generateImage: Sparkles,
  character: Layers3,
  angle: RotateCw,
  extend: SplitSquareHorizontal,
  retake: RefreshCcw,
  audio: Mic2,
  compare: SlidersHorizontal,
};

export const TOOLBOX_VISUALS: Record<string, string> = {
  'text-to-video':
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a89d8b58-3c6b-4de6-bf1d-88982b2a33da.jpg',
  'image-to-video':
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/b527318e-2b66-4da2-8ac3-e82155c9806b.jpg',
  'video-to-video':
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/84413a86-180e-4b46-81f8-0459fb0e905f.jpg',
  'generate-image':
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/3bfdfcb2-3c20-4b84-9fd5-e3645810d45a.jpg',
  'character-builder':
    'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/d9851ed8-4db8-4f0c-a547-39d972bd9b64.webp',
  'angle-tool':
    'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/c82407ca-701a-447a-878f-491338658cd0.webp',
  upscale:
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/06c83b77-46aa-4aff-b687-dbeeb6bcbf22.jpg',
  'compare-engines':
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/de3b13d9-e5b0-4c09-993e-89039642f9fa.jpg',
};

export const REFERENCE_WORKFLOW_VISUALS = [
  '/assets/marketing/reference-workflow-source-image.webp',
  '/assets/marketing/reference-workflow-character-consistency.webp',
  '/assets/marketing/reference-workflow-angle-composition.webp',
  '/assets/marketing/reference-workflow-final-video.webp',
] as const;

export const HERO_VIDEO_ORDER = ['minimax-h3-max', 'seedance-2-5', 'wan-3-prime', 'kling-3-pro', 'ltx-2-5-pro'] as const;
export const HOME_HERO_IMAGE_URL = '/assets/home/home-hero-reference.webp';

export const HERO_VIDEO_MODE_LABELS: Record<string, string> = {
  'minimax-h3-max': 'text-to-video',
  'seedance-2-5': 'text-to-video',
  'wan-3-prime': 'text-to-video',
  'kling-3-pro': 'image-to-video',
  'ltx-2-5-pro': 'image-to-video',
};

export const HERO_VIDEO_CHIPS: Record<string, string[]> = {
  'minimax-h3-max': ['Dance', 'Cinematic motion'],
  'seedance-2-5': ['Physics', 'Cinematic'],
  'wan-3-prime': ['Craft motion', 'Realism'],
  'kling-3-pro': ['Cinematic', 'Camera move'],
  'ltx-2-5-pro': ['Fast', 'Image control'],
};

export const PROOF_ICONS: Record<string, LucideIcon> = {
  engines: Atom,
  providers: Box,
  textToVideo: Type,
  imageToVideo: ImageIcon,
  videoToVideo: Video,
  audio: AudioWaveform,
  fourK: BadgeCheck,
  successfulGenerations: BarChart3,
};

export const KLING_3_PRO_HERO_RENDER = {
  posterSrc:
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/01245e62-6bb2-4d5d-89c6-c60923a004ad.jpg',
  videoSrc:
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/7b1f1c7b-f7f0-473e-9610-82723604b690.mp4',
  resolution: '16:9',
  duration: '0:12',
  estimateValue: '$2.63',
  estimateMeta: '12s generation',
} as const;

export const HERO_ENGINE_MEDIA: Record<
  string,
  {
    posterSrc: string;
    videoSrc?: string;
    chips?: string[];
    resolution: string;
    duration: string;
    estimateValue?: string;
    estimateMeta?: string;
    price?: string;
    imageAlt?: string;
  }
> = {
  'minimax-h3-max': {
    posterSrc: '/hero/showcase-minimax-h3-max-8s.webp',
    videoSrc:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/1b29e9b2-c68d-46a3-8415-7677deed674a.mp4',
    resolution: '16:9',
    duration: '0:08',
    estimateValue: '$0.80',
    estimateMeta: '8s generation',
    imageAlt: 'MiniMax H3 Max cinematic dancer scene generated with MaxVideoAI.',
  },
  'seedance-2-5': {
    posterSrc:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/322680c4-ca2f-405f-89f6-0bdb90f186b9.jpg',
    videoSrc:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/085cc0a7-063d-4801-91f9-ec3d9c5eb95d.mp4',
    resolution: '16:9',
    duration: '0:10',
    estimateValue: '$1.46',
    estimateMeta: '10s generation',
  },
  'wan-3-prime': {
    posterSrc:
      'https://media.maxvideoai.com/user-asset-thumbs/by-content/c780259ed79d025b4ac74ccc513f18bf/db3ef505b123301c648d118f0d740df7b05d098ec47b5104f0425f42019c069f.jpeg',
    videoSrc:
      'https://media.maxvideoai.com/media-assets/by-content/c780259ed79d025b4ac74ccc513f18bf/c8567e3b0531ae10a993534c41d5f76ec8a1fc2329294d0c8fdb7e4b38ab349a.mp4',
    resolution: '16:9',
    duration: '0:05',
    estimateValue: '$0.70',
    estimateMeta: '5s generation',
  },
  'kling-3-pro': {
    ...KLING_3_PRO_HERO_RENDER,
  },
  'ltx-2-5-pro': {
    posterSrc:
      'https://media.maxvideoai.com/user-asset-thumbs/by-content/c780259ed79d025b4ac74ccc513f18bf/eca62625821feb6bd76c6e023a43988bc8ea18508c783bc6adf4973f172b8d75.jpeg',
    videoSrc:
      'https://media.maxvideoai.com/media-assets/by-content/c780259ed79d025b4ac74ccc513f18bf/2506829a4f4f3d7e5d2bd864a701fc6cc2fb7c53182f7a7f5ca10cc580c70aa8.mp4',
    resolution: '16:9',
    duration: '0:06',
    estimateValue: '$0.72',
    estimateMeta: '6s generation',
  },
  'seedance-2-0': {
    posterSrc: '/hero/showcase-seedance-2-0-business-workflow.webp',
    videoSrc:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/9d6811c9-226c-44bd-8b56-b3aa74039d59.mp4',
    resolution: '16:9',
    duration: '0:05',
  },
  'veo-3-1': {
    posterSrc: '/hero/showcase-veo-3-1.webp',
    resolution: '16:9',
    duration: '0:05',
  },
  'veo-3-1-lite': {
    posterSrc:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/8729a3ad-aa8e-470d-85e5-558a5f897893.jpg',
    videoSrc:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/4e4954fc-513a-4345-945c-41adba7ec26a.mp4',
    chips: ['Cinematic', 'Audio'],
    resolution: '16:9',
    duration: '0:08',
    estimateValue: '$0.52',
    estimateMeta: '8s generation',
    imageAlt: 'Veo 3.1 Lite romantic train-station reunion generated with MaxVideoAI.',
  },
  'ltx-2-3-pro': {
    posterSrc:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/983f1a91-97d7-40bf-b857-3c5fdbfa6162.jpg',
    videoSrc: 'https://media.maxvideoai.com/renders/marketing/4334436e-af77-48ff-a9df-fd6bf7f140db.mp4',
    resolution: '16:9',
    duration: '0:10',
    estimateValue: '$0.78',
    estimateMeta: '10s generation',
  },
  'happy-horse-1-1': {
    posterSrc:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a3182fc5-e993-4a3b-9b5a-805997bd3e68.jpg',
    videoSrc: 'https://media.maxvideoai.com/renders/marketing/f808f22b-c463-421f-b5dc-ec6c898ece40.mp4',
    resolution: '16:9',
    duration: '0:10',
    estimateValue: '$1.82',
    estimateMeta: '10s generation',
    price: '$0.18/sec',
  },
  'sora-2': {
    posterSrc: '/hero/showcase-sora-2.webp',
    resolution: '16:9',
    duration: '0:05',
  },
};

export const BEST_FOR_CARD_VISUALS: Record<string, { imageSrc: string; icon: LucideIcon }> = {
  'cinematic-realism': { imageSrc: '/hero/best-for-cinematic-realism.webp', icon: Clapperboard },
  'image-to-video': { imageSrc: '/hero/best-for-image-to-video.webp', icon: ImageIcon },
  'fast-drafts': { imageSrc: '/hero/best-for-fast-drafts-city.webp', icon: Sparkles },
  ads: { imageSrc: '/hero/best-for-product-ads.webp', icon: BadgeDollarSign },
};

export const COMPARISON_CARD_MEDIA: Record<string, { imageSrc: string; imageAlt: string }> = {
  'seedance-upgrade': {
    imageSrc: '/hero/best-for-cinematic-realism.webp',
    imageAlt: 'Cinematic AI video comparison preview for Seedance models.',
  },
  'ltx-legacy-fast': {
    imageSrc: '/hero/best-for-fast-drafts-city.webp',
    imageAlt: 'Fast draft AI video comparison preview for LTX models.',
  },
  'ltx-seedance': {
    imageSrc: '/hero/showcase-seedance-2-0-business-workflow.webp',
    imageAlt: 'AI video comparison preview between LTX and Seedance.',
  },
  'ltx-veo': {
    imageSrc: '/hero/best-for-image-to-video.webp',
    imageAlt: 'AI video comparison preview between LTX and Veo.',
  },
  'kling-ltx': {
    imageSrc: '/hero/showcase-kling-3-pro.webp',
    imageAlt: 'Camera motion AI video comparison preview between Kling and LTX.',
  },
  'sora-standard-pro': {
    imageSrc: '/hero/showcase-sora-2.webp',
    imageAlt: 'AI video comparison preview for Sora models.',
  },
};
