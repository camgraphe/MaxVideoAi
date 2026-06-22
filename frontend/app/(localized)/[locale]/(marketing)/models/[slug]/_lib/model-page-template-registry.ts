import type { ModelPageTemplateConfig } from './model-page-template-types';
import { gptImage2TemplateConfig } from './model-page-templates/gpt-image-2';
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
import { minimaxHailuo02TemplateConfig } from './model-page-templates/minimax-hailuo-02-text';
import { nanoBanana2TemplateConfig } from './model-page-templates/nano-banana-2';
import { nanoBananaProTemplateConfig } from './model-page-templates/nano-banana-pro';
import { nanoBananaTemplateConfig } from './model-page-templates/nano-banana';
import { pikaTextToVideoTemplateConfig } from './model-page-templates/pika-text-to-video';
import { seedance15ProTemplateConfig } from './model-page-templates/seedance-1-5-pro';
import { seedance20TemplateConfig } from './model-page-templates/seedance-2-0';
import { seedance20FastTemplateConfig } from './model-page-templates/seedance-2-0-fast';
import { seedreamTemplateConfig } from './model-page-templates/seedream';
import { sora2ProTemplateConfig } from './model-page-templates/sora-2-pro';
import { sora2TemplateConfig } from './model-page-templates/sora-2';
import { veo31FastTemplateConfig } from './model-page-templates/veo-3-1-fast';
import { veo31TemplateConfig } from './model-page-templates/veo-3-1';
import { veo31LiteTemplateConfig } from './model-page-templates/veo-3-1-lite';
import { wan25TemplateConfig } from './model-page-templates/wan-2-5';
import { wan26TemplateConfig } from './model-page-templates/wan-2-6';

const MODEL_PAGE_TEMPLATE_REGISTRY: Record<string, ModelPageTemplateConfig> = {
  [gptImage2TemplateConfig.slug]: gptImage2TemplateConfig,
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
  [minimaxHailuo02TemplateConfig.slug]: minimaxHailuo02TemplateConfig,
  [nanoBananaTemplateConfig.slug]: nanoBananaTemplateConfig,
  [nanoBanana2TemplateConfig.slug]: nanoBanana2TemplateConfig,
  [nanoBananaProTemplateConfig.slug]: nanoBananaProTemplateConfig,
  [pikaTextToVideoTemplateConfig.slug]: pikaTextToVideoTemplateConfig,
  [seedance15ProTemplateConfig.slug]: seedance15ProTemplateConfig,
  [seedance20TemplateConfig.slug]: seedance20TemplateConfig,
  [seedance20FastTemplateConfig.slug]: seedance20FastTemplateConfig,
  [seedreamTemplateConfig.slug]: seedreamTemplateConfig,
  [sora2TemplateConfig.slug]: sora2TemplateConfig,
  [sora2ProTemplateConfig.slug]: sora2ProTemplateConfig,
  [veo31FastTemplateConfig.slug]: veo31FastTemplateConfig,
  [veo31TemplateConfig.slug]: veo31TemplateConfig,
  [veo31LiteTemplateConfig.slug]: veo31LiteTemplateConfig,
  [wan25TemplateConfig.slug]: wan25TemplateConfig,
  [wan26TemplateConfig.slug]: wan26TemplateConfig,
};

export function getModelPageTemplateConfig(slug: string): ModelPageTemplateConfig | null {
  return MODEL_PAGE_TEMPLATE_REGISTRY[slug] ?? null;
}

export function listModelPageTemplateSlugs(): string[] {
  return Object.keys(MODEL_PAGE_TEMPLATE_REGISTRY);
}
