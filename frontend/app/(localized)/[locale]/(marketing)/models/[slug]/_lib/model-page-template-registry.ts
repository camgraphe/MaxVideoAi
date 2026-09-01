import type { ModelPageTemplateConfig } from './model-page-template-types';
import { geminiOmniFlashTemplateConfig } from './model-page-templates/gemini-omni-flash';
import { gptImage2TemplateConfig } from './model-page-templates/gpt-image-2';
import { grokImagineVideo15TemplateConfig } from './model-page-templates/grok-imagine-video-1-5';
import { happyHorse10TemplateConfig } from './model-page-templates/happy-horse-1-0';
import { happyHorse11TemplateConfig } from './model-page-templates/happy-horse-1-1';
import { kling25TurboTemplateConfig } from './model-page-templates/kling-2-5-turbo';
import { kling26ProTemplateConfig } from './model-page-templates/kling-2-6-pro';
import { kling34kTemplateConfig } from './model-page-templates/kling-3-4k';
import { kling3ProTemplateConfig } from './model-page-templates/kling-3-pro';
import { kling3StandardTemplateConfig } from './model-page-templates/kling-3-standard';
import { klingO34kTemplateConfig } from './model-page-templates/kling-o3-4k';
import { klingO3ProTemplateConfig } from './model-page-templates/kling-o3-pro';
import { klingO3StandardTemplateConfig } from './model-page-templates/kling-o3-standard';
import { lumaRay2TemplateConfig } from './model-page-templates/luma-ray-2';
import { lumaRay2FlashTemplateConfig } from './model-page-templates/luma-ray-2-flash';
import { lumaRay32TemplateConfig } from './model-page-templates/luma-ray-3-2';
import { lumaUni1TemplateConfig } from './model-page-templates/luma-uni-1';
import { lumaUni1MaxTemplateConfig } from './model-page-templates/luma-uni-1-max';
import { ltx23ProTemplateConfig } from './model-page-templates/ltx-2-3-pro';
import { ltx23FastTemplateConfig } from './model-page-templates/ltx-2-3-fast';
import { ltx2TemplateConfig } from './model-page-templates/ltx-2';
import { ltx2FastTemplateConfig } from './model-page-templates/ltx-2-fast';
import { ltx25FastTemplateConfig } from './model-page-templates/ltx-2-5-fast';
import { ltx25ProTemplateConfig } from './model-page-templates/ltx-2-5-pro';
import { minimaxHailuo02TemplateConfig } from './model-page-templates/minimax-hailuo-02-text';
import { minimaxH3TemplateConfig } from './model-page-templates/minimax-h3';
import { nanoBanana2TemplateConfig } from './model-page-templates/nano-banana-2';
import { nanoBananaLiteTemplateConfig } from './model-page-templates/nano-banana-lite';
import { nanoBananaProTemplateConfig } from './model-page-templates/nano-banana-pro';
import { nanoBananaTemplateConfig } from './model-page-templates/nano-banana';
import { pikaTextToVideoTemplateConfig } from './model-page-templates/pika-text-to-video';
import { flux3TemplateConfig } from './model-page-templates/flux-3';
import { flux3DraftTemplateConfig } from './model-page-templates/flux-3-draft';
import { seedance15ProTemplateConfig } from './model-page-templates/seedance-1-5-pro';
import { seedance20TemplateConfig } from './model-page-templates/seedance-2-0';
import { seedance20FastTemplateConfig } from './model-page-templates/seedance-2-0-fast';
import { seedance20MiniTemplateConfig } from './model-page-templates/seedance-2-0-mini';
import { seedance25TemplateConfig } from './model-page-templates/seedance-2-5';
import { seedream50ProTemplateConfig } from './model-page-templates/seedream-5-0-pro';
import { seedreamTemplateConfig } from './model-page-templates/seedream';
import { sora2ProTemplateConfig } from './model-page-templates/sora-2-pro';
import { sora2TemplateConfig } from './model-page-templates/sora-2';
import { veo31FastTemplateConfig } from './model-page-templates/veo-3-1-fast';
import { veo31TemplateConfig } from './model-page-templates/veo-3-1';
import { veo31LiteTemplateConfig } from './model-page-templates/veo-3-1-lite';
import { wan25TemplateConfig } from './model-page-templates/wan-2-5';
import { wan26TemplateConfig } from './model-page-templates/wan-2-6';
import { wan3TemplateConfig } from './model-page-templates/wan-3';
import { wan3PrimeTemplateConfig } from './model-page-templates/wan-3-prime';

const MODEL_PAGE_TEMPLATE_REGISTRY: Record<string, ModelPageTemplateConfig> = {
  [geminiOmniFlashTemplateConfig.slug]: geminiOmniFlashTemplateConfig,
  [gptImage2TemplateConfig.slug]: gptImage2TemplateConfig,
  [grokImagineVideo15TemplateConfig.slug]: grokImagineVideo15TemplateConfig,
  [happyHorse10TemplateConfig.slug]: happyHorse10TemplateConfig,
  [happyHorse11TemplateConfig.slug]: happyHorse11TemplateConfig,
  [kling25TurboTemplateConfig.slug]: kling25TurboTemplateConfig,
  [kling26ProTemplateConfig.slug]: kling26ProTemplateConfig,
  [kling34kTemplateConfig.slug]: kling34kTemplateConfig,
  [kling3ProTemplateConfig.slug]: kling3ProTemplateConfig,
  [kling3StandardTemplateConfig.slug]: kling3StandardTemplateConfig,
  [klingO34kTemplateConfig.slug]: klingO34kTemplateConfig,
  [klingO3ProTemplateConfig.slug]: klingO3ProTemplateConfig,
  [klingO3StandardTemplateConfig.slug]: klingO3StandardTemplateConfig,
  [lumaRay2TemplateConfig.slug]: lumaRay2TemplateConfig,
  [lumaRay2FlashTemplateConfig.slug]: lumaRay2FlashTemplateConfig,
  [lumaRay32TemplateConfig.slug]: lumaRay32TemplateConfig,
  [lumaUni1TemplateConfig.slug]: lumaUni1TemplateConfig,
  [lumaUni1MaxTemplateConfig.slug]: lumaUni1MaxTemplateConfig,
  [ltx2FastTemplateConfig.slug]: ltx2FastTemplateConfig,
  [ltx2TemplateConfig.slug]: ltx2TemplateConfig,
  [ltx23FastTemplateConfig.slug]: ltx23FastTemplateConfig,
  [ltx23ProTemplateConfig.slug]: ltx23ProTemplateConfig,
  [ltx25FastTemplateConfig.slug]: ltx25FastTemplateConfig,
  [ltx25ProTemplateConfig.slug]: ltx25ProTemplateConfig,
  [minimaxHailuo02TemplateConfig.slug]: minimaxHailuo02TemplateConfig,
  [minimaxH3TemplateConfig.slug]: minimaxH3TemplateConfig,
  [nanoBananaTemplateConfig.slug]: nanoBananaTemplateConfig,
  [nanoBananaLiteTemplateConfig.slug]: nanoBananaLiteTemplateConfig,
  [nanoBanana2TemplateConfig.slug]: nanoBanana2TemplateConfig,
  [nanoBananaProTemplateConfig.slug]: nanoBananaProTemplateConfig,
  [pikaTextToVideoTemplateConfig.slug]: pikaTextToVideoTemplateConfig,
  [flux3TemplateConfig.slug]: flux3TemplateConfig,
  [flux3DraftTemplateConfig.slug]: flux3DraftTemplateConfig,
  [seedance15ProTemplateConfig.slug]: seedance15ProTemplateConfig,
  [seedance20TemplateConfig.slug]: seedance20TemplateConfig,
  [seedance20FastTemplateConfig.slug]: seedance20FastTemplateConfig,
  [seedance20MiniTemplateConfig.slug]: seedance20MiniTemplateConfig,
  [seedance25TemplateConfig.slug]: seedance25TemplateConfig,
  [seedream50ProTemplateConfig.slug]: seedream50ProTemplateConfig,
  [seedreamTemplateConfig.slug]: seedreamTemplateConfig,
  [sora2TemplateConfig.slug]: sora2TemplateConfig,
  [sora2ProTemplateConfig.slug]: sora2ProTemplateConfig,
  [veo31FastTemplateConfig.slug]: veo31FastTemplateConfig,
  [veo31TemplateConfig.slug]: veo31TemplateConfig,
  [veo31LiteTemplateConfig.slug]: veo31LiteTemplateConfig,
  [wan25TemplateConfig.slug]: wan25TemplateConfig,
  [wan26TemplateConfig.slug]: wan26TemplateConfig,
  [wan3TemplateConfig.slug]: wan3TemplateConfig,
  [wan3PrimeTemplateConfig.slug]: wan3PrimeTemplateConfig,
};

export function getModelPageTemplateConfig(slug: string): ModelPageTemplateConfig | null {
  return MODEL_PAGE_TEMPLATE_REGISTRY[slug] ?? null;
}

export function isPrelaunchModelPageTemplateSlug(slug: string): boolean {
  return getModelPageTemplateConfig(slug)?.intent === 'prelaunch';
}

export function listModelPageTemplateSlugs(): string[] {
  return Object.values(MODEL_PAGE_TEMPLATE_REGISTRY)
    .filter((config) => config.intent !== 'prelaunch')
    .map((config) => config.slug);
}

export function listPrelaunchModelPageTemplateSlugs(): string[] {
  return Object.values(MODEL_PAGE_TEMPLATE_REGISTRY)
    .filter((config) => config.intent === 'prelaunch')
    .map((config) => config.slug);
}
