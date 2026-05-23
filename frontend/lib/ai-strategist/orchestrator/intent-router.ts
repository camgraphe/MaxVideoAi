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
  if (asksForExamples(text)) return 'examples_help';
  if (asksForDocsSearch(text)) return 'site_help';
  if (asksForCapabilities(text)) return 'capability_help';
  if (asksForGreeting(text)) return 'capability_help';
  if (asksForSiteOverview(text)) return 'site_overview_help';
  if (asksForPricing(text)) return 'pricing_help';
  if (asksForModelInfo(text)) return 'model_info_help';
  if (asksForModelNavigation(text)) return 'navigation_help';
  if (asksForModelPagesNavigation(text)) return 'navigation_help';
  if (/\bupload\b/.test(text) && /\b(?:image|img|photo|reference|asset|pic|logo|product|prod)\b/.test(text) && !hasCreativeCreationIntent(text)) return 'asset_reference_help';
  if (asksForAssetHelp(text) && !hasCreativeCreationIntent(text)) return 'asset_reference_help';
  if (asksForExplicitModelDecisionAdvice(text)) return 'model_advice';
  if (hasCreativeBriefWithModelWorkflowUncertainty(text)) return 'new_video_brief';
  if (asksForModelAdvice(text)) return 'model_advice';
  if (asksForWorkflow(text)) return 'workflow_help';
  if (asksForSiteNavigation(text) && !hasCreativeBriefSignal(text)) return 'navigation_help';
  if (/\bupload\b/.test(text) && /\b(?:image|img|photo|reference|asset|pic|logo|product|prod)\b/.test(text)) return 'asset_reference_help';
  if (asksForSiteNavigation(text)) return 'navigation_help';
  if (!input.rawUserMessage?.trim()) return 'unknown';
  return 'new_video_brief';
}

function resolveHelpTask(text: string): StrategistOrchestratorTask {
  if (asksForExamples(text)) return 'examples_help';
  if (asksForPricing(text)) return 'pricing_help';
  if (asksForDocsSearch(text)) return 'site_help';
  if (asksForCapabilities(text)) return 'capability_help';
  if (asksForSiteOverview(text)) return 'site_overview_help';
  if (asksForWorkflow(text)) return 'workflow_help';
  if (asksForAssetHelp(text)) return 'asset_reference_help';
  return 'site_help';
}

function resolveNavigationTask(text: string): StrategistOrchestratorTask {
  if (asksForExamples(text)) return 'examples_help';
  if (asksForPricing(text)) return 'pricing_help';
  if (asksForDocsSearch(text)) return 'site_help';
  if (asksForCapabilities(text)) return 'capability_help';
  if (asksForSiteOverview(text)) return 'site_overview_help';
  if (asksForUploadNavigation(text)) return 'navigation_help';
  if (asksForAssetHelp(text)) return 'asset_reference_help';
  return 'navigation_help';
}

function asksForPricing(text: string): boolean {
  if (hasModelChoiceBudgetTradeoff(text)) return false;
  if (asksForModelPriceComparison(text)) return true;
  if (hasCreativeBudgetBriefIntent(text)) return false;
  if (asksForCheapestModel(text)) return true;
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
    'pay as you go',
    'pay-as-you-go',
    'paygo',
    'subscription',
    'subscribe',
    'no sub',
    'credits are spent',
    'credits spent',
    'refund',
    'refunded',
    'refunds',
    'failed generation',
    'failed generations',
    'generation fails',
    'if fail',
    'if it fails',
  ]);
}

function hasModelChoiceBudgetTradeoff(text: string): boolean {
  if (!containsAny(text, ['premium', 'quality', 'high quality', 'best looking', 'looks good', 'look good'])) return false;
  return containsAny(text, [
    'burn credits',
    'waste credits',
    'spend too much',
    'too expensive',
    'not the most expensive',
    'without spending',
    'dont want to spend',
    'don t want to spend',
    'do not want to spend',
    'low cost',
    'cost aware',
    'cost-aware',
    'cheap',
    'cheaper',
  ]);
}

function hasCreativeBudgetBriefIntent(text: string): boolean {
  if (asksForExplicitCheapestModelQuestion(text)) return false;
  if (!containsAny(text, ['cheap', 'cheaper', 'low cost', 'budget', 'pas cher', 'pas chere', 'moins cher', 'moins chere', 'barato'])) return false;
  return containsAny(text, [
    'ad',
    'pub',
    'tiktok',
    'product',
    'producto',
    'produit',
    'creative',
    'concept',
    'draft',
    'storyboard',
    'test',
    'tester',
    'create',
    'make',
    'faire',
    'generer',
    'générer',
    'anuncio',
    'probar',
  ]);
}

function asksForCheapestModel(text: string): boolean {
  return containsAny(text, ['model', 'models', 'modele', 'modèle', 'modelo', 'engine', 'engine', 'moteur']) &&
    containsAny(text, ['cheapest', 'least expensive', 'lowest cost', 'lowest price', 'moins cher', 'moin cher', 'pas cher', 'barato', 'mas barato', 'más barato', 'menos caro']);
}

function asksForExplicitCheapestModelQuestion(text: string): boolean {
  return containsAny(text, [
    'whats cheapest',
    'what s cheapest',
    'what is cheapest',
    'which is cheapest',
    'which one is cheapest',
    'cheapest vid model',
    'cheapest video model',
    'cheapest model',
    'cheapest engine',
    'least expensive model',
    'least expensive engine',
    'lowest cost model',
    'lowest cost engine',
    'modelo mas barato',
    'modelo más barato',
    'modele moins cher',
    'modèle moins cher',
  ]);
}

function asksForModelPriceComparison(text: string): boolean {
  if (!containsAny(text, ['seedance', 'sidance', 'kling', 'veo', 'ltx', 'pika', 'hailuo', 'sora', 'happy horse'])) return false;
  return containsAny(text, [
    'cheaper than',
    'less expensive than',
    'more expensive than',
    'cost more than',
    'costs more than',
    'cost less than',
    'costs less than',
    'price difference',
    'pricing difference',
    'compare price',
    'compare pricing',
    'before i spend credits',
  ]);
}

function asksForExamples(text: string): boolean {
  return containsAny(text, [
    'example',
    'examples',
    'sample',
    'samples',
    'gallery',
    'galleries',
    'exemple',
    'exemples',
    'compare outputs',
    'see outputs',
    'outputs before',
    'browse outputs',
    'outputs by model',
    'real vids',
    'real videos',
    'before paying',
    'b4 payin',
    'b4 paying',
    'see videos made with',
    'videos made with',
    'see vids made with',
    'videos from',
    'outputs from',
  ]);
}

function asksForDocsSearch(text: string): boolean {
  return containsAny(text, ['search your docs', 'search docs', 'docs search', 'search the docs', 'rag', 'knowledge base']);
}

function asksForCapabilities(text: string): boolean {
  if (hasCreativeCreationIntent(text) && containsAny(text, ['can you help me make', 'help me make', 'can you help me create', 'help me create'])) {
    return false;
  }
  return containsAny(text, [
    'what can you do',
    'what do you do',
    'what can you actually do',
    'how can you help',
    'what can this assistant do',
    'what can the strategist do',
    'can you help',
    'can you help me',
    'help me',
    'need direction',
    'need guidance',
    'need help getting started',
    'what should i do first',
    'where should i start',
    'where do i start',
    'landed here from an ad',
    'came from an ad',
    'dont know prompts',
    'don t know prompts',
    'do not know prompts',
    'i dont know prompts',
    'i don t know prompts',
    'can u just generate it',
    'can you just generate it',
    'can you generate it for me',
    'not sure where to start',
    'not sure if i need',
    'guide me from idea to video',
    'from idea to video',
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

function asksForGreeting(text: string): boolean {
  return /^(hi|hello|hey|bonjour|salut|hola)(?:\b|$)/.test(text) &&
    !hasCreativeCreationIntent(text) &&
    !asksForPricing(text) &&
    !asksForExamples(text);
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
  return containsAny(text, [
    'workflow',
    'text to video',
    'image to video',
    'video to video',
    'r2v',
    'i2v',
    'v2v',
    'restyle a video',
    'video i already have',
    'video already have',
    'should i upload',
    'write a text prompt',
    'product photo enough',
    'is that enough',
    'still image first',
    'generate a still image first',
    'better product control',
    'product control',
    'reference video',
    'same actor',
    'same character from a reference video',
    'existing clip',
    'change the style',
    'keep motion',
    'workflow is best',
    'logo must stay stable',
  ]);
}

function asksForAssetHelp(text: string): boolean {
  if (/\bupload\b/.test(text) && /\b(?:image|img|photo|reference|asset)\b/.test(text)) return true;
  if (/\bupload\b/.test(text) && /\b(?:pic|logo|product|prod)\b/.test(text)) return true;
  return containsAny(text, ['upload image', 'upload an image', 'upload img', 'where upload img', 'reference image', 'image upload', 'uploader une image', 'mettre mon image']);
}

function asksForUploadNavigation(text: string): boolean {
  return containsAny(text, [
    'where do i upload',
    'where to upload',
    'where upload',
    'where can i upload',
    'where should i upload',
    'where is upload',
    'where is the upload',
  ]);
}

function hasCreativeCreationIntent(text: string): boolean {
  return /\bads?\b/.test(text) || containsAny(text, [
    'animate',
    'animation',
    'create',
    'make',
    'generate',
    'turn this',
    'video',
    'advert',
    'commercial',
    'speaking',
    'speak',
    'movement',
    'motion',
    'subtle silent movement',
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
  if (containsAny(text, ['can u just generate it', 'can you just generate it', 'can you generate it for me'])) return false;
  if ((containsAny(text, ['i uploaded', 'i have uploaded']) || /\buploaded\b/.test(text)) && hasCreativeCreationIntent(text)) return false;
  if (!containsAny(text, ['where', 'show me', 'open', 'go to', 'find', 'compare', 'generate', 'generating', 'upload', 'pricing'])) return false;
  return containsAny(text, ['compare', 'generate', 'generating', 'generator', 'models', 'model page', 'model pages', 'engines', 'upload', 'pricing', 'examples']);
}

function asksForModelNavigation(text: string): boolean {
  if (!containsAny(text, ['where is', 'where can i find', 'show me', 'open', 'find'])) return false;
  return containsAny(text, ['seedance', 'sidance', 'kling', 'veo', 'ltx', 'pika', 'hailuo', 'sora', 'happy horse']);
}

function asksForModelPagesNavigation(text: string): boolean {
  return containsAny(text, [
    'where are the model pages',
    'where are model pages',
    'where are the models',
    'where are models',
  ]);
}

function asksForModelAdvice(text: string): boolean {
  if (containsAny(text, [
    'models support image to video',
    'models support image-to-video',
    'support image to video',
    'support image-to-video',
    'models support video to video',
    'models support video-to-video',
    'support video to video',
    'support video-to-video',
  ])) return false;
  if (isExplicitModelComparison(text)) return true;
  if (/\b(?:seedance|sidance|kling|veo|ltx|pika|hailuo|sora|happy horse)\b.*\b(?:or|vs|versus)\b.*\b(?:seedance|sidance|kling|veo|ltx|pika|hailuo|sora|happy horse)\b/.test(text)) return true;
  if (/\b(?:seedance|sidance|kling|veo|ltx|pika|hailuo|sora|happy horse)\b.*\bbetter than\b.*\b(?:seedance|sidance|kling|veo|ltx|pika|hailuo|sora|happy horse)\b/.test(text)) return true;
  if (/\bdifference between\b.*\b(?:seedance|sidance|kling|veo|ltx|pika|hailuo|sora|happy horse)\b/.test(text)) return true;
  if (/\b(?:seedance|sidance|kling|veo|ltx|pika|hailuo|sora|happy horse)\b.*\bdifference between\b/.test(text)) return true;
  return containsAny(text, [
    'which model',
    'which engine',
    'what model',
    'what engine',
    'recommend model',
    'recommend a model',
    'best model',
    'best engine',
    'choose a model',
    'pick model',
    'pick a model',
    'pick the model',
    'can u pick model',
    'can you pick model',
    'idk model',
    'dont know model',
    'don t know model',
    'engine is safest',
    'safest engine',
    'safest model',
    'premium but not the most expensive',
    'premium but cheap',
    'premium but low cost',
    'premium but cheaper',
    'not the most expensive model',
    'burn credits',
    'need 4k',
    'really need 4k',
    'do i need 4k',
    'better than',
    'difference between',
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

function asksForExplicitModelDecisionAdvice(text: string): boolean {
  return containsAny(text, [
    'do i need 4k',
    'really need 4k',
    'need 4k for',
    'should i use 4k',
    'is 4k worth',
    'worth using 4k',
    'premium but not the most expensive',
    'not the most expensive model',
    'burn credits',
  ]);
}

function asksForModelInfo(text: string): boolean {
  if (!containsAny(text, ['seedance', 'sidance', 'kling', 'veo', 'ltx', 'pika', 'hailuo', 'sora', 'happy horse'])) return false;
  if (isExplicitModelComparison(text)) return false;
  if (containsAny(text, ['difference between', 'better than', 'which model should i use', 'which engine should i use', 'what model should i use', 'what engine should i use'])) return false;
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

function isExplicitModelComparison(text: string): boolean {
  const model = '(?:seedance|sidance|kling|veo|ltx|pika|hailuo|sora|happy horse)';
  return new RegExp(`\\b${model}\\b.*\\b(?:or|ou|vs|versus|plutot|plutôt)\\b.*\\b${model}\\b`).test(text);
}

function hasCreativeBriefWithModelWorkflowUncertainty(text: string): boolean {
  if (!containsAny(text, [
    'not sure which model or workflow',
    'not sure which model',
    'idk model',
    'dont know model',
    'don t know model',
  ])) return false;
  if (containsAny(text, [
    'better than',
    'difference between',
    ' vs ',
    ' versus ',
    'which model should i use',
    'which engine should i use',
    'what model should i use',
    'what engine should i use',
    'pick the best model',
    'best model for',
    'best engine for',
    'recommend a model',
    'which model is',
    'which engine is',
    'what should i use',
  ])) return false;
  return hasCreativeBriefSignal(text);
}

function hasCreativeBriefSignal(text: string): boolean {
  return containsAny(text, [
    ' ad',
    'ad ',
    'pub',
    'advert',
    'commercial',
    'tiktok',
    'reel',
    'product reveal',
    'product ad',
    'brand video',
    'spokesperson',
    'talking avatar',
    'speaking to camera',
    'voiceover',
    'dialogue',
    'cinematic',
    'stylized',
    'arcade',
    'fighting',
    'fighter',
    'fighters',
    'rooftop',
    'macro',
    'velvet',
    'jewelry',
    'ring',
    'gold ring',
    'headshot',
    'reference image',
    'person',
    'human',
    'office scene',
    'silent movement',
    'creature',
    'fantasy',
    'breathing fire',
    'dark cave',
    'restyle',
    'uploaded video',
    'product image',
    'logo',
    'packaging',
    'headphones',
    'sneaker',
    'drink can',
    'energy drink',
    'watch',
    'perfume',
    'skincare',
    'car',
    'voiture',
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
