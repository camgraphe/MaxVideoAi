import { FLUX_3_MAX_TARIFF_POLICY, FLUX_3_MAX_TARIFF_SCOPE } from '@/server/pricing/flux-3-max-tariff-policy';

export type Flux3MaxReleaseIdentity = { actorId: string; candidateCommit: string; databaseIdentity: string };
export type Flux3MaxReleaseReview = Flux3MaxReleaseIdentity & {
  policy: string; fingerprint: string; sourceRevision: number; insertedCells: number;
  scope: typeof FLUX_3_MAX_TARIFF_SCOPE; existingPricesChanged: false;
};

export function assertFlux3MaxReleaseReview(value: unknown, identity: Flux3MaxReleaseIdentity): asserts value is Flux3MaxReleaseReview {
  const review = value as Partial<Flux3MaxReleaseReview> | null;
  if (!review || review.actorId !== identity.actorId || review.candidateCommit !== identity.candidateCommit
    || review.databaseIdentity !== identity.databaseIdentity || review.policy !== FLUX_3_MAX_TARIFF_POLICY
    || !/^[0-9a-f]{64}$/.test(review.fingerprint ?? '') || !Number.isSafeInteger(review.sourceRevision)
    || review.sourceRevision! < 0 || review.insertedCells !== 128 || review.existingPricesChanged !== false
    || JSON.stringify(review.scope) !== JSON.stringify(FLUX_3_MAX_TARIFF_SCOPE)) {
    throw new Error('The reviewed FLUX 3 Max release identity or scope does not match.');
  }
}
