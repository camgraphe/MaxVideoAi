export type CommercialVideoMarketingGoal =
  | 'awareness'
  | 'product_demo'
  | 'launch'
  | 'conversion'
  | 'retargeting'
  | 'social_ad'
  | 'brand_story'
  | 'other';

export type CommercialVideoAgentBrief = {
  rawRequest: string;
  productOrOffer: string;
  audience: string;
  marketingGoal: CommercialVideoMarketingGoal;
  mainBenefit: string;
  scene: string;
  visualStyle: string;
  brandTone: string;
  cta: string;
  mustInclude: string[];
  avoid: string[];
  legalSafetyConstraints: string[];
};

export type CommercialBriefRequiredField =
  | 'productOrOffer'
  | 'audience'
  | 'mainBenefit'
  | 'scene'
  | 'visualStyle'
  | 'cta';

export const EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF: CommercialVideoAgentBrief = {
  rawRequest: '',
  productOrOffer: '',
  audience: '',
  marketingGoal: 'social_ad',
  mainBenefit: '',
  scene: '',
  visualStyle: '',
  brandTone: '',
  cta: '',
  mustInclude: [],
  avoid: [],
  legalSafetyConstraints: [],
};

export const REQUIRED_COMMERCIAL_BRIEF_FIELDS: CommercialBriefRequiredField[] = [
  'productOrOffer',
  'audience',
  'mainBenefit',
  'scene',
  'visualStyle',
  'cta',
];

export function getMissingCommercialBriefFields(
  brief: CommercialVideoAgentBrief
): CommercialBriefRequiredField[] {
  return REQUIRED_COMMERCIAL_BRIEF_FIELDS.filter((field) => !brief[field].trim());
}

export function isCommercialBriefComplete(brief: CommercialVideoAgentBrief): boolean {
  return getMissingCommercialBriefFields(brief).length === 0;
}
