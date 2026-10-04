import { seedanceWorkflowEnabled } from '@/server/seedance-workflow-request';
import AppClientPage from './AppClient';
import { headers } from 'next/headers';
import { resolveInitialAppPreviewGroup } from '@/server/app-initial-preview';
import { allowLocalSeedanceDraftPreview } from './_lib/seedance-draft-local-preview-gate';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function hasTargetedPreview(params: SearchParams): boolean {
  return Boolean(params.engine || params.engineId || params.job || params.from);
}

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {};
  const initialPreviewGroup = hasTargetedPreview(params) ? null : await resolveInitialAppPreviewGroup();
  const localSeedanceDraftPreview = params.draftPreview === '1' && allowLocalSeedanceDraftPreview({
    requested: params.draftPreview,
    host: (await headers()).get('host'),
    environment: process.env.NODE_ENV,
    sandbox: process.env.PRICING_SANDBOX,
  });

  const seedanceDraftWorkflowEnabled = seedanceWorkflowEnabled(`http://${(await headers()).get('host') ?? 'invalid'}`);

  return <AppClientPage seedanceDraftWorkflowEnabled={seedanceDraftWorkflowEnabled} initialPreviewGroup={initialPreviewGroup} localSeedanceDraftPreview={localSeedanceDraftPreview} />;
}
