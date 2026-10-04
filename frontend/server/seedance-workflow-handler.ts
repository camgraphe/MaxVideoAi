import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { seedanceWorkflowEnabled } from '@/server/seedance-workflow-request';
import { readOwnedSeedanceWorkflowView } from '@/server/seedance-workflow-view';

type Dependencies = {
  seedanceWorkflowEnabled: typeof seedanceWorkflowEnabled;
  getRouteAuthContext: (req: NextRequest) => Promise<{ userId: string | null }>;
  readOwnedSeedanceWorkflowView: typeof readOwnedSeedanceWorkflowView;
};
export function createSeedanceWorkflowGetHandler(deps: Dependencies = { seedanceWorkflowEnabled, getRouteAuthContext, readOwnedSeedanceWorkflowView }) {
  return async (req: NextRequest, props: { params: Promise<{ jobId: string }> }) => {
    const headers = { 'Cache-Control': 'private, no-store' };
    if (!deps.seedanceWorkflowEnabled(req.url)) return NextResponse.json({ error: 'Unavailable' }, { status: 404, headers });
    let userId: string | null;
    try { ({ userId } = await deps.getRouteAuthContext(req)); }
    catch { userId = null; }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    try {
      const { jobId } = await props.params;
      const view = await deps.readOwnedSeedanceWorkflowView(userId, jobId);
      return NextResponse.json(view, { status: view ? 200 : 404, headers });
    } catch {
      return NextResponse.json({ error: 'Workflow unavailable' }, { status: 503, headers });
    }
  };
}
