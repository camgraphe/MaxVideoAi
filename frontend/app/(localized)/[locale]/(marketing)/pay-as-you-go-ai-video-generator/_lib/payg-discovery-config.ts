import type { PaygExampleCostId, PaygPriceLookupId, PaygSupportedModelId } from '../_content/types';
import type { VideoPricePresetId } from '../../pricing/_lib/pricingHubData';

export type PaygDiscoveryConfigs = {
  priceLookups: readonly { id: PaygPriceLookupId; presetId: VideoPricePresetId }[];
  examples: readonly { id: PaygExampleCostId; presetId: VideoPricePresetId }[];
  supportedModels: readonly { id: PaygSupportedModelId; fallbackHref?: string; fallbackLabel: string }[];
};

const PRICE_LOOKUP_CONFIGS = [
  { id: 'gemini-omni-flash', presetId: '5s-720p' },
  { id: 'kling-3-turbo-pro', presetId: '8s-1080p' },
  { id: 'kling-3-turbo-standard', presetId: '5s-720p' },
  { id: 'minimax-h3-max', presetId: 'entry-route' },
  { id: 'ltx-2-5-pro', presetId: '5s-720p' },
  { id: 'ltx-2-5-fast', presetId: '5s-720p' },
  { id: 'wan-3-prime', presetId: '5s-720p' },
  { id: 'wan-3', presetId: '5s-720p' },
  { id: 'grok-imagine-video-1-5', presetId: '5s-720p' },
  { id: 'flux-3', presetId: '5s-720p' },
  { id: 'flux-3-draft', presetId: '5s-720p' },
  { id: 'seedance-2-0', presetId: '5s-720p' },
  { id: 'kling-3-pro', presetId: '8s-1080p' },
  { id: 'veo-3-1', presetId: '8s-1080p' },
  { id: 'happy-horse-1-1', presetId: '5s-720p' },
  { id: 'seedance-2-0-mini', presetId: '5s-720p' },
  { id: 'ltx-2-3-fast', presetId: '8s-1080p' },
] as const satisfies PaygDiscoveryConfigs['priceLookups'];

const PREFERRED_EXAMPLES = [
  { id: 'gemini-omni-flash', presetId: '5s-720p' },
  { id: 'kling-3-turbo-pro', presetId: '8s-1080p' },
  { id: 'kling-3-turbo-standard', presetId: '5s-720p' },
  { id: 'minimax-h3-max', presetId: 'entry-route' },
  { id: 'ltx-2-5-pro', presetId: '5s-720p' },
  { id: 'wan-3-prime', presetId: '5s-720p' },
  { id: 'grok-imagine-video-1-5', presetId: '5s-720p' },
  { id: 'flux-3', presetId: '5s-720p' },
  { id: 'seedance-2-0', presetId: '5s-720p' },
  { id: 'kling-3-pro', presetId: '8s-1080p' },
  { id: 'veo-3-1-fast', presetId: '8s-1080p' },
  { id: 'happy-horse-1-1', presetId: '5s-720p' },
  { id: 'seedance-2-0-mini', presetId: '5s-720p' },
  { id: 'ltx-2-3-fast', presetId: '8s-1080p' },
] as const satisfies PaygDiscoveryConfigs['examples'];

const SUPPORTED_MODEL_CONFIGS = [
  { id: 'gemini-omni-flash', fallbackHref: '/models/gemini-omni-flash', fallbackLabel: 'Gemini Omni Flash 1.1' },
  { id: 'kling-3-turbo-pro', fallbackLabel: 'Kling 3.0 Turbo Pro' },
  { id: 'kling-3-turbo-standard', fallbackLabel: 'Kling 3.0 Turbo Standard' },
  { id: 'minimax-h3-max', fallbackLabel: 'MiniMax H3 Max' },
  { id: 'seedance-2-5', fallbackHref: '/models/seedance-2-5', fallbackLabel: 'Seedance 2.5' },
  { id: 'seedance-2-0', fallbackHref: '/models/seedance-2-0', fallbackLabel: 'Seedance 2.0' },
  { id: 'kling-3-pro', fallbackHref: '/models/kling-3-pro', fallbackLabel: 'Kling' },
  { id: 'veo-3-1', fallbackHref: '/models/veo-3-1', fallbackLabel: 'Google Veo' },
  { id: 'happy-horse-1-1', fallbackHref: '/models/happy-horse-1-1', fallbackLabel: 'Happy Horse 1.1' },
  { id: 'seedance-2-0-mini', fallbackHref: '/models/dreamina-seedance-2-0-mini', fallbackLabel: 'Seedance 2.0 Mini' },
  { id: 'ltx-2-5-pro', fallbackLabel: 'LTX 2.5 Pro' },
  { id: 'ltx-2-5-fast', fallbackLabel: 'LTX 2.5 Fast' },
  { id: 'wan-3-prime', fallbackLabel: 'Wan 3 Prime' },
  { id: 'wan-3', fallbackLabel: 'Wan 3' },
  { id: 'grok-imagine-video-1-5', fallbackLabel: 'Grok Imagine Video 1.5' },
  { id: 'flux-3', fallbackLabel: 'FLUX.3 Video' },
  { id: 'flux-3-draft', fallbackLabel: 'FLUX.3 Video Draft' },
  { id: 'ltx-2-3-fast', fallbackHref: '/models/ltx-2-3-fast', fallbackLabel: 'LTX' },
  { id: 'wan-2-6', fallbackHref: '/models/wan-2-6', fallbackLabel: 'Wan' },
] as const satisfies PaygDiscoveryConfigs['supportedModels'];

export const DEFAULT_PAYG_DISCOVERY_CONFIGS: PaygDiscoveryConfigs = {
  priceLookups: PRICE_LOOKUP_CONFIGS,
  examples: PREFERRED_EXAMPLES,
  supportedModels: SUPPORTED_MODEL_CONFIGS,
};
