import type { StrategistConversationAction } from '../conversation-planner';
import type {
  StrategistOrchestratorInput,
  StrategistOrchestratorStage,
  StrategistOrchestratorTask,
} from './types';

export function resolveStrategistTask(input: StrategistOrchestratorInput): StrategistOrchestratorTask {
  const action = input.conversationPlan.action;
  const text = normalizeSearchText(input.rawUserMessage);

  if (action === 'await_prompt_paste') return 'prompt_edit_intake';
  if (action === 'improve_prompt') return 'prompt_edit';
  if (action === 'select_tier' || action === 'select_model') return 'model_or_tier_selection';
  if (action === 'build_prompt') return 'prompt_build';
  if (action === 'ask_clarification') return 'clarification';
  if (action === 'navigation_help') return resolveNavigationTask(text);
  if (action === 'product_help') return resolveHelpTask(text);
  if (action === 'recommend_models') return resolveRecommendationTask(input, text);

  return 'unknown';
}

export function resolveStrategistStage(input: {
  action: StrategistConversationAction;
  task: StrategistOrchestratorTask;
  surface?: 'chat' | 'debug';
}): StrategistOrchestratorStage {
  if (input.task === 'clarification') return 'understanding';
  if (input.task === 'prompt_edit_intake') return 'awaiting_user_input';
  if (
    input.task === 'site_help' ||
    input.task === 'site_overview_help' ||
    input.task === 'capability_help' ||
    input.task === 'model_info_help' ||
    input.task === 'examples_help' ||
    input.task === 'pricing_help' ||
    input.task === 'navigation_help' ||
    input.task === 'workflow_help' ||
    input.task === 'asset_reference_help'
  ) {
    return 'answering_help';
  }
  if (input.task === 'new_video_brief' || input.task === 'model_advice') return 'recommending';
  if (input.task === 'model_info_help') return 'answering_help';
  if (input.task === 'model_or_tier_selection') return 'collecting_details';
  if (input.task === 'prompt_build' || input.task === 'prompt_edit') return 'writing_prompt';
  return 'understanding';
}

function resolveRecommendationTask(
  input: StrategistOrchestratorInput,
  text: string
): StrategistOrchestratorTask {
  if (asksForPricing(text)) return 'pricing_help';
  if (asksForDocsSearch(text)) return 'site_help';
  if (asksForExamples(text)) return 'examples_help';
  if (asksForCapabilities(text)) return 'capability_help';
  if (asksForSiteOverview(text)) return 'site_overview_help';
  if (asksForWorkflow(text)) return 'workflow_help';
  if (asksForSiteNavigation(text)) return 'navigation_help';
  if (asksForModelAdvice(text)) return 'model_advice';
  if (asksForModelInfo(text)) return 'model_info_help';
  if (asksForAssetHelp(text) && !hasCreativeCreationIntent(text)) return 'asset_reference_help';
  if (!input.rawUserMessage?.trim()) return 'unknown';
  return 'new_video_brief';
}

function resolveHelpTask(text: string): StrategistOrchestratorTask {
  if (asksForPricing(text)) return 'pricing_help';
  if (asksForDocsSearch(text)) return 'site_help';
  if (asksForExamples(text)) return 'examples_help';
  if (asksForCapabilities(text)) return 'capability_help';
  if (asksForSiteOverview(text)) return 'site_overview_help';
  if (asksForWorkflow(text)) return 'workflow_help';
  if (asksForAssetHelp(text)) return 'asset_reference_help';
  return 'site_help';
}

function resolveNavigationTask(text: string): StrategistOrchestratorTask {
  if (asksForPricing(text)) return 'pricing_help';
  if (asksForDocsSearch(text)) return 'site_help';
  if (asksForExamples(text)) return 'examples_help';
  if (asksForCapabilities(text)) return 'capability_help';
  if (asksForSiteOverview(text)) return 'site_overview_help';
  if (asksForAssetHelp(text)) return 'asset_reference_help';
  return 'navigation_help';
}

function asksForPricing(text: string): boolean {
  if (asksForCheapestModel(text)) return true;
  if (hasCreativeBudgetBriefIntent(text)) return false;
  return containsAny(text, [
    'price',
    'pricing',
    'credit',
    'credits',
    'cost',
    'how much',
    'how many credits',
    'tarif',
    'tarifs',
    'cout',
    'coût',
    'combien',
    'combien de credits',
    'cheapest',
    'least expensive',
    'lowest cost',
    'lowest price',
    'cheaper',
    'moins cher',
    'moin cher',
    'moins couteux',
    'moins coûteux',
    'pas cher',
    'barato',
    'mas barato',
    'más barato',
    'menos caro',
    'credito',
    'creditos',
    'créditos',
    'devis',
    'estimation',
    'estimate',
    'quote',
    'avant de lancer',
    'before launching',
    'before generation',
  ]);
}

function hasCreativeBudgetBriefIntent(text: string): boolean {
  if (asksForCheapestModel(text)) return false;
  if (!containsAny(text, ['cheap', 'cheaper', 'low cost', 'budget', 'pas cher', 'pas chere', 'moins cher', 'moins chere', 'barato'])) return false;
  return containsAny(text, [
    'ad',
    'pub',
    'tiktok',
    'video',
    'product',
    'produit',
    'creative',
    'test',
    'tester',
    'create',
    'make',
    'faire',
    'generer',
    'générer',
    'anuncio',
    'barato',
    'probar',
  ]);
}

function asksForCheapestModel(text: string): boolean {
  return containsAny(text, ['model', 'models', 'modele', 'modèle', 'modelo', 'engine', 'engine', 'moteur']) &&
    containsAny(text, ['cheapest', 'least expensive', 'lowest cost', 'lowest price', 'moins cher', 'moin cher', 'pas cher', 'barato', 'mas barato', 'más barato', 'menos caro']);
}

function asksForExamples(text: string): boolean {
  return containsAny(text, ['example', 'examples', 'sample', 'samples', 'gallery', 'galleries', 'exemple', 'exemples']);
}

function asksForDocsSearch(text: string): boolean {
  return containsAny(text, ['search your docs', 'search docs', 'docs search', 'search the docs', 'rag', 'knowledge base']);
}

function asksForCapabilities(text: string): boolean {
  return containsAny(text, [
    'what can you do',
    'what do you do',
    'how can you help',
    'what can this assistant do',
    'what can the strategist do',
    'capabilities',
    'tes capacites',
    'tes capacités',
    'tu peux faire quoi',
    'que peux tu faire',
    'que peux-tu faire',
    'a quoi tu sers',
    'à quoi tu sers',
    'comment tu peux aider',
  ]);
}

function asksForSiteOverview(text: string): boolean {
  return containsAny(text, [
    'how does maxvideoai work',
    'how does the site work',
    'what is maxvideoai',
    'explain maxvideoai',
    'site overview',
    'comment fonctionne maxvideoai',
    'comment marche maxvideoai',
    'explique maxvideoai',
  ]);
}

function asksForWorkflow(text: string): boolean {
  return containsAny(text, ['workflow', 'text to video', 'image to video', 'video to video', 'r2v', 'i2v', 'v2v']);
}

function asksForAssetHelp(text: string): boolean {
  return containsAny(text, ['upload image', 'upload an image', 'reference image', 'image upload', 'uploader une image', 'mettre mon image']);
}

function hasCreativeCreationIntent(text: string): boolean {
  return containsAny(text, [
    'animate',
    'animation',
    'create',
    'make',
    'generate',
    'turn this',
    'video',
    'ad',
    'commercial',
    'speaking',
    'speak',
    'spokesperson',
    'lip sync',
    'lip-sync',
    'preserve',
    'product photo',
    'photo produit',
    'animer',
    'anime',
    'créer',
    'creer',
    'faire',
    'générer',
    'generer',
    'pub',
    'parler',
  ]);
}

function asksForSiteNavigation(text: string): boolean {
  if (!containsAny(text, ['where', 'show me', 'open', 'go to', 'find', 'compare', 'generate', 'generating', 'upload', 'pricing'])) return false;
  return containsAny(text, ['compare', 'generate', 'generating', 'generator', 'models', 'engines', 'upload', 'pricing', 'examples']);
}

function asksForModelAdvice(text: string): boolean {
  return containsAny(text, [
    'which model',
    'what model',
    'recommend model',
    'recommend a model',
    'best model',
    'choose a model',
    'should i use',
    'which one should i use',
    'choisir un modele',
    'choisir un modèle',
    'tu conseilles',
    'tu conseille',
    'tu recommandes',
    'tu recommande',
    'lequel tu recommandes',
    'plutot',
    'plutôt',
  ]);
}

function asksForModelInfo(text: string): boolean {
  if (!containsAny(text, ['seedance', 'sidance', 'kling', 'veo', 'ltx', 'pika', 'hailuo', 'sora', 'happy horse'])) return false;
  return containsAny(text, [
    'what can',
    'what is',
    'best for',
    'avoid',
    'support',
    'supports',
    'capable',
    'can do',
    'tell me about',
    'explique',
    'sert a quoi',
    'sert à quoi',
    'fait quoi',
    'fait le',
    'peut faire',
    'est ce que',
    'lip sync',
    'lip-sync',
    'audio',
    'voice',
    'voix',
    'dialogue',
  ]);
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function normalizeSearchText(value: unknown): string {
  return typeof value === 'string'
    ? value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’']/g, ' ')
        .replace(/[^a-z0-9:.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}
