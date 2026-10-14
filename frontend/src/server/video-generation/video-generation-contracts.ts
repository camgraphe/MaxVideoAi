import type { TrustedIncludedTrialBilling, TrustedQuotedBilling, WalletReservation } from '@/server/generations/initial-job-reservation';
import type { ResolvedReference } from '@/server/agent-api/reference-types';

export type VideoGenerationReservationOptions =
  | ({ walletReservation: WalletReservation } & {
      walletReservation: 'reserve';
      preReservedInitialState?: never;
      trustedQuotedBilling?: never;
      funding?: never;
      trustedIncludedTrialBilling?: never;
    })
  | ({ walletReservation: WalletReservation } & {
      walletReservation: 'already_reserved';
      preReservedInitialState: PreReservedVideoInitialState;
      trustedQuotedBilling: TrustedQuotedBilling;
      trustedResolvedReferences: readonly ResolvedReference[];
      funding?: never;
      trustedIncludedTrialBilling?: never;
    })
  | {
      funding: { kind: 'mcp_trial'; entitlementUserId: string; quoteId: string };
      walletReservation?: never;
      preReservedInitialState: Extract<PreReservedVideoInitialState, { funding: unknown }>;
      trustedQuotedBilling?: never;
      trustedIncludedTrialBilling: TrustedIncludedTrialBilling;
    };

export type VideoGenerationResponse = {
  body: Record<string, unknown>;
  status?: number;
};

export type PreReservedVideoInitialState =
  | {
      kind: 'created';
      jobId: string;
      walletChargeReserved: true;
    }
  | {
      kind: 'created';
      jobId: string;
      funding: {
        kind: 'mcp_trial';
        entitlementUserId: string;
        quoteId: string;
      };
    };

export type VideoGenerationAdapters = {
  submitBytePlusGenerateTask: (typeof import('@/app/api/generate/_lib/byteplus-submission'))['submitBytePlusGenerateTask'];
  submitGenerateProviderTask: (typeof import('@/app/api/generate/_lib/video-provider-submission'))['submitGenerateProviderTask'];
  buildInitialProviderMediaState: (typeof import('@/app/api/generate/_lib/provider-media'))['buildInitialProviderMediaState'];
  resolveProviderMediaState: (typeof import('@/app/api/generate/_lib/provider-media'))['resolveProviderMediaState'];
  buildMissingProviderJobIdResponse: (typeof import('@/app/api/generate/_lib/missing-provider-job'))['buildMissingProviderJobIdResponse'];
};
