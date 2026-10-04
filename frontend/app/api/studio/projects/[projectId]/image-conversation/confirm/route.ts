import type { NextRequest } from "next/server";
import { handleStudioImageConversation } from "../../../../_lib/studio-image-conversation-handler";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  return handleStudioImageConversation(
    req,
    (await context.params).projectId,
    "confirm",
  );
}
