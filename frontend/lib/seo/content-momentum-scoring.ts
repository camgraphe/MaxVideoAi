import type { SeoActionPriority, SeoSourceMetrics } from './internal-seo-types';
import { classifyMissingContentIntent } from './missing-content';
import { getBusinessPriorityWeight, getSeoFamilyStatus, normalizeSeoQuery } from './seo-intents';
import type { MomentumDraft } from './content-momentum';

const STRATEGIC_FAMILIES = new Set(['Seedance', 'Kling', 'Veo', 'LTX']);

export function scoreMomentumDraft(
  draft: MomentumDraft,
  clickDelta: number,
  impressionDelta: number,
  ctrDelta: number
) {
  const maxImpressions = Math.max(draft.current.impressions, draft.previous.impressions);
  const deltaMagnitude = Math.abs(impressionDelta) + Math.abs(clickDelta) * 8;
  const volumeScore = Math.min(34, Math.log10(Math.max(maxImpressions, 1)) * 14);
  const deltaScore = Math.min(34, Math.log10(Math.max(deltaMagnitude, 1)) * 16);
  const positionScore = draft.current.averagePosition <= 6 ? 14 : draft.current.averagePosition <= 12 ? 10 : draft.current.averagePosition <= 30 ? 3 : -10;
  const ctrScore = draft.type.includes('declining') || draft.type === 'refresh_candidate' ? Math.min(10, Math.max(0, -ctrDelta * 220)) : Math.min(8, Math.max(0, ctrDelta * 180));
  return Math.round((volumeScore + deltaScore + positionScore + ctrScore + draft.scoreBoost) * getBusinessPriorityWeight(draft.family));
}

export function calibrateScore(draft: MomentumDraft, rawScore: number) {
  const status = getSeoFamilyStatus(draft.family);
  const maxImpressions = Math.max(draft.current.impressions, draft.previous.impressions);
  const impressionDelta = Math.abs(draft.current.impressions - draft.previous.impressions);
  const currentImpressions = draft.current.impressions;
  const clickDelta = Math.abs(draft.current.clicks - draft.previous.clicks);
  if (draft.family === 'Brand') {
    return Math.min(rawScore, isBrandTypoMomentum(draft) ? 75 : 103);
  }
  if (maxImpressions < 35 || impressionDelta < 20) return Math.min(rawScore, 48);
  if (draft.type === 'mixed_family_momentum') return Math.min(rawScore, 48);
  if ((draft.type === 'declining_cluster' || draft.type === 'declining_page') && currentImpressions < 20 && maxImpressions < 80) {
    return Math.min(rawScore, 48);
  }
  if (currentImpressions < 50 && maxImpressions < 90) return Math.min(rawScore, 75);
  if (draft.current.averagePosition >= 30 && maxImpressions < 250) return Math.min(rawScore, 48);
  if (draft.type === 'watchlist') return Math.min(rawScore, 48);
  if (draft.type === 'outdated_model_attention') return Math.min(rawScore, 48);
  if (draft.family === 'Sora') return Math.min(rawScore, 48);
  if (status === 'emerging' && maxImpressions < 120) return Math.min(rawScore, 48);
  if (status === 'emerging') return Math.min(rawScore, 62);
  if ((draft.type === 'rising_family' || draft.type === 'declining_family') && maxImpressions < 100) return Math.min(rawScore, 58);
  if (rawScore >= 104 && !isCriticalEligible(draft, impressionDelta, clickDelta)) return Math.min(rawScore, 103);
  return rawScore;
}

export function scoreToPriority(score: number): SeoActionPriority {
  if (score >= 104) return 'critical';
  if (score >= 76) return 'high';
  if (score >= 52) return 'medium';
  return 'low';
}

export function classifyTrend(current: SeoSourceMetrics, previous: SeoSourceMetrics): 'gaining' | 'declining' | null {
  const maxImpressions = Math.max(current.impressions, previous.impressions);
  const impressionDelta = current.impressions - previous.impressions;
  const clickDelta = current.clicks - previous.clicks;
  const relativeImpressionDelta = previous.impressions ? impressionDelta / previous.impressions : current.impressions ? 1 : 0;
  const relativeClickDelta = previous.clicks ? clickDelta / previous.clicks : current.clicks ? 1 : 0;

  if (maxImpressions < 20) return null;
  if (Math.abs(impressionDelta) < 20 && Math.abs(clickDelta) < 4) return null;

  if (
    (impressionDelta >= 40 && relativeImpressionDelta >= 0.25) ||
    (clickDelta >= 5 && relativeClickDelta >= 0.25)
  ) {
    return 'gaining';
  }
  if (
    (impressionDelta <= -40 && relativeImpressionDelta <= -0.25) ||
    (clickDelta <= -5 && relativeClickDelta <= -0.25)
  ) {
    return 'declining';
  }
  return null;
}

export function classifyMixedFamilyMomentum(current: SeoSourceMetrics, previous: SeoSourceMetrics): boolean {
  const impressionDelta = current.impressions - previous.impressions;
  const clickDelta = current.clicks - previous.clicks;
  const positionDelta = current.averagePosition - previous.averagePosition;
  const clicksRising = clickDelta >= 5;
  const impressionsFalling = impressionDelta <= -40;
  const positionWorse = positionDelta >= 3 && current.averagePosition > 12;
  const clicksFalling = clickDelta <= -5;
  const impressionsRising = impressionDelta >= 40;
  return (clicksRising && (impressionsFalling || positionWorse)) || (clicksFalling && impressionsRising);
}

export function isWorthMomentumItem(draft: MomentumDraft) {
  const maxImpressions = Math.max(draft.current.impressions, draft.previous.impressions);
  const impressionDelta = Math.abs(draft.current.impressions - draft.previous.impressions);
  const clickDelta = Math.abs(draft.current.clicks - draft.previous.clicks);
  const status = getSeoFamilyStatus(draft.family);

  if (draft.type === 'outdated_model_attention') return draft.current.impressions >= 50;
  if (maxImpressions < 20) return false;
  if (impressionDelta < 20 && clickDelta < 4) return false;
  if (status === 'emerging') return maxImpressions >= 35 && impressionDelta >= 15;
  if (draft.type === 'mixed_family_momentum') return maxImpressions >= 80 && (impressionDelta >= 40 || clickDelta >= 5);
  if (draft.type === 'rising_family' || draft.type === 'declining_family') return maxImpressions >= 80 && impressionDelta >= 50;
  return true;
}

export function isJunkMomentumDraft(draft: MomentumDraft) {
  const text = normalizeSeoQuery([
    draft.pageUrl,
    draft.queryCluster,
    draft.family,
    ...draft.representativeQueries,
  ].filter(Boolean).join(' '));
  if (isAdultOrJunkText(text)) return true;
  return draft.representativeQueries.some((query) => classifyMissingContentIntent(query) === 'irrelevant_junk');
}

function isCriticalEligible(draft: MomentumDraft, impressionDelta: number, clickDelta: number) {
  const hasAbsoluteSignal = draft.current.impressions >= 250 || impressionDelta >= 150;
  const hasClickSignal = draft.current.clicks >= 20 || clickDelta >= 15;
  const nearPageOne = draft.current.averagePosition > 0 && draft.current.averagePosition <= 12;
  const strategic = STRATEGIC_FAMILIES.has(draft.family);
  if (hasAbsoluteSignal && hasClickSignal && nearPageOne) return true;
  return strategic && nearPageOne && draft.current.impressions >= 120 && impressionDelta >= 80 && hasClickSignal;
}

function isBrandTypoMomentum(draft: MomentumDraft) {
  const text = normalizeSeoQuery([draft.queryCluster, ...draft.representativeQueries].filter(Boolean).join(' '));
  return /\bmaxvedio\b|\bmaxvideos\b|\bmax videoa\b|\bmaxvideai\b|\bmax vidio\b/.test(text);
}

function isAdultOrJunkText(value: string) {
  return /\b(?:porn|porno|nsfw|nude|naked|sex|sexy|xxx|onlyfans|casino|gambling|torrent|crack|hack)\b/.test(value);
}
