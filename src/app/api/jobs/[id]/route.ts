import { NextResponse } from "next/server";
import { getJobById, serializeJob } from "@/db/repositories/jobs-repo";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const job = await getJobById(params.id);
  if (!job) {
    return NextResponse.json(
      { error: `Job ${params.id} not found` },
      { status: 404 },
    );
  }
  return NextResponse.json({ job: serializeJob(job) });
}
