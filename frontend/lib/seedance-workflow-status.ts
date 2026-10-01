import { authFetch } from '@/lib/authFetch';
import type { SeedanceWorkflowView } from './seedance-workflow-contract';

/** Uses the existing authenticated job polling route for both linked tasks. */
export async function readSeedanceWorkflowStatus(jobId: string, token: string, fetcher: (url: string, init: RequestInit) => Promise<Response> = authFetch): Promise<SeedanceWorkflowView | null> {
  const init = { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' as const };
  const path = `/api/jobs/${encodeURIComponent(jobId)}`;
  const poll = async (url: string) => {
    const response = await fetcher(url, init);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error('Draft status unavailable.');
    return true;
  };
  const read = async () => {
    const response = await fetcher(`${path}/seedance-workflow`, init);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Draft status unavailable.');
    return await response.json() as SeedanceWorkflowView;
  };
  if (!await poll(path)) return null;
  const view = await read();
  if (view?.final && !['completed', 'failed'].includes(view.final.status)) {
    if (!await poll(`/api/jobs/${encodeURIComponent(view.final.jobId)}`)) throw new Error('Final status unavailable.');
    return read();
  }
  return view;
}
