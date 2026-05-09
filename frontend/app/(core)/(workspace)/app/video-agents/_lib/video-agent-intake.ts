import type {
  CommercialBriefRequiredField,
  CommercialVideoAgentBrief,
  CommercialVideoMarketingGoal,
} from './video-agent-brief';
import { getMissingCommercialBriefFields } from './video-agent-brief';

const GOAL_ALIASES: Record<string, CommercialVideoMarketingGoal> = {
  awareness: 'awareness',
  demo: 'product_demo',
  'product demo': 'product_demo',
  lancement: 'launch',
  launch: 'launch',
  conversion: 'conversion',
  retargeting: 'retargeting',
  social: 'social_ad',
  'social ad': 'social_ad',
  branding: 'brand_story',
  'brand story': 'brand_story',
};

const FIELD_ALIASES: Record<string, keyof CommercialVideoAgentBrief> = {
  audience: 'audience',
  avoid: 'avoid',
  benefice: 'mainBenefit',
  'bénéfice': 'mainBenefit',
  benefit: 'mainBenefit',
  cible: 'audience',
  constraint: 'legalSafetyConstraints',
  constraints: 'legalSafetyConstraints',
  contraintes: 'legalSafetyConstraints',
  cta: 'cta',
  'call to action': 'cta',
  goal: 'marketingGoal',
  include: 'mustInclude',
  lieu: 'scene',
  objectif: 'marketingGoal',
  offer: 'productOrOffer',
  product: 'productOrOffer',
  produit: 'productOrOffer',
  scene: 'scene',
  style: 'visualStyle',
  tone: 'brandTone',
  ton: 'brandTone',
};

const NEXT_QUESTIONS: Record<CommercialBriefRequiredField, string> = {
  productOrOffer: 'What product, service, or offer do you want to promote?',
  audience: 'Who is the main target audience for this video?',
  mainBenefit: 'What main benefit should be understood in the first few seconds?',
  scene: 'Where should the video take place?',
  visualStyle: 'What visual style do you want: premium cinematic, UGC, clean studio, warm restaurant, or modern SaaS?',
  cta: 'What short CTA should appear at the end?',
};

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeGoal(value: string): CommercialVideoMarketingGoal {
  return GOAL_ALIASES[value.trim().toLowerCase()] ?? 'other';
}

function normalizeKey(rawKey: string): keyof CommercialVideoAgentBrief | null {
  return FIELD_ALIASES[rawKey.trim().toLowerCase()] ?? null;
}

function cleanExtractedValue(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^(?:a|an|the|my|our)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFirst(rawText: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match?.[1]) return cleanExtractedValue(match[1]);
  }
  return '';
}

function splitNaturalList(value: string): string[] {
  return value
    .replace(/\.$/, '')
    .split(/\s*,\s*|\s+and\s+/i)
    .map(cleanExtractedValue)
    .filter(Boolean)
    .slice(0, 10);
}

function inferStyle(rawText: string): string {
  const explicitStyle = extractFirst(rawText, [
    /\bstyle\s*:\s*([^,.]+?)(?=,|\.\s|$)/i,
    /\bstyle\s+is\s+([^,.]+?)(?=,|\.\s|$)/i,
    /(?:^|\.\s*)Style\s+([^,.]+?)(?=,|\.\s|$)/,
    /\bvisual style\s+(?:is\s+)?([^,.]+?)(?=,|\.\s|$)/i,
  ]);
  if (explicitStyle) return explicitStyle;

  const knownStyle = rawText.match(
    /\b(UGC style|premium cinematic|warm cinematic restaurant ad|clean SaaS|clean modern SaaS|luxury cinematic tech commercial|premium product ad)\b/i
  );
  return knownStyle?.[1] ? cleanExtractedValue(knownStyle[1]) : '';
}

function inferNaturalEnglishRequest(rawText: string): Partial<CommercialVideoAgentBrief> {
  const productOrOffer = extractFirst(rawText, [
    /\b(?:ad|video|commercial|promo)\s+for\s+(?:my|our|an?|the)?\s*([^,.]+?)(?=\s+(?:aimed at|targeting|for|with|that|where)\b|[,.]|$)/i,
    /\b(?:promote|advertise)\s+(?:my|our|an?|the)?\s*([^,.]+?)(?=\s+(?:aimed at|targeting|for|with|that|where)\b|[,.]|$)/i,
  ]);
  const audience = extractFirst(rawText, [
    /\b(?:aimed at|targeting)\s+([^,.]+?)(?=,|\.\s|\s+(?:who|that|with|and)\b|$)/i,
  ]);
  const mainBenefit = extractFirst(rawText, [
    /\b(?:the\s+)?(?:main\s+)?benefit\s+(?:is|should be)\s+([^,.]+?)(?=,?\s+(?:CTA|style|scene|avoid)\b|\.|$)/i,
    /\bshow\s+([^,.]+?)\s+as\s+the\s+main\s+benefit\b/i,
  ]);
  const shownScene = extractFirst(rawText, [
    /\bshow\s+([^,.]+?)(?=,?\s+(?:benefit\s+is|the\s+main\s+benefit|CTA|style|avoid)\b|\.|$)/i,
    /\b(?:scene|location)\s+(?:is\s+)?([^,.]+?)(?=,|\.\s|$)/i,
  ]);
  const scene =
    /^(?:espresso|coffee|steam).*\son\sa\s/i.test(shownScene)
      ? cleanExtractedValue(shownScene.split(' on a ').at(-1) ?? shownScene)
      : shownScene;
  const visualStyle = inferStyle(rawText);
  const cta = extractFirst(rawText, [
    /\bCTA\s*[:\-]?\s*["']?([^".,]+)["']?(?=,|\.|$)/i,
    /\bcall to action\s*[:\-]?\s*["']?([^".,]+)["']?(?=,|\.|$)/i,
  ]);
  const avoidText = extractFirst(rawText, [/\bavoid\s+(.+?)(?=\.|$)/i, /\bexclude\s+(.+?)(?=\.|$)/i]);

  const inferred: Partial<CommercialVideoAgentBrief> = {};
  if (productOrOffer) inferred.productOrOffer = productOrOffer;
  if (audience) inferred.audience = audience;
  if (mainBenefit) inferred.mainBenefit = mainBenefit;
  if (scene) inferred.scene = scene;
  if (visualStyle) inferred.visualStyle = visualStyle;
  if (cta) inferred.cta = cta;
  if (avoidText) inferred.avoid = splitNaturalList(avoidText);
  return inferred;
}

function inferUnlabeledRequest(brief: CommercialVideoAgentBrief, rawText: string): Partial<CommercialVideoAgentBrief> {
  const normalized = rawText.trim();
  if (!normalized) return {};

  const naturalEnglishFields = inferNaturalEnglishRequest(normalized);
  if (Object.keys(naturalEnglishFields).length > 0) return naturalEnglishFields;

  const [missingField] = getMissingCommercialBriefFields(brief);
  if (!missingField) return {};
  return { [missingField]: normalized };
}

export function applyCommercialIntakeMessage(
  currentBrief: CommercialVideoAgentBrief,
  rawText: string
): CommercialVideoAgentBrief {
  const nextBrief: CommercialVideoAgentBrief = {
    ...currentBrief,
    rawRequest: [currentBrief.rawRequest, rawText.trim()].filter(Boolean).join('\n'),
  };

  let matchedField = false;

  for (const line of rawText.split('\n')) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (!match) continue;

    const field = normalizeKey(match[1]);
    const value = match[2].trim();
    if (!field || !value) continue;

    matchedField = true;
    if (field === 'mustInclude' || field === 'avoid' || field === 'legalSafetyConstraints') {
      nextBrief[field] = splitList(value);
    } else if (field === 'marketingGoal') {
      nextBrief.marketingGoal = normalizeGoal(value);
    } else if (field === 'productOrOffer') {
      nextBrief.productOrOffer = value;
    } else if (field === 'audience') {
      nextBrief.audience = value;
    } else if (field === 'mainBenefit') {
      nextBrief.mainBenefit = value;
    } else if (field === 'scene') {
      nextBrief.scene = value;
    } else if (field === 'visualStyle') {
      nextBrief.visualStyle = value;
    } else if (field === 'brandTone') {
      nextBrief.brandTone = value;
    } else if (field === 'cta') {
      nextBrief.cta = value;
    }
  }

  if (!matchedField) {
    Object.assign(nextBrief, inferUnlabeledRequest(nextBrief, rawText));
  }

  if (!nextBrief.brandTone && nextBrief.visualStyle) {
    nextBrief.brandTone = nextBrief.visualStyle;
  }

  return nextBrief;
}

export function askNextCommercialBriefQuestion(brief: CommercialVideoAgentBrief): string | null {
  const [missingField] = getMissingCommercialBriefFields(brief);
  return missingField ? NEXT_QUESTIONS[missingField] : null;
}
