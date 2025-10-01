import { NextResponse } from "next/server";
import { jobParamsSchema } from "@/db/schema";
import { getModelSpec, FAL_INIT_IMAGE_REQUIRED_ENGINES, FAL_REF_VIDEO_REQUIRED_ENGINES } from "@/data/models";
import {
  createJobRecord,
  getJobById,
  listJobsByOrganization,
  serializeJob,
  updateJobRecord,
} from "@/db/repositories/jobs-repo";
import { simulateJobLifecycle } from "@/lib/jobs/job-runner";
import { getProviderAdapter } from "@/providers";
import { estimateCost } from "@/lib/pricing";
import { getFalRates } from "@/lib/pricing/dynamic-fal";
import { appConfig } from "@/lib/config";
import { normalizeDurationSeconds, normalizeNumber, isValidUrl } from "@/lib/models/normalization";
import { getFalWebhookUrl } from "@/lib/env";
import { requireCurrentSession } from "@/lib/auth/current-user";
import {
  InsufficientCreditsError,
  spendOrganizationCredits,
} from "@/db/repositories/credits-repo";

const FLOAT_TOLERANCE = 1e-6;

function invalidParamsResponse(
  message: string,
  hints: string[],
  suggestion?: { field: string; value: unknown },
) {
  return NextResponse.json(
    {
      code: "INVALID_PARAMS",
      message,
      hints,
      ...(suggestion ? { suggestion } : {}),
    },
    { status: 400 },
  );
}

function readUrl(candidate: unknown): string | undefined {
  if (typeof candidate !== "string") {
    return undefined;
  }
  const trimmed = candidate.trim();
  return isValidUrl(trimmed) ? trimmed : undefined;
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSession();

    const body = await request.json();
    const payload = jobParamsSchema.parse(body);
    const confirm: boolean = Boolean(body?.confirm);
    const budgetCents: number =
      typeof body?.budgetCents === "number" && body.budgetCents >= 0
        ? body.budgetCents
        : appConfig.defaultBudgetCents;

    const metadataRecord = { ...(payload.metadata ?? {}) } as Record<string, unknown>;
    if (payload.modelId) {
      metadataRecord.modelId = payload.modelId;
    }
    if (payload.negativePrompt) {
      metadataRecord.negativePrompt = payload.negativePrompt;
    }

    let durationSeconds = payload.durationSeconds;

    if (payload.provider === "fal") {
      const spec = getModelSpec("fal", payload.engine);
      if (!spec) {
        return invalidParamsResponse(
          `Unknown FAL engine ${payload.engine}.`,
          ["Select a supported engine from the catalog."],
        );
      }

      if (!spec.constraints.ratios.includes(payload.ratio)) {
        return invalidParamsResponse(
          `Aspect ratio ${payload.ratio} is not supported by ${spec.label}.`,
          [`Choose one of: ${spec.constraints.ratios.join(", ")}.`],
          { field: "ratio", value: spec.constraints.ratios[0] },
        );
      }

      const normalizedDuration = normalizeDurationSeconds(payload.durationSeconds, spec);
      if (Math.abs(normalizedDuration - payload.durationSeconds) > FLOAT_TOLERANCE) {
        const durationConstraints = spec.constraints.durationSeconds;
        const hint = durationConstraints
          ? `Supported durations: ${durationConstraints.min}-${durationConstraints.max}s (step ${durationConstraints.step ?? 1}).`
          : "Check duration limits for this model.";
        return invalidParamsResponse(
          `Duration ${payload.durationSeconds}s is not supported by ${spec.label}.`,
          [hint],
          { field: "durationSeconds", value: normalizedDuration },
        );
      }
      durationSeconds = normalizedDuration;

      const cfgScaleValue = metadataRecord.cfgScale;
      if (typeof cfgScaleValue === "number") {
        const normalizedCfg = normalizeNumber(cfgScaleValue, spec.constraints.cfgScale, spec.defaults.cfgScale);
        if (normalizedCfg !== undefined) {
          metadataRecord.cfgScale = normalizedCfg;
        } else {
          delete metadataRecord.cfgScale;
        }
      } else if (cfgScaleValue !== undefined) {
        delete metadataRecord.cfgScale;
      }

      const fpsValue = metadataRecord.fps;
      if (typeof fpsValue === "number") {
        const normalizedFps = normalizeNumber(fpsValue, spec.constraints.fps, spec.defaults.fps);
        if (normalizedFps !== undefined) {
          metadataRecord.fps = normalizedFps;
        } else {
          delete metadataRecord.fps;
        }
      } else if (fpsValue !== undefined) {
        delete metadataRecord.fps;
      }

      const stepsValue = metadataRecord.steps;
      if (typeof stepsValue === "number") {
        const normalizedSteps = normalizeNumber(stepsValue, spec.constraints.steps, spec.defaults.steps);
        if (normalizedSteps !== undefined) {
          metadataRecord.steps = normalizedSteps;
        } else {
          delete metadataRecord.steps;
        }
      } else if (stepsValue !== undefined) {
        delete metadataRecord.steps;
      }

      const requiresInitImage = FAL_INIT_IMAGE_REQUIRED_ENGINES.has(spec.id);
      const initImageUrl = readUrl(metadataRecord.inputImageUrl);
      if (requiresInitImage) {
        if (!initImageUrl) {
          return invalidParamsResponse(
            `${spec.label} requires an init image.`,
            ["Upload an init image before generating."],
          );
        }
        metadataRecord.inputImageUrl = initImageUrl;
      } else if (initImageUrl) {
        metadataRecord.inputImageUrl = initImageUrl;
      } else if (metadataRecord.inputImageUrl !== undefined) {
        delete metadataRecord.inputImageUrl;
      }

      const referenceVideoUrl = readUrl(metadataRecord.referenceVideoUrl);
      const requiresRefVideo = FAL_REF_VIDEO_REQUIRED_ENGINES.has(spec.id);
      if (requiresRefVideo && !referenceVideoUrl) {
        return invalidParamsResponse(
          `${spec.label} requires a reference video.`,
          ["Attach a reference video before launching the job."],
        );
      }
      if (referenceVideoUrl) {
        metadataRecord.referenceVideoUrl = referenceVideoUrl;
      } else if (metadataRecord.referenceVideoUrl !== undefined) {
        delete metadataRecord.referenceVideoUrl;
      }

      const maskUrl = readUrl(metadataRecord.maskUrl);
      if (maskUrl) {
        metadataRecord.maskUrl = maskUrl;
      } else if (metadataRecord.maskUrl !== undefined) {
        delete metadataRecord.maskUrl;
      }

      const referenceImageUrl = readUrl(metadataRecord.referenceImageUrl);
      if (referenceImageUrl) {
        metadataRecord.referenceImageUrl = referenceImageUrl;
      } else if (metadataRecord.referenceImageUrl !== undefined) {
        delete metadataRecord.referenceImageUrl;
      }
    }

    const falRates = await getFalRates();

    // Server-side price verification
    const serverEstimate = estimateCost({
      provider: payload.provider,
      engine: payload.engine,
      durationSeconds,
      withAudio: payload.withAudio,
      quantity: payload.quantity,
    }, { falRates });

    if (!confirm && serverEstimate.subtotalCents > budgetCents) {
      // Suggest a cheaper alternative for Veo 3 → Veo 3 Fast
      let suggestion: { engine?: string; estimatedCents?: number } | undefined;
      if (payload.engine === "veo3") {
        const alt = estimateCost({
          provider: payload.provider,
          engine: "veo3-fast",
          durationSeconds,
          withAudio: payload.withAudio,
          quantity: payload.quantity,
        }, { falRates });
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

    let creditsRequired = Math.ceil(serverEstimate.subtotalCents / 100);
    if (payload.provider !== "kiwi") {
      creditsRequired = Math.max(1, creditsRequired);
    }

    if (creditsRequired > 0 && session.organization.credits < creditsRequired) {
      return NextResponse.json(
        {
          code: "INSUFFICIENT_CREDITS",
          message: "Your workspace does not have enough credits to launch this job.",
          creditsRequired,
          creditsAvailable: session.organization.credits,
        },
        { status: 402 },
      );
    }

    let creditsRemaining = session.organization.credits;
    if (creditsRequired > 0) {
      try {
        creditsRemaining = await spendOrganizationCredits({
          organizationId: session.organization.id,
          amount: creditsRequired,
          performedBy: session.user.id,
          reason: "job",
          metadata: {
            provider: payload.provider,
            engine: payload.engine,
            durationSeconds,
            quantity: payload.quantity,
            subtotalCents: serverEstimate.subtotalCents,
          },
        });
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          return NextResponse.json(
            {
              code: "INSUFFICIENT_CREDITS",
              message: "Your workspace does not have enough credits to launch this job.",
              creditsRequired,
              creditsAvailable: session.organization.credits,
            },
            { status: 402 },
          );
        }
        throw error;
      }
    }

    const job = await createJobRecord({
      organizationId: session.organization.id,
      createdBy: session.user.id,
      provider: payload.provider,
      engine: payload.engine,
      prompt: payload.prompt,
      ratio: payload.ratio,
      durationSeconds,
      withAudio: payload.withAudio,
      quantity: payload.quantity,
      seed: payload.seed,
      presetId: payload.presetId,
      costEstimateCents: serverEstimate.subtotalCents,
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

    const webhookUrl = job.provider === "fal" ? getFalWebhookUrl() : undefined;

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
      webhookUrl,
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
      engine: job.engine,
    });

    const freshJob = await getJobById(job.id);

    return NextResponse.json(
      {
        job: freshJob ? serializeJob(freshJob) : null,
        serverCostCents: serverEstimate.subtotalCents,
        credits: {
          spent: creditsRequired,
          remaining: creditsRemaining,
        },
      },
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
  const session = await requireCurrentSession();
  const orgJobs = await listJobsByOrganization(session.organization.id);
  return NextResponse.json({ jobs: orgJobs.map(serializeJob) });
}
