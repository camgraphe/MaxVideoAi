import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const klingV4FlashTemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-v4-flash', intent: 'production',
  hero: { eyebrow: 'KLING 4.0 FLASH', subtitleHighlightTerms: ['720p'],
    primaryCtaHref: '/app?engine=kling-v4-flash', secondaryCtaHref: '#specs',
    quickLinks: [{labelKey:'promptExamples',href:'#prompting',icon:'prompt'}] },
  pricing: { anchorHref: '/pricing#kling-v4-flash-pricing', presets: [
    {id:'5s-720p',seconds:5,resolution:'720p',labelKey:'commonProductionCheck',noteKey:'checkLiveQuote'},
  ] },
  sections: {examples:true,prompting:true,tips:true,compare:true,specs:true,safety:true,faq:true},
};
function imageTemplate(variant: 'flare' | 'sunburst'): ModelPageTemplateConfig {
  const slug = `gpt-image-2-6-${variant}`;
  return {slug,intent:'specialized',hero:{eyebrow:`OPENAI GPT IMAGE 2.6 ${variant.toUpperCase()}`,
    subtitleHighlightTerms:['1024'],primaryCtaHref:`/app/image?engine=${slug}`,secondaryCtaHref:'#specs',
    quickLinks:[{labelKey:'openImageWorkspace',href:`/app/image?engine=${slug}`,icon:'image'},
      {labelKey:'promptExamples',href:'#prompting',icon:'prompt'}]},
    pricing:{anchorHref:`/pricing#${slug}-pricing`,presets:[
      {id:'1024x1024-medium',imageResolution:'1024x1024',imageQuality:'medium',labelKey:'productStill',noteKey:'checkLiveQuote'},
      {id:'1536x1024-high',imageResolution:'1536x1024',imageQuality:'high',labelKey:'productStill',noteKey:'checkLiveQuote'},
      {id:'1024x1536-high',imageResolution:'1024x1536',imageQuality:'high',labelKey:'productStill',noteKey:'checkLiveQuote'},
    ]},sections:{examples:true,prompting:true,tips:true,compare:false,specs:true,safety:true,faq:true}};
}
export const gptImage26FlareTemplateConfig = imageTemplate('flare');
export const gptImage26SunburstTemplateConfig = imageTemplate('sunburst');
