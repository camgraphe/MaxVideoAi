import type { ModelPageTemplateConfig } from './model-page-template-types';
import { ltx23FastTemplateConfig } from './model-page-templates/ltx-2-3-fast';
import { seedance20TemplateConfig } from './model-page-templates/seedance-2-0';
import { seedance20FastTemplateConfig } from './model-page-templates/seedance-2-0-fast';

const MODEL_PAGE_TEMPLATE_REGISTRY: Record<string, ModelPageTemplateConfig> = {
  [ltx23FastTemplateConfig.slug]: ltx23FastTemplateConfig,
  [seedance20TemplateConfig.slug]: seedance20TemplateConfig,
  [seedance20FastTemplateConfig.slug]: seedance20FastTemplateConfig,
};

export function getModelPageTemplateConfig(slug: string): ModelPageTemplateConfig | null {
  return MODEL_PAGE_TEMPLATE_REGISTRY[slug] ?? null;
}

export function listModelPageTemplateSlugs(): string[] {
  return Object.keys(MODEL_PAGE_TEMPLATE_REGISTRY);
}
