import { notFound } from 'next/navigation';
import { FEATURES } from '@/content/feature-flags';
import { isFinishingToolId, FINISHING_QUALITY_CHOICES } from '@/lib/toolbox/finishing';
import { FINISHING_PROFILES } from '@/server/tools/finishing-providers';
import { isFinishingProfileReleased } from '@/server/tools/finishing-release';
import FinishingWorkspace from '@/components/tools/FinishingWorkspace';
export default async function ToolPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  if (!FEATURES.workflows.toolsSection || !isFinishingToolId(toolId)) notFound();
  const releasedQualities = FINISHING_QUALITY_CHOICES[toolId].filter(quality => {
    const profile = FINISHING_PROFILES[toolId][quality];
    return profile && isFinishingProfileReleased(profile, quality);
  });
  return <FinishingWorkspace toolId={toolId} releasedQualities={releasedQualities} />;
}
