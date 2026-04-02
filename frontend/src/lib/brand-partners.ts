import type { BrandAssetPolicy, EngineAvailability } from '@/types/engines';

export type PartnerBrandId =
  | 'runway'
  | 'luma'
  | 'google-veo'
  | 'pika'
  | 'kling'
  | 'openai'
  | 'minimax'
  | 'wan'
  | 'lightricks'
  | 'bytedance'
  | 'google';

type AssetFit = 'contain' | 'cover';

export type PartnerBrandAsset = {
  src: string;
  fit?: AssetFit;
  scale?: number;
};

export interface PartnerBrandAssetSet {
  light: PartnerBrandAsset;
  dark: PartnerBrandAsset;
}

export interface PartnerBrand {
  id: PartnerBrandId;
  label: string;
  shortText: string;
  policy: BrandAssetPolicy;
  defaultAvailability: EngineAvailability;
  availabilityLink?: string;
  compactMark: PartnerBrandAssetSet;
  wordmark?: PartnerBrandAssetSet;
  alt: {
    light: string;
    dark: string;
  };
  engineIds: string[];
}

type PartnerBrandIdentity = {
  brandId?: string | null;
  id?: string | null;
};

function allowLogos(linkToGuidelines?: string, usageNotes?: string): BrandAssetPolicy {
  return {
    logoAllowed: true,
    textOnly: false,
    linkToGuidelines,
    usageNotes,
  };
}

const PARTNER_BRANDS: PartnerBrand[] = [
  {
    id: 'runway',
    label: 'Runway',
    shortText: 'Runway',
    policy: allowLogos(
      'https://runwayml.com/brand',
      'Use the official compact Runway mark in neutral tiles without distortion.'
    ),
    defaultAvailability: 'available',
    compactMark: {
      light: { src: '/brand/partners/runway/runway-mark-light.png', scale: 0.72 },
      dark: { src: '/brand/partners/runway/runway-mark-dark.png', scale: 0.72 },
    },
    wordmark: {
      light: { src: '/brand/partners/runway/runway-logo-light.svg', scale: 0.9 },
      dark: { src: '/brand/partners/runway/runway-logo-dark.svg', scale: 0.9 },
    },
    alt: {
      light: 'Runway compact logo',
      dark: 'Runway compact logo (dark mode)',
    },
    engineIds: ['runwayg3', 'runway-gen-3', 'runway-gen3'],
  },
  {
    id: 'luma',
    label: 'Luma AI',
    shortText: 'Luma',
    policy: allowLogos(
      'https://lumalabs.ai/press',
      'Use the official Luma Labs mark with a dedicated inverse version for dark surfaces.'
    ),
    defaultAvailability: 'available',
    compactMark: {
      light: { src: '/brand/partners/luma/luma-mark-light.png', scale: 0.68 },
      dark: { src: '/brand/partners/luma/luma-mark-dark.png', scale: 0.68 },
    },
    wordmark: {
      light: { src: '/brand/partners/luma/luma-logo-light.svg', scale: 0.9 },
      dark: { src: '/brand/partners/luma/luma-logo-dark.svg', scale: 0.9 },
    },
    alt: {
      light: 'Luma AI compact logo',
      dark: 'Luma AI compact logo (dark mode)',
    },
    engineIds: [
      'luma-dm',
      'lumadm',
      'luma-dream-machine',
      'lumaRay2',
      'lumaRay2_flash',
      'lumaRay2_modify',
      'lumaRay2_reframe',
      'lumaRay2_flash_reframe',
    ],
  },
  {
    id: 'google-veo',
    label: 'Google Veo',
    shortText: 'Veo',
    policy: allowLogos(
      'https://about.google/brand-resource-center/',
      'Use the compact Google mark for Veo surfaces and keep the fuller wordmark for wide layouts.'
    ),
    defaultAvailability: 'waitlist',
    availabilityLink: 'https://ai.google/discover/veo/',
    compactMark: {
      light: { src: '/brand/partners/google/google-mark-light.svg', scale: 0.68 },
      dark: { src: '/brand/partners/google/google-mark-dark.svg', scale: 0.68 },
    },
    wordmark: {
      light: { src: '/brand/partners/google-veo/google-veo-logo-light.svg', scale: 0.9 },
      dark: { src: '/brand/partners/google-veo/google-veo-logo-dark.svg', scale: 0.9 },
    },
    alt: {
      light: 'Google Veo compact logo',
      dark: 'Google Veo compact logo (dark mode)',
    },
    engineIds: ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite'],
  },
  {
    id: 'pika',
    label: 'Pika Labs',
    shortText: 'Pika',
    policy: allowLogos('https://pika.art', 'Use the official Pika app icon in compact neutral tiles.'),
    defaultAvailability: 'available',
    compactMark: {
      light: { src: '/brand/partners/pika/pika-mark-light.png', scale: 0.74 },
      dark: { src: '/brand/partners/pika/pika-mark-dark.png', scale: 0.74 },
    },
    wordmark: {
      light: { src: '/brand/partners/pika/pika-logo-light.svg', scale: 0.9 },
      dark: { src: '/brand/partners/pika/pika-logo-dark.svg', scale: 0.9 },
    },
    alt: {
      light: 'Pika Labs compact logo',
      dark: 'Pika Labs compact logo (dark mode)',
    },
    engineIds: ['pika-text-to-video'],
  },
  {
    id: 'kling',
    label: 'Kling by Kuaishou',
    shortText: 'Kling',
    policy: allowLogos(
      'https://www.kuaishou.com/en',
      'Use the official Kling app icon for compact brand presentation.'
    ),
    defaultAvailability: 'limited',
    availabilityLink: 'https://www.kuaishou.com/en',
    compactMark: {
      light: { src: '/brand/partners/kling/kling-mark-light.png', scale: 0.74 },
      dark: { src: '/brand/partners/kling/kling-mark-dark.png', scale: 0.74 },
    },
    wordmark: {
      light: { src: '/brand/partners/kling/kling-logo-light.svg', scale: 0.9 },
      dark: { src: '/brand/partners/kling/kling-logo-dark.svg', scale: 0.9 },
    },
    alt: {
      light: 'Kling compact logo',
      dark: 'Kling compact logo (dark mode)',
    },
    engineIds: [
      'kling25',
      'kling-2-5',
      'kling25_turbo',
      'kling-2-5-turbo',
      'kling-2-6-pro',
      'kling-3-pro',
      'kling-3-standard',
      'kling3',
      'kling-3',
      'kling-v3-pro',
      'kling-3-std',
      'kling3-standard',
      'kling-v3-standard',
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    shortText: 'OpenAI',
    policy: allowLogos(
      'https://openai.com/policies/brand',
      'Use the compact OpenAI logomark in monochrome for engine badges.'
    ),
    defaultAvailability: 'available',
    compactMark: {
      light: { src: '/brand/partners/openai/openai-mark-light.svg', scale: 0.7 },
      dark: { src: '/brand/partners/openai/openai-mark-dark.svg', scale: 0.7 },
    },
    wordmark: {
      light: { src: '/brand/partners/openai/openai-wordmark-light.svg', scale: 0.9 },
      dark: { src: '/brand/partners/openai/openai-wordmark-dark.svg', scale: 0.9 },
    },
    alt: {
      light: 'OpenAI compact logo',
      dark: 'OpenAI compact logo (dark mode)',
    },
    engineIds: ['sora-2', 'sora2', 'sora-2-pro', 'sora2pro'],
  },
  {
    id: 'wan',
    label: 'Wan',
    shortText: 'Wan',
    policy: allowLogos('https://www.wan-ai.com', 'Use the Wan app icon as the compact family mark.'),
    defaultAvailability: 'limited',
    compactMark: {
      light: { src: '/brand/partners/wan/wan-mark-light.png', scale: 0.72 },
      dark: { src: '/brand/partners/wan/wan-mark-dark.png', scale: 0.72 },
    },
    wordmark: {
      light: { src: '/brand/partners/wan/wan-wordmark-light.svg', scale: 0.9 },
      dark: { src: '/brand/partners/wan/wan-wordmark-dark.svg', scale: 0.9 },
    },
    alt: {
      light: 'Wan compact logo',
      dark: 'Wan compact logo (dark mode)',
    },
    engineIds: ['wan-2-5', 'wan-2-6', 'wan25', 'wan26', 'wan-25-preview', 'wan-25', 'wan-26'],
  },
  {
    id: 'lightricks',
    label: 'Lightricks',
    shortText: 'LTX',
    policy: allowLogos(
      'https://www.lightricks.com',
      'Use the official LTX favicon-style mark for compact branding across the LTX family.'
    ),
    defaultAvailability: 'available',
    compactMark: {
      light: { src: '/brand/partners/lightricks/lightricks-mark-light.png', scale: 0.76 },
      dark: { src: '/brand/partners/lightricks/lightricks-mark-dark.png', scale: 0.76 },
    },
    alt: {
      light: 'Lightricks compact logo',
      dark: 'Lightricks compact logo (dark mode)',
    },
    engineIds: [
      'ltx-2-3',
      'ltx-2-3-pro',
      'ltx-2-3-fast',
      'ltx-2',
      'ltx-2-fast',
      'fal-ai/ltx-2.3/text-to-video',
      'fal-ai/ltx-2.3/text-to-video/fast',
      'fal-ai/ltx-2/text-to-video',
      'fal-ai/ltx-2/text-to-video/fast',
    ],
  },
  {
    id: 'bytedance',
    label: 'ByteDance',
    shortText: 'Seedance',
    policy: allowLogos(
      'https://seed.bytedance.com/',
      'Use the ByteDance compact mark for Seedance family surfaces.'
    ),
    defaultAvailability: 'available',
    compactMark: {
      light: { src: '/brand/partners/bytedance/bytedance-mark-light.svg', scale: 0.7 },
      dark: { src: '/brand/partners/bytedance/bytedance-mark-dark.svg', scale: 0.7 },
    },
    alt: {
      light: 'ByteDance compact logo',
      dark: 'ByteDance compact logo (dark mode)',
    },
    engineIds: [
      'seedance-1-5-pro',
      'seedance-2-0',
      'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
      'fal-ai/seedance-2.0/text-to-video',
    ],
  },
  {
    id: 'google',
    label: 'Google',
    shortText: 'Google',
    policy: allowLogos(
      'https://about.google/brand-resource-center/',
      'Use the compact Google mark for image families powered by Google.'
    ),
    defaultAvailability: 'available',
    compactMark: {
      light: { src: '/brand/partners/google/google-mark-light.svg', scale: 0.68 },
      dark: { src: '/brand/partners/google/google-mark-dark.svg', scale: 0.68 },
    },
    alt: {
      light: 'Google compact logo',
      dark: 'Google compact logo (dark mode)',
    },
    engineIds: [
      'nano-banana',
      'nano-banana-pro',
      'nano-banana-2',
      'fal-ai/nano-banana',
      'fal-ai/nano-banana-pro',
      'fal-ai/nano-banana-2',
    ],
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    shortText: 'MiniMax',
    policy: allowLogos(
      'https://www.minimaxi.com',
      'Use the MiniMax compact logomark for Hailuo family badges.'
    ),
    defaultAvailability: 'available',
    compactMark: {
      light: { src: '/brand/partners/minimax/minimax-mark-light.svg', scale: 0.7 },
      dark: { src: '/brand/partners/minimax/minimax-mark-dark.svg', scale: 0.7 },
    },
    alt: {
      light: 'MiniMax compact logo',
      dark: 'MiniMax compact logo (dark mode)',
    },
    engineIds: [
      'minimax-hailuo-02-text',
      'fal-ai/minimax/hailuo-02/standard/text-to-video',
    ],
  },
];

export const PARTNER_BRAND_MAP: Map<string, PartnerBrand> = new Map(
  PARTNER_BRANDS.map((brand) => [brand.id, brand] as [string, PartnerBrand])
);

export const ENGINE_BRAND_LOOKUP: Map<string, PartnerBrandId> = new Map(
  PARTNER_BRANDS.flatMap((brand) =>
    brand.engineIds.map((engineId) => [engineId.toLowerCase(), brand.id] as const)
  )
);

export function getPartnerByBrandId(brandId: string | null | undefined): PartnerBrand | undefined {
  if (!brandId) return undefined;
  return PARTNER_BRAND_MAP.get(brandId.toLowerCase());
}

export function getPartnerByEngineId(engineId: string | null | undefined): PartnerBrand | undefined {
  if (!engineId) return undefined;
  const brandId = ENGINE_BRAND_LOOKUP.get(engineId.toLowerCase());
  if (!brandId) return undefined;
  return PARTNER_BRAND_MAP.get(brandId);
}

export function resolvePartnerBrand(identity: PartnerBrandIdentity): PartnerBrand | undefined {
  return getPartnerByBrandId(identity.brandId) ?? getPartnerByEngineId(identity.id);
}

export function getPartnerBrandMark(identity: PartnerBrandIdentity): PartnerBrandAssetSet | undefined {
  return resolvePartnerBrand(identity)?.compactMark;
}
