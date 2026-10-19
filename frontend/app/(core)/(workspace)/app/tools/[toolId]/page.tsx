import { notFound } from 'next/navigation';
import { FEATURES } from '@/content/feature-flags';
import { isFinishingToolId, FINISHING_QUALITY_CHOICES } from '@/lib/toolbox/finishing';
import { FINISHING_PROFILES } from '@/server/tools/finishing-providers';
import { isFinishingProfileReleased } from '@/server/tools/finishing-release';
import CreatorWorkspace from '@/components/tools/creator/CreatorWorkspace.client';
import SubtitleWorkspace from '@/components/tools/creator/SubtitleWorkspace.client';
import { CREATOR_TOOL_IDS } from '@/lib/toolbox/creator-tools';
import { isCreatorMotionControlEnabled, listCreatorToolProfiles } from '@/server/tools/creator-profiles';
import { isCreatorExecutionEnabled } from '@/server/tools/creator-availability';
import FinishingWorkspace from '@/components/tools/FinishingWorkspace';
export default async function ToolPage({ params, searchParams }: { params: Promise<{ toolId: string }>; searchParams?: Promise<Record<string,string | string[] | undefined>> }) {
  const { toolId } = await params;
  const creatorId = CREATOR_TOOL_IDS.find(id => id === toolId);
  if (toolId === 'subtitles' || creatorId) {
    const query = await searchParams, enabled = isCreatorExecutionEnabled();
    const operationId = query?.operation;
    if (operationId !== undefined && (typeof operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId))) notFound();
    if (toolId === 'subtitles') {
      const documentId = query?.document, revisionValue = query?.revision;
      const projectId = query?.project, sequenceId = query?.sequence, sequenceRevision = query?.sequenceRevision;
      let studioSource: {projectId:string;sequenceId:string;expectedRevision:number} | undefined;
      if (projectId !== undefined || sequenceId !== undefined || sequenceRevision !== undefined) {
        if (typeof projectId !== 'string' || !/^[a-zA-Z0-9._:-]{1,200}$/.test(projectId) || typeof sequenceId !== 'string' || !/^[a-zA-Z0-9._:-]{1,200}$/.test(sequenceId) || typeof sequenceRevision !== 'string' || !Number.isSafeInteger(Number(sequenceRevision)) || Number(sequenceRevision) < 1) notFound();
        studioSource = {projectId,sequenceId,expectedRevision:Number(sequenceRevision)};
      }
      if (documentId !== undefined && (typeof documentId !== 'string' || !/^[a-zA-Z0-9._:-]{1,200}$/.test(documentId))) notFound();
      const revision = revisionValue === undefined ? undefined : Number(revisionValue);
      if (revision !== undefined && (Array.isArray(revisionValue) || !Number.isSafeInteger(revision) || revision < 1)) notFound();
      if (!enabled && !documentId && !operationId) notFound();
      // The authenticated read API verifies ownership before exposing any document or result.
      return <SubtitleWorkspace studioSource={studioSource} executionEnabled={enabled} initialOperationId={operationId} initialDocument={documentId ? {id:documentId,revision} : undefined} />;
    }
    if (!enabled && !operationId) notFound();
    return <CreatorWorkspace toolId={creatorId!} executionEnabled={enabled} initialOperationId={operationId} motionControlEnabled={isCreatorMotionControlEnabled()} profiles={listCreatorToolProfiles({enabled}).filter(profile => profile.toolId === creatorId)} />;
  }
  if (!FEATURES.workflows.toolsSection || !isFinishingToolId(toolId)) notFound();
  const releasedQualities = FINISHING_QUALITY_CHOICES[toolId].filter(quality => {
    const profile = FINISHING_PROFILES[toolId][quality];
    return profile && isFinishingProfileReleased(profile, quality);
  });
  return <FinishingWorkspace toolId={toolId} releasedQualities={releasedQualities} />;
}
