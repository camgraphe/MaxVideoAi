import type { ModelPageTemplateConfig } from './model-page-template-types';
import { kling34kTemplateConfig } from './model-page-templates/kling-3-4k';
import { kling3ProTemplateConfig } from './model-page-templates/kling-3-pro';
import { kling3StandardTemplateConfig } from './model-page-templates/kling-3-standard';
import { ltx23ProTemplateConfig } from './model-page-templates/ltx-2-3-pro';
import { ltx23FastTemplateConfig } from './model-page-templates/ltx-2-3-fast';
import { seedance20TemplateConfig } from './model-page-templates/seedance-2-0';
import { seedance20FastTemplateConfig } from './model-page-templates/seedance-2-0-fast';
import { seedreamTemplateConfig } from './model-page-templates/seedream';
import { sora2ProTemplateConfig } from './model-page-templates/sora-2-pro';
import { sora2TemplateConfig } from './model-page-templates/sora-2';
import { veo31FastTemplateConfig } from './model-page-templates/veo-3-1-fast';
import { veo31TemplateConfig } from './model-page-templates/veo-3-1';
import { veo31LiteTemplateConfig } from './model-page-templates/veo-3-1-lite';

const MODEL_PAGE_TEMPLATE_REGISTRY: Record<string, ModelPageTemplateConfig> = {
  [kling34kTemplateConfig.slug]: kling34kTemplateConfig,
  [kling3ProTemplateConfig.slug]: kling3ProTemplateConfig,
  [kling3StandardTemplateConfig.slug]: kling3StandardTemplateConfig,
  [ltx23FastTemplateConfig.slug]: ltx23FastTemplateConfig,
  [ltx23ProTemplateConfig.slug]: ltx23ProTemplateConfig,
  [seedance20TemplateConfig.slug]: seedance20TemplateConfig,
  [seedance20FastTemplateConfig.slug]: seedance20FastTemplateConfig,
  [seedreamTemplateConfig.slug]: seedreamTemplateConfig,
  [sora2TemplateConfig.slug]: sora2TemplateConfig,
  [sora2ProTemplateConfig.slug]: sora2ProTemplateConfig,
  [veo31FastTemplateConfig.slug]: veo31FastTemplateConfig,
  [veo31TemplateConfig.slug]: veo31TemplateConfig,
  [veo31LiteTemplateConfig.slug]: veo31LiteTemplateConfig,
};

export function getModelPageTemplateConfig(slug: string): ModelPageTemplateConfig | null {
  return MODEL_PAGE_TEMPLATE_REGISTRY[slug] ?? null;
}

export function listModelPageTemplateSlugs(): string[] {
  return Object.keys(MODEL_PAGE_TEMPLATE_REGISTRY);
}
