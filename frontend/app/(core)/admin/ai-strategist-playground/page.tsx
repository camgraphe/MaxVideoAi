import { notFound } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AI_STRATEGIST_BETA_NAME } from '@/lib/ai-strategist/branding';
import { AI_STRATEGIST_MODELS } from '@/lib/ai-strategist/model-catalog';
import { isAiStrategistPlaygroundEnabled } from '@/lib/ai-strategist/playground-pipeline';
import { AI_STRATEGIST_WORKFLOWS } from '@/lib/ai-strategist/workflow-rules';
import { AiStrategistChatClient } from './_components/AiStrategistChatClient';
import { AiStrategistPlaygroundClient } from './_components/AiStrategistPlaygroundClient';

export const dynamic = 'force-dynamic';

export default function AiStrategistPlaygroundPage() {
  if (!isAiStrategistPlaygroundEnabled()) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Dev"
        title={`${AI_STRATEGIST_BETA_NAME} Playground`}
        description="Internal preview of the compact Generate Video strategist widget."
      />

      <AiStrategistChatClient />

      <AdminSection
        title="Technical Debug Playground"
        description="Form-based pipeline inspector kept for low-level debugging. The chat view above is the primary internal user-experience test surface."
      >
        <details className="rounded-xl border border-hairline bg-bg/40">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text-primary">
            Open technical debug form
          </summary>
          <div className="border-t border-hairline px-4 py-4">
            <AiStrategistPlaygroundClient
              modelOptions={AI_STRATEGIST_MODELS.map((model) => ({ id: model.id, label: model.label }))}
              workflowOptions={AI_STRATEGIST_WORKFLOWS.map((workflow) => ({ id: workflow.id, label: workflow.label }))}
            />
          </div>
        </details>
      </AdminSection>
    </div>
  );
}
