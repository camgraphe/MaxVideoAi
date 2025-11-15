import type { BrandAssetPolicy, EngineAvailability } from '@/types/engines';

export type PartnerBrandId = 'runway' | 'luma' | 'google-veo' | 'pika' | 'kling' | 'openai' | 'minimax';

type PartnerBrandAsset = {
  svg: string;
  png: string;
};

export interface PartnerBrand {
  id: PartnerBrandId;
  label: string;
  shortText: string;
  policy: BrandAssetPolicy;
  defaultAvailability: EngineAvailability;
  availabilityLink?: string;
  assets: {
    light: PartnerBrandAsset;
    dark: PartnerBrandAsset;
  };
  alt: {
    light: string;
    dark: string;
  };
  engineIds: string[];
}

const RUNWAY_POLICY: BrandAssetPolicy = {
  logoAllowed: true,
  textOnly: false,
  linkToGuidelines: 'https://runwayml.com/brand',
  usageNotes: 'Preserve clear space and approved colors; do not alter the Runway wordmark.',
};

const LUMA_POLICY: BrandAssetPolicy = {
  logoAllowed: true,
  textOnly: false,
  linkToGuidelines: 'https://lumalabs.ai/press',
  usageNotes: 'Use on neutral backgrounds without distortion; maintain safe padding.',
};

const GOOGLE_VEO_POLICY: BrandAssetPolicy = {
  logoAllowed: false,
  textOnly: true,
  linkToGuidelines: 'https://about.google/brand-resource-center/',
  usageNotes: 'Use the “Works with Google Veo” text lockup in Inter SemiBold (#202124).',
};

const PIKA_POLICY: BrandAssetPolicy = {
  logoAllowed: false,
  textOnly: true,
  linkToGuidelines: 'https://pika.art',
  usageNotes: 'Display “Pika Labs” text treatment until an official license is granted.',
};

const KLING_POLICY: BrandAssetPolicy = {
  logoAllowed: false,
  textOnly: true,
  linkToGuidelines: 'https://www.kuaishou.com/en',
  usageNotes: 'Default to “Kling by Kuaishou” text unless corporate approval authorises the logo.',
};

const OPENAI_POLICY: BrandAssetPolicy = {
  logoAllowed: false,
  textOnly: true,
  linkToGuidelines: 'https://openai.com/policies/brand',
  usageNotes: 'Use the “OpenAI — Sora 2” textual lockup until explicit logo rights are granted.',
};

export const PARTNER_BRANDS: PartnerBrand[] = [
  {
    id: 'runway',
    label: 'Runway',
    shortText: 'Runway',
    policy: RUNWAY_POLICY,
    defaultAvailability: 'available',
    assets: {
      light: {
        svg: '/brand/partners/runway/runway-logo-light.svg',
        png: '/brand/partners/runway/runway-logo-light.png',
      },
      dark: {
        svg: '/brand/partners/runway/runway-logo-dark.svg',
        png: '/brand/partners/runway/runway-logo-dark.png',
      },
    },
    alt: {
      light: 'Runway logo',
      dark: 'Runway logo (inverse)',
    },
    engineIds: ['runwayg3', 'runway-gen-3', 'runway-gen3'],
  },
  {
    id: 'luma',
    label: 'Luma AI',
    shortText: 'Luma AI',
    policy: LUMA_POLICY,
    defaultAvailability: 'available',
    assets: {
      light: {
        svg: '/brand/partners/luma/luma-logo-light.svg',
        png: '/brand/partners/luma/luma-logo-light.png',
      },
      dark: {
        svg: '/brand/partners/luma/luma-logo-dark.svg',
        png: '/brand/partners/luma/luma-logo-dark.png',
      },
    },
    alt: {
      light: 'Luma AI wordmark',
      dark: 'Luma AI wordmark (inverse)',
    },
    engineIds: ['luma-dm', 'lumadm', 'luma-dream-machine', 'lumaRay2', 'lumaRay2_flash', 'lumaRay2_modify', 'lumaRay2_reframe', 'lumaRay2_flash_reframe'],
  },
  {
    id: 'google-veo',
    label: 'Google Veo',
    shortText: 'Google Veo',
    policy: GOOGLE_VEO_POLICY,
    defaultAvailability: 'waitlist',
    availabilityLink: 'https://ai.google/discover/veo/',
    assets: {
      light: {
        svg: '/brand/partners/google-veo/google-veo-logo-light.svg',
        png: '/brand/partners/google-veo/google-veo-logo-light.png',
      },
      dark: {
        svg: '/brand/partners/google-veo/google-veo-logo-dark.svg',
        png: '/brand/partners/google-veo/google-veo-logo-dark.png',
      },
    },
    alt: {
      light: 'Google Veo wordmark',
      dark: 'Google Veo wordmark (inverse)',
    },
    engineIds: ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-first-last'],
  },
  {
    id: 'pika',
    label: 'Pika Labs',
    shortText: 'Pika Labs',
    policy: PIKA_POLICY,
    defaultAvailability: 'available',
    assets: {
      light: {
        svg: '/brand/partners/pika/pika-logo-light.svg',
        png: '/brand/partners/pika/pika-logo-light.png',
      },
      dark: {
        svg: '/brand/partners/pika/pika-logo-dark.svg',
        png: '/brand/partners/pika/pika-logo-dark.png',
      },
    },
    alt: {
      light: 'Pika Labs wordmark',
      dark: 'Pika Labs wordmark (inverse)',
    },
    engineIds: ['pika-text-to-video'],
  },
  {
    id: 'kling',
    label: 'Kling by Kuaishou',
    shortText: 'Kling by Kuaishou',
    policy: KLING_POLICY,
    defaultAvailability: 'limited',
    availabilityLink: 'https://www.kuaishou.com/en',
    assets: {
      light: {
        svg: '/brand/partners/kling/kling-logo-light.svg',
        png: '/brand/partners/kling/kling-logo-light.png',
      },
      dark: {
        svg: '/brand/partners/kling/kling-logo-dark.svg',
        png: '/brand/partners/kling/kling-logo-dark.png',
      },
    },
    alt: {
      light: 'Kling by Kuaishou wordmark',
      dark: 'Kling by Kuaishou wordmark (inverse)',
    },
    engineIds: ['kling25', 'kling-2-5', 'kling25_turbo'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    shortText: 'OpenAI',
    policy: OPENAI_POLICY,
    defaultAvailability: 'available',
    assets: {
      light: {
        svg: '/brand/partners/openai/openai-wordmark-light.svg',
        png: '/brand/partners/openai/openai-wordmark-light.svg',
      },
      dark: {
        svg: '/brand/partners/openai/openai-wordmark-dark.svg',
        png: '/brand/partners/openai/openai-wordmark-dark.svg',
      },
    },
    alt: {
      light: 'OpenAI wordmark',
      dark: 'OpenAI wordmark (inverse)',
    },
    engineIds: ['sora-2', 'sora2', 'sora-2-pro', 'sora2pro'],
  },
];

export const PARTNER_BRAND_MAP: Map<string, PartnerBrand> = new Map(
  PARTNER_BRANDS.map((brand) => [brand.id, brand] as [string, PartnerBrand])
);

export const ENGINE_BRAND_LOOKUP: Map<string, PartnerBrandId> = new Map(
  PARTNER_BRANDS.flatMap((brand) => brand.engineIds.map((engineId) => [engineId.toLowerCase(), brand.id] as const))
);

export function getPartnerByEngineId(engineId: string | null | undefined): PartnerBrand | undefined {
  if (!engineId) return undefined;
  const brandId = ENGINE_BRAND_LOOKUP.get(engineId.toLowerCase());
  if (!brandId) return undefined;
  return PARTNER_BRAND_MAP.get(brandId);
}
