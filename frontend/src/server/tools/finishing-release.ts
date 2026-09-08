import type { FinishingProfile } from './finishing-providers';

type Qualification = {
  profileId: string; evidence: string; qualityPassed: boolean; billingPassed: boolean;
  proImprovementPassed?: boolean;
};
/** Add an explicit, reviewed evidence record after the paid corpus comparison.
 * Environment switches cannot turn an unqualified candidate into a released tool.
 */
export const FINISHING_QUALIFICATIONS: readonly Qualification[] = [];
export function isFinishingProfileReleased(profile: FinishingProfile, quality: 'standard' | 'pro'): boolean {
  return FINISHING_QUALIFICATIONS.some(item => item.profileId === profile.id && item.evidence.length > 0 && item.qualityPassed && item.billingPassed && (quality === 'standard' || item.proImprovementPassed === true));
}
export function requireFinishingProfileReleased(profile: FinishingProfile, quality: 'standard' | 'pro') {
  if (!isFinishingProfileReleased(profile, quality)) throw new Error('TOOL_QUALIFICATION_REQUIRED');
}
