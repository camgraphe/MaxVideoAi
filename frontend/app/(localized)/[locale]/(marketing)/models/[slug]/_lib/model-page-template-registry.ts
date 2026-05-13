import type { ModelPageTemplateConfig } from './model-page-template-types';
import { kling3ProTemplateConfig } from './model-page-templates/kling-3-pro';
import { ltx23FastTemplateConfig } from './model-page-templates/ltx-2-3-fast';
import { seedance20TemplateConfig } from './model-page-templates/seedance-2-0';
import { seedance20FastTemplateConfig } from './model-page-templates/seedance-2-0-fast';
import { seedreamTemplateConfig } from './model-page-templates/seedream';
import { veo31TemplateConfig } from './model-page-templates/veo-3-1';

const MODEL_PAGE_TEMPLATE_REGISTRY: Record<string, ModelPageTemplateConfig> = {
  [kling3ProTemplateConfig.slug]: kling3ProTemplateConfig,
  [ltx23FastTemplateConfig.slug]: ltx23FastTemplateConfig,
  [seedance20TemplateConfig.slug]: seedance20TemplateConfig,
  [seedance20FastTemplateConfig.slug]: seedance20FastTemplateConfig,
  [seedreamTemplateConfig.slug]: seedreamTemplateConfig,
  [veo31TemplateConfig.slug]: veo31TemplateConfig,
};

export function getModelPageTemplateConfig(slug: string): ModelPageTemplateConfig | null {
  return MODEL_PAGE_TEMPLATE_REGISTRY[slug] ?? null;
}

export function listModelPageTemplateSlugs(): string[] {
  return Object.keys(MODEL_PAGE_TEMPLATE_REGISTRY);
}
