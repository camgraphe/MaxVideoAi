import AppClientPage from './AppClient';
import { resolveInitialAppPreviewGroup } from '@/server/app-initial-preview';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function hasTargetedPreview(params: SearchParams): boolean {
  return Boolean(params.engine || params.engineId || params.job || params.from);
}

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {};
  const initialPreviewGroup = hasTargetedPreview(params) ? null : await resolveInitialAppPreviewGroup();

  return <AppClientPage initialPreviewGroup={initialPreviewGroup} />;
}
