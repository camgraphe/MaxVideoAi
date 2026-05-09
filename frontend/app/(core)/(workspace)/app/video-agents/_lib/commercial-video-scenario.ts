import type { VideoAgentSettings } from './video-agent-config';
import type { CommercialVideoAgentBrief } from './video-agent-brief';

export type CommercialVideoCategory =
  | 'product_ad'
  | 'restaurant_ad'
  | 'app_or_saas_promo'
  | 'ugc_style'
  | 'luxury_product'
  | 'local_business'
  | 'food_beverage'
  | 'beauty_fashion'
  | 'tech_gadget'
  | 'other';

export type CommercialVideoTimelineBeat = {
  timeRange: string;
  beat: string;
  visualAction: string;
  camera: string;
};

export type CommercialVideoScenario = {
  category: CommercialVideoCategory;
  intent: string;
  subject: string;
  location: string;
  timeline: CommercialVideoTimelineBeat[];
  camera: string;
  lighting: string;
  mood: string;
  composition: string;
  audioDirection: string;
  finalFrame: string;
};

function inferCategory(brief: CommercialVideoAgentBrief): CommercialVideoCategory {
  const text = `${brief.productOrOffer} ${brief.scene} ${brief.visualStyle}`.toLowerCase();
  if (/restaurant|pasta|dinner|cafe|coffee|food|dish/.test(text)) return 'food_beverage';
  if (/app|saas|software|dashboard|productivity/.test(text)) return 'app_or_saas_promo';
  if (/ugc|creator|selfie|smartphone/.test(text)) return 'ugc_style';
  if (/watch|gadget|tech/.test(text)) return 'tech_gadget';
  if (/luxury|premium|cinematic/.test(text)) return 'luxury_product';
  return 'product_ad';
}

function compositionFor(aspectRatio: VideoAgentSettings['aspectRatio']): string {
  if (aspectRatio === '16:9') {
    return 'wide 16:9 cinematic composition, product readable, uncluttered environment, safe CTA area';
  }
  if (aspectRatio === '1:1') {
    return 'square 1:1 composition, centered product hero, balanced negative space, clean social feed framing';
  }
  return 'vertical 9:16 mobile-first composition, centered subject, clean negative space near the bottom for CTA';
}

function defaultCamera(brief: CommercialVideoAgentBrief): string {
  if (/ugc|selfie|smartphone/i.test(brief.visualStyle)) return 'gentle handheld smartphone movement';
  if (/restaurant|food|coffee|cafe/i.test(`${brief.productOrOffer} ${brief.scene}`)) {
    return 'smooth close-up push-in, then gentle pull-back';
  }
  return 'smooth slow push-in with controlled commercial framing';
}

function defaultLighting(brief: CommercialVideoAgentBrief): string {
  if (/restaurant|evening|dinner/i.test(`${brief.productOrOffer} ${brief.scene}`)) {
    return 'warm evening practical lights, soft highlights, shallow depth of field';
  }
  if (/studio|tech|watch|gadget/i.test(`${brief.productOrOffer} ${brief.scene}`)) {
    return 'soft diffused studio lighting with subtle rim light';
  }
  return 'soft natural light with clean commercial contrast';
}

function buildTimeline(brief: CommercialVideoAgentBrief, settings: VideoAgentSettings): CommercialVideoTimelineBeat[] {
  const camera = defaultCamera(brief);
  if (settings.durationSec === 5) {
    return [
      {
        timeRange: '0-1.5s',
        beat: 'Open directly on the product',
        visualAction: `${brief.productOrOffer} is immediately visible in ${brief.scene}.`,
        camera,
      },
      {
        timeRange: '1.5-4s',
        beat: 'One clear product action',
        visualAction: `Show ${brief.mainBenefit} through one simple visual action.`,
        camera,
      },
      {
        timeRange: '4-5s',
        beat: 'Hero shot and CTA',
        visualAction: `End on a clean hero shot with the CTA "${brief.cta}".`,
        camera: 'locked-off final hero shot',
      },
    ];
  }

  if (settings.durationSec === 15) {
    return [
      {
        timeRange: '0-3s',
        beat: 'Establish the situation',
        visualAction: `Show ${brief.audience} in ${brief.scene}.`,
        camera,
      },
      {
        timeRange: '3-6s',
        beat: 'Introduce the product',
        visualAction: `Introduce ${brief.productOrOffer} clearly as the focus of the scene.`,
        camera,
      },
      {
        timeRange: '6-10s',
        beat: 'Use or reveal',
        visualAction: `Show ${brief.mainBenefit} through natural motion and realistic timing.`,
        camera,
      },
      {
        timeRange: '10-13s',
        beat: 'Benefit moment',
        visualAction: `Make the benefit feel visible, simple, and commercial.`,
        camera,
      },
      {
        timeRange: '13-15s',
        beat: 'Final frame',
        visualAction: `End on a clean final frame with the CTA "${brief.cta}".`,
        camera: 'locked-off final hero shot',
      },
    ];
  }

  return [
    {
      timeRange: '0-3s',
      beat: 'Visual hook',
      visualAction: `Open on ${brief.productOrOffer} in ${brief.scene}.`,
      camera,
    },
    {
      timeRange: '3-7s',
      beat: 'Main product action',
      visualAction: `Show ${brief.mainBenefit} with one readable commercial action.`,
      camera,
    },
    {
      timeRange: '7-10s',
      beat: 'Benefit and CTA',
      visualAction: `Resolve on a polished product hero shot with the CTA "${brief.cta}".`,
      camera: 'gentle pull-back to final hero shot',
    },
  ];
}

export function buildCommercialVideoScenario(
  brief: CommercialVideoAgentBrief,
  settings: VideoAgentSettings
): CommercialVideoScenario {
  return {
    category: inferCategory(brief),
    intent: `${brief.marketingGoal} commercial for ${brief.productOrOffer}`,
    subject: brief.productOrOffer,
    location: brief.scene,
    timeline: buildTimeline(brief, settings),
    camera: defaultCamera(brief),
    lighting: defaultLighting(brief),
    mood: brief.brandTone || brief.visualStyle,
    composition: compositionFor(settings.aspectRatio),
    audioDirection: settings.audioEnabled
      ? 'soft commercial music and subtle natural sound effects, no spoken dialogue'
      : 'no audio required; the visual story must be understandable without sound',
    finalFrame: `clean hero shot of ${brief.productOrOffer} with the CTA "${brief.cta}"`,
  };
}
