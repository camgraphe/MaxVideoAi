import type { CommercialVideoAgentBrief } from './video-agent-brief';

export type VideoAgentWarning = {
  type:
    | 'missing_client_info'
    | 'provider_api_uncertainty'
    | 'text_rendering_risk'
    | 'logo_accuracy_risk'
    | 'safety_risk'
    | 'legal_claim_risk'
    | 'duration_complexity_risk'
    | 'other';
  message: string;
  severity: 'low' | 'medium' | 'high';
};

export type CommercialVideoSafetyReview = {
  allowed: boolean;
  reason?: string;
  warnings: VideoAgentWarning[];
};

const SEXUAL_OR_NUDITY_PATTERN = /\b(nude|nudity|naked|porn|sexual|sexy child|lingerie sexualized)\b/i;
const CELEBRITY_OR_IP_PATTERN = /\b(celebrity|tom cruise|nike|apple commercial|pixar|marvel|star wars|disney)\b/i;
const MEDICAL_OR_FINANCIAL_CLAIM_PATTERN =
  /\b(cure|guaranteed results|guaranteed roi|risk-free investment|clinically proven|lose weight|medical claim)\b/i;
const LOGO_PATTERN = /\b(exact logo|real logo|brand logo|fake logos?|apple-like|nike-like)\b/i;
const TEXT_PATTERN = /\b(long text|readable text|website url|qr code|tiny text|unreadable text)\b/i;

function combinedBriefText(brief: CommercialVideoAgentBrief): string {
  return [
    brief.rawRequest,
    brief.productOrOffer,
    brief.audience,
    brief.mainBenefit,
    brief.scene,
    brief.visualStyle,
    brief.brandTone,
    brief.cta,
    brief.mustInclude.join(' '),
    brief.avoid.join(' '),
    brief.legalSafetyConstraints.join(' '),
  ].join(' ');
}

export function reviewCommercialVideoRequest(
  brief: CommercialVideoAgentBrief
): CommercialVideoSafetyReview {
  const text = combinedBriefText(brief);

  if (SEXUAL_OR_NUDITY_PATTERN.test(text)) {
    return {
      allowed: false,
      reason: 'Request contains sexual or nudity content that is not supported for this commercial agent.',
      warnings: [
        {
          type: 'safety_risk',
          message: 'Nudity or sexualized commercial content is blocked.',
          severity: 'high',
        },
      ],
    };
  }

  if (CELEBRITY_OR_IP_PATTERN.test(text)) {
    return {
      allowed: false,
      reason: 'Request references protected IP, celebrities, or third-party brand likeness.',
      warnings: [
        {
          type: 'safety_risk',
          message: 'Use original generic visuals only; no protected IP, celebrity likeness, or third-party logos.',
          severity: 'high',
        },
      ],
    };
  }

  const warnings: VideoAgentWarning[] = [];

  if (MEDICAL_OR_FINANCIAL_CLAIM_PATTERN.test(text)) {
    warnings.push({
      type: 'legal_claim_risk',
      message: 'Avoid medical, financial, or guaranteed-result claims unless they are externally validated.',
      severity: 'medium',
    });
  }

  if (LOGO_PATTERN.test(text)) {
    warnings.push({
      type: 'logo_accuracy_risk',
      message: 'Text-to-video cannot guarantee exact logos or packaging without a future image/reference step.',
      severity: 'medium',
    });
  }

  if (TEXT_PATTERN.test(text) || brief.cta.length > 24) {
    warnings.push({
      type: 'text_rendering_risk',
      message: 'Keep generated text short. Long text, URLs, prices, and legal copy should be added in post-production.',
      severity: 'low',
    });
  }

  return { allowed: true, warnings };
}
