import type { FinishingProfile } from './finishing-providers';

type ReleaseRecord = {
  profileId: string; evidence: string; qualityPassed?: boolean; billingPassed?: boolean;
  proImprovementPassed?: boolean;
  ownerApprovedPilot?: true;
};
/** Explicit release records. The owner-approved pilot keeps the full server-side
 * billing, ownership and idempotency guards while allowing production evaluation.
 * Unknown profiles remain closed by default.
 */
export const FINISHING_QUALIFICATIONS: readonly ReleaseRecord[] = [
  { profileId: 'restore-bytedance-standard-v1', evidence: 'owner-approved-production-pilot:2026-09-08', ownerApprovedPilot: true },
  { profileId: 'restore-bytedance-pro-v1', evidence: 'owner-approved-production-pilot:2026-09-08', ownerApprovedPilot: true },
  { profileId: 'denoise-nyx-fast-v1', evidence: 'owner-approved-production-pilot:2026-09-08', ownerApprovedPilot: true },
  { profileId: 'denoise-nyx-v1', evidence: 'owner-approved-production-pilot:2026-09-08', ownerApprovedPilot: true },
  { profileId: 'deblur-themis-v1', evidence: 'owner-approved-production-pilot:2026-09-08', ownerApprovedPilot: true },
  { profileId: 'motion-apollo-v1', evidence: 'owner-approved-production-pilot:2026-09-08', ownerApprovedPilot: true },
  { profileId: 'motion-aion-v1', evidence: 'owner-approved-production-pilot:2026-09-08', ownerApprovedPilot: true },
];
export function isFinishingProfileReleased(profile: FinishingProfile, quality: 'standard' | 'pro'): boolean {
  return FINISHING_QUALIFICATIONS.some(item => item.profileId === profile.id && item.evidence.length > 0 && (
    item.ownerApprovedPilot === true
    || (item.qualityPassed === true && item.billingPassed === true && (quality === 'standard' || item.proImprovementPassed === true))
  ));
}
export function requireFinishingProfileReleased(profile: FinishingProfile, quality: 'standard' | 'pro') {
  if (!isFinishingProfileReleased(profile, quality)) throw new Error('TOOL_QUALIFICATION_REQUIRED');
}
