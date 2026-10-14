export type SeedanceWorkflowReleaseIdentity = { actorId: string; candidateCommit: string; databaseIdentity: string };
export type SeedanceWorkflowReleaseReview = SeedanceWorkflowReleaseIdentity & {
  policy: string; fingerprint: string; sourceRevision: number; insertedCells: number;
};

export function assertSeedanceWorkflowReleaseReview(value: unknown, identity: SeedanceWorkflowReleaseIdentity): asserts value is SeedanceWorkflowReleaseReview {
  const review = value as Partial<SeedanceWorkflowReleaseReview> | null;
  if (!review || review.actorId !== identity.actorId || review.candidateCommit !== identity.candidateCommit
    || review.databaseIdentity !== identity.databaseIdentity || review.policy !== 'clone_current_normal_multimodal_prices_v1'
    || !/^[0-9a-f]{64}$/.test(review.fingerprint ?? '') || !Number.isSafeInteger(review.sourceRevision)
    || review.sourceRevision! < 0 || !Number.isSafeInteger(review.insertedCells) || review.insertedCells! <= 0) {
    throw new Error('The reviewed workflow release identity or scope does not match.');
  }
}
