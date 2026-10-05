import {redirect} from 'next/navigation';
import {resolveStudioPageAccess} from '@/server/studio/access';
import {readStudioConversationProjectId} from '@/server/studio/conversation-project-list';

export const dynamic = 'force-dynamic';
export default async function RetiredStudioProjectPage({params}: {params: Promise<{projectId: string}>}) {
  const access = await resolveStudioPageAccess();
  if (!access.ok) redirect('/app/studio');
  const {projectId} = await params;
  const connectedProjectId = await readStudioConversationProjectId(access.userId,projectId);
  redirect(connectedProjectId
    ? `/app/studio/conversation/${encodeURIComponent(connectedProjectId)}`
    : '/app/studio');
}
