import { parseCurationDraft } from "@/lib/admin/playlist-curation";
import { NextRequest, NextResponse } from "next/server";
import { adminErrorToResponse, requireAdmin } from "@/server/admin";
import {
  getCurationSnapshot,
  listCurationCandidates,
  previewCuration,
  saveCuration,
  CurationError,
} from "@/server/playlists/curation-service";
import { listExampleFamilyPage, listPlaylistVideos } from "@/server/videos";

async function readInput(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    throw new CurationError("Invalid JSON request", 400);
  }
  if (typeof body?.revision !== "string")
    throw new CurationError("Missing revision", 400);
  try {
    return { ...body, draft: parseCurationDraft(body.draft) };
  } catch (error) {
    throw new CurationError((error as Error).message, 400);
  }
}
type Context = { params: Promise<{ playlistId: string }> };
function failure(error: unknown) {
  if (error instanceof CurationError)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  console.error("[admin/curation]", error);
  return NextResponse.json(
    { ok: false, error: "Unable to load or save site placements." },
    { status: 500 },
  );
}
export async function GET(req: NextRequest, context: Context) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  try {
    const { playlistId } = await context.params;
    const snapshot = await getCurationSnapshot(playlistId);
    if (!snapshot.available || !snapshot.supported)
      return NextResponse.json({
        ok: true,
        snapshot,
        candidates: [],
        initialIds: [],
      });
    const candidates = await listCurationCandidates(snapshot.slug);
    const current = snapshot.config
      ? []
      : snapshot.slug.startsWith("family-")
        ? (
            await listExampleFamilyPage(snapshot.slug.slice(7), {
              sort: "playlist",
              limit: 2001,
              offset: 0,
            })
          ).items
        : await listPlaylistVideos(snapshot.slug, 2001);
    if (current.length > 2000)
      throw new CurationError(
        "This destination has more than 2,000 videos. Its existing feed is preserved; prepare a bounded migration before adopting a new order.",
        409,
      );
    const eligible = new Set(candidates.map((item) => item.id));
    const initialIds =
      snapshot.config?.orderedIds ?? current.map((item) => item.id);
    return NextResponse.json({
      ok: true,
      snapshot,
      candidates,
      initialIds: initialIds.filter((id) => eligible.has(id)),
      removedCount: initialIds.filter((id) => !eligible.has(id)).length,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: NextRequest, context: Context) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  try {
    const body = await readInput(req);
    const { playlistId } = await context.params;
    return NextResponse.json({
      ok: true,
      preview: await previewCuration(playlistId, body.draft, body.revision),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(req: NextRequest, context: Context) {
  let actor: string;
  try {
    actor = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  try {
    const body = await readInput(req);
    const { playlistId } = await context.params;
    if (typeof body?.revision !== "string" || typeof body?.token !== "string")
      return NextResponse.json(
        { ok: false, error: "Preview this selection before saving." },
        { status: 400 },
      );
    const snapshot = await saveCuration(
      playlistId,
      body.draft,
      body.revision,
      body.token,
      actor,
    );
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return failure(error);
  }
}
