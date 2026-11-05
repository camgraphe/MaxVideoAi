import { OMNI_12_TARIFF_POLICY, OMNI_12_TARIFF_SCOPE } from '@/server/pricing/omni-12-tariff-policy';

export type Omni12ReleaseIdentity = { actorId: string; candidateCommit: string; databaseIdentity: string };
export type Omni12ReleaseReview = Omni12ReleaseIdentity & {
  policy: string; fingerprint: string; sourceRevision: number; updatedCells: number; scope: typeof OMNI_12_TARIFF_SCOPE;
};

export function assertOmni12ReleaseReview(value: unknown, identity: Omni12ReleaseIdentity): asserts value is Omni12ReleaseReview {
  const review = value as Partial<Omni12ReleaseReview> | null;
  if (!review || review.actorId !== identity.actorId || review.candidateCommit !== identity.candidateCommit
    || review.databaseIdentity !== identity.databaseIdentity || review.policy !== OMNI_12_TARIFF_POLICY
    || !/^[0-9a-f]{64}$/.test(review.fingerprint ?? '') || !Number.isSafeInteger(review.sourceRevision)
    || review.sourceRevision! < 0 || review.updatedCells !== OMNI_12_TARIFF_SCOPE.expectedCells
    || JSON.stringify(review.scope) !== JSON.stringify(OMNI_12_TARIFF_SCOPE)) {
    throw new Error('The reviewed Omni 1.2 target, candidate or price scope does not match.');
  }
}
