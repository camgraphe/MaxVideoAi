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
