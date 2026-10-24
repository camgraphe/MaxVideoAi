import { VIDEO_OPERATION_TARIFF_POLICY, VIDEO_OPERATION_TARIFF_SCOPE } from '@/server/pricing/video-operation-tariff-policy';
const stableJson = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object'
  && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);
import type { ModifyReleaseIdentity } from './modify-release-input';
export { assertModifyReleaseGit, assertModifyReleasePullRequest, modifyReleasePullRequestArguments } from './modify-release-input';

export type VideoOperationReleaseReview = ModifyReleaseIdentity & { policy: string; fingerprint: string; sourceRevision: number;
  insertedCells: number; approved: false; activationReady: false; existingPricesChanged: false; scope: typeof VIDEO_OPERATION_TARIFF_SCOPE };
export function assertVideoOperationReleaseReview(value: unknown, identity: ModifyReleaseIdentity,
  currentProposal?: unknown): asserts value is VideoOperationReleaseReview {
  const review = value as Partial<VideoOperationReleaseReview> | null;
  if (!review || review.actorId !== identity.actorId || review.candidateCommit !== identity.candidateCommit
    || review.databaseIdentity !== identity.databaseIdentity || review.releaseBranch !== identity.releaseBranch
    || review.policy !== VIDEO_OPERATION_TARIFF_POLICY || !/^[0-9a-f]{64}$/.test(review.fingerprint ?? '')
    || !Number.isSafeInteger(review.sourceRevision) || review.sourceRevision! < 0 || review.insertedCells !== 89
    || review.approved !== false || review.activationReady !== false || review.existingPricesChanged !== false || stableJson(review.scope) !== stableJson(VIDEO_OPERATION_TARIFF_SCOPE)
    || (currentProposal !== undefined && stableJson(value) !== stableJson(currentProposal))) {
    throw new Error('Reviewed video operation release identity or scope changed.');
  }
}
