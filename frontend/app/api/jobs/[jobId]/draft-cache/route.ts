import { createFluxDraftCacheRecoveryHandler } from '@/server/flux-draft-cache-http';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const POST = createFluxDraftCacheRecoveryHandler();
