import type { NextRequest } from "next/server";
import { handleStudioImageConversation } from "../../../_lib/studio-image-conversation-handler";
export const runtime = "nodejs";
export const maxDuration = 120;
type Context = { params: Promise<{ projectId: string }> };
export async function GET(req: NextRequest, context: Context) {
  return handleStudioImageConversation(
    req,
    (await context.params).projectId,
    "read",
  );
}
export async function POST(req: NextRequest, context: Context) {
  return handleStudioImageConversation(
    req,
    (await context.params).projectId,
    "submit",
  );
}
