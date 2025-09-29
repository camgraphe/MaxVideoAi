import { NextResponse } from "next/server";
import { jobParamsSchema } from "@/db/schema";
import {
  createJobRecord,
  getJobById,
  listJobs,
  serializeJob,
  updateJobRecord,
} from "@/db/repositories/jobs-repo";
import { simulateJobLifecycle } from "@/lib/jobs/job-runner";
import { getProviderAdapter } from "@/providers";
import { estimateCost } from "@/lib/pricing";
import { appConfig } from "@/lib/config";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = jobParamsSchema.parse(body);
    const confirm: boolean = Boolean(body?.confirm);
    const budgetCents: number =
      typeof body?.budgetCents === "number" && body.budgetCents >= 0
        ? body.budgetCents
        : appConfig.defaultBudgetCents;

    // Server-side price verification
    const serverEstimate = estimateCost({
      provider: payload.provider,
      engine: payload.engine,
      durationSeconds: payload.durationSeconds,
      withAudio: payload.withAudio,
      quantity: payload.quantity,
    });

    if (!confirm && serverEstimate.subtotalCents > budgetCents) {
      // Suggest a cheaper alternative for Veo 3 → Veo 3 Fast
      let suggestion: { engine?: string; estimatedCents?: number } | undefined;
      if (payload.engine === "veo3") {
        const alt = estimateCost({
          provider: payload.provider,
          engine: "veo3-fast",
          durationSeconds: payload.durationSeconds,
          withAudio: payload.withAudio,
          quantity: payload.quantity,
        });
        suggestion = { engine: "veo3-fast", estimatedCents: alt.subtotalCents };
      }

      return NextResponse.json(
        {
          code: "BUDGET_EXCEEDED",
          message: "Server-side estimate exceeds budget. Confirm to proceed.",
          serverCostCents: serverEstimate.subtotalCents,
          budgetCents,
          suggestion,
        },
        { status: 409 },
      );
    }

    const metadataRecord = { ...(payload.metadata ?? {}) } as Record<string, unknown>;
    if (payload.modelId) {
      metadataRecord.modelId = payload.modelId;
    }
    if (payload.negativePrompt) {
      metadataRecord.negativePrompt = payload.negativePrompt;
    }

    const job = await createJobRecord({
      provider: payload.provider,
      engine: payload.engine,
      prompt: payload.prompt,
      ratio: payload.ratio,
      durationSeconds: payload.durationSeconds,
      withAudio: payload.withAudio,
      quantity: payload.quantity,
      seed: payload.seed,
      presetId: payload.presetId,
      metadata: metadataRecord,
    });

    const adapter = getProviderAdapter(job.provider);
    const inputAssets = {
      initImageUrl:
        typeof job.metadata.inputImageUrl === "string" ? job.metadata.inputImageUrl : undefined,
      maskUrl: typeof job.metadata.maskUrl === "string" ? job.metadata.maskUrl : undefined,
      referenceImageUrl:
        typeof job.metadata.referenceImageUrl === "string"
          ? job.metadata.referenceImageUrl
          : undefined,
      referenceVideoUrl:
        typeof job.metadata.referenceVideoUrl === "string"
          ? job.metadata.referenceVideoUrl
          : undefined,
    };
    const advancedOptions = {
      fps: typeof job.metadata.fps === "number" ? job.metadata.fps : undefined,
      motionStrength:
        typeof job.metadata.motionStrength === "number" ? job.metadata.motionStrength : undefined,
      cfgScale: typeof job.metadata.cfgScale === "number" ? job.metadata.cfgScale : undefined,
      steps: typeof job.metadata.steps === "number" ? job.metadata.steps : undefined,
      watermark:
        typeof job.metadata.watermark === "boolean" ? job.metadata.watermark : undefined,
      upscaling:
        typeof job.metadata.upscaling === "boolean" ? job.metadata.upscaling : undefined,
    };

    const providerJob = await adapter.startJob({
      prompt: job.prompt,
      durationSeconds: job.durationSeconds,
      ratio: job.ratio,
      engine: job.engine,
      withAudio: job.withAudio,
      seed: job.seed ?? undefined,
      presetId: job.presetId ?? undefined,
      modelId: typeof job.metadata.modelId === "string" ? job.metadata.modelId : undefined,
      negativePrompt:
        typeof job.metadata.negativePrompt === "string" ? job.metadata.negativePrompt : undefined,
      inputAssets,
      advanced: advancedOptions,
      metadata: job.metadata,
    });

    await updateJobRecord(job.id, {
      status: providerJob.status,
      progress: providerJob.status === "pending" ? 10 : 0,
      externalJobId: providerJob.externalId ?? null,
    });

    simulateJobLifecycle({
      jobId: job.id,
      providerJobId: providerJob.jobId,
      adapter,
    });

    const freshJob = await getJobById(job.id);

    return NextResponse.json(
      { job: freshJob ? serializeJob(freshJob) : null, serverCostCents: serverEstimate.subtotalCents },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 400 },
    );
  }
}

export async function GET() {
  const allJobs = await listJobs();
  return NextResponse.json({ jobs: allJobs.map(serializeJob) });
}
