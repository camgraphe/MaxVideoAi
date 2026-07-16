import type { ImageGenerationRequest } from '@/types/image-generation';
import type { BillingProductKey, JobSurface } from '@/types/billing';
import type {
  TrustedQuotedBilling,
  WalletReservation,
} from '@/server/generations/initial-job-reservation';

export type PreReservedImageInitialState = {
  kind: 'created';
  jobId: string;
  recoveredCharge: true;
};

type ImageGenerationReservationOptions =
  | ({ walletReservation: WalletReservation } & {
      walletReservation: 'reserve';
      preReservedInitialState?: never;
      trustedQuotedBilling?: never;
    })
  | ({ walletReservation: WalletReservation } & {
      walletReservation: 'already_reserved';
      preReservedInitialState: PreReservedImageInitialState;
      trustedQuotedBilling: TrustedQuotedBilling;
    });

export type ExecuteImageGenerationOptions = {
  userId: string;
  body: Partial<ImageGenerationRequest>;
  settingsSnapshot?: unknown;
  jobSurface?: JobSurface;
  billingProductKey?: BillingProductKey | null;
  billingQuantityMultiplier?: number;
  isAdminForDirectProvider?: boolean;
} & ImageGenerationReservationOptions;
