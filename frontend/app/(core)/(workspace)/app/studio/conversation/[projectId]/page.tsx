import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeaderBar } from "@/components/HeaderBar";
import { AppSidebar } from "@/components/AppSidebar";
import { resolveStudioPageAccess } from "@/server/studio/access";
import { readImageConversationProject } from "@/server/studio/image-conversation-repository";
import StudioPreviewAccess from "../../projects/StudioPreviewAccess.client";
import StudioImageConversation from "./StudioImageConversation.client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Studio | MaxVideoAI",
  robots: { index: false, follow: false },
};
export default async function StudioConversationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  if (process.env.STUDIO_IMAGE_CONVERSATION_ENABLED !== "true") notFound();
  const access = await resolveStudioPageAccess();
  if (!access.ok && access.status === 404) notFound();
  const { projectId } = await params;
  const project = access.ok
    ? await readImageConversationProject(access.userId, projectId).catch(
        () => null,
      )
    : null;
  if (access.ok && !project) notFound();
  return (
    <div className="flex h-[calc(100dvh-var(--app-bottom-nav-height,0px))] flex-col overflow-hidden bg-bg">
      <HeaderBar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
        <AppSidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {access.ok && project ? (
            <StudioImageConversation
              key={`${access.userId}:${projectId}`}
              projectId={projectId}
              accountKey={access.userId}
              projectName={project.name}
            />
          ) : (
            <StudioPreviewAccess
              visitor={!access.ok && access.status === 401}
            />
          )}
        </main>
      </div>
    </div>
  );
}
