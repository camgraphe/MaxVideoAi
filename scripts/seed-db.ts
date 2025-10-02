import "dotenv/config";
import { randomUUID } from "node:crypto";
import { addHours, startOfMonth, subMonths } from "date-fns";
import { eq } from "drizzle-orm";

import { getDb, closeDb, dbSchema } from "../src/db/client";
import { generationPresets } from "../src/data/presets";
import { formatModelSummary, getModelSpec } from "../src/data/models";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000002";

async function main() {
  const db = getDb();

  const existingOrg = await db
    .select({ id: dbSchema.organizations.id })
    .from(dbSchema.organizations)
    .where(eq(dbSchema.organizations.id, DEMO_ORG_ID))
    .limit(1);

  if (existingOrg.length > 0) {
    console.info("Seed data already present. Skipping.");
    await closeDb();
    return;
  }

  const now = new Date();

  const jobAId = randomUUID();
  const jobBId = randomUUID();
  const jobCId = randomUUID();

  const jobAStarted = addHours(now, -6);
  const jobACompleted = addHours(now, -5.5);
  const jobBCreated = addHours(now, -1.5);
  const jobBUpdated = addHours(now, -0.2);
  const jobCCreated = addHours(now, -12);
  const jobCCompleted = addHours(now, -10.5);

  await db.transaction(async (tx) => {
    await tx
      .insert(dbSchema.users)
      .values({
        id: DEMO_USER_ID,
        email: "producer@maxvideoai.com",
        name: "Demo Producer",
      })
      .onConflictDoUpdate({
        target: dbSchema.users.email,
        set: { updatedAt: now },
      });

    await tx
      .insert(dbSchema.organizations)
      .values({
        id: DEMO_ORG_ID,
        name: "MaxVideoAI Studio",
        slug: "maxvideoai-studio",
        plan: "pro",
        subscriptionStatus: "active",
        billingEmail: "producer@maxvideoai.com",
        credits: 120,
        seatsLimit: 5,
      })
      .onConflictDoNothing();

    await tx.insert(dbSchema.organizationCreditLedger).values({
      id: randomUUID(),
      organizationId: DEMO_ORG_ID,
      delta: 120,
      reason: "initial_seed",
      metadata: {},
    });

    await tx
      .insert(dbSchema.organizationMembers)
      .values({
        id: randomUUID(),
        organizationId: DEMO_ORG_ID,
        userId: DEMO_USER_ID,
        role: "owner",
      })
      .onConflictDoNothing();

    await tx
      .insert(dbSchema.presets)
      .values(
        generationPresets.map((preset) => ({
          id: preset.id,
          provider: preset.provider,
          engine: preset.engine,
          // DB only accepts "16:9" | "9:16"; coerce any other ratios to a safe default
          ratio:
            preset.ratio === "9:16"
              ? "9:16"
              : preset.ratio === "16:9"
                ? "16:9"
                : preset.ratio === "4:5" || preset.ratio === "2:3"
                  ? "9:16"
                  : "16:9",
          durationSeconds: preset.durationSeconds,
          withAudio: preset.withAudio,
          seed: preset.seed,
          name: preset.name,
          description: preset.description,
        })),
      )
      .onConflictDoNothing();

    const veoSpec = getModelSpec("fal", "veo3");
    const pikaSpec = getModelSpec("fal", "pika-v2-2");
    const cogSpec = getModelSpec("fal", "cogvideox-5b");

    await tx.insert(dbSchema.jobs).values([
      {
        id: jobAId,
        organizationId: DEMO_ORG_ID,
        createdBy: DEMO_USER_ID,
        provider: "fal",
        engine: "veo3",
        prompt: "16:9 trailer for a futuristic sneaker drop",
        ratio: "16:9",
        durationSeconds: 8,
        withAudio: true,
        quantity: 1,
        presetId: "veo3-cinematic",
        status: "completed",
        progress: 100,
        costEstimateCents: 520,
        costActualCents: 540,
        durationActualSeconds: 8,
        externalJobId: randomUUID(),
        outputUrl: "https://example.com/mock-veo3.mp4",
        thumbnailUrl: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900",
        startedAt: jobAStarted,
        completedAt: jobACompleted,
        metadata: {
          quantity: 1,
          modelId: veoSpec?.id,
          modelSummary: veoSpec ? formatModelSummary(veoSpec) : undefined,
          resolution: veoSpec?.defaults.resolution ?? "720p",
        },
        createdAt: jobAStarted,
        updatedAt: jobACompleted,
      },
      {
        id: jobBId,
        organizationId: DEMO_ORG_ID,
        createdBy: DEMO_USER_ID,
        provider: "fal",
        engine: "pika-v2-2",
        prompt: "Budget-friendly loop for DOOH screens with animated typography",
        ratio: "16:9",
        durationSeconds: 5,
        withAudio: false,
        quantity: 1,
        presetId: "pika-social-loop",
        status: "running",
        progress: 65,
        costEstimateCents: 110,
        externalJobId: randomUUID(),
        startedAt: jobBCreated,
        metadata: {
          quantity: 1,
          modelId: pikaSpec?.id,
          modelSummary: pikaSpec ? formatModelSummary(pikaSpec) : undefined,
          resolution: pikaSpec?.defaults.resolution ?? "720p",
        },
        createdAt: jobBCreated,
        updatedAt: jobBUpdated,
      },
      {
        id: jobCId,
        organizationId: DEMO_ORG_ID,
        createdBy: DEMO_USER_ID,
        provider: "fal",
        engine: "cogvideox-5b",
        prompt: "Storyboard variation for a product hero shot",
        ratio: "16:9",
        durationSeconds: 6,
        withAudio: false,
        quantity: 1,
        presetId: "cogvideox-storyboard",
        status: "completed",
        progress: 100,
        costEstimateCents: 160,
        costActualCents: 165,
        durationActualSeconds: 6,
        externalJobId: randomUUID(),
        outputUrl: "https://example.com/mock-cogvideox.mp4",
        thumbnailUrl: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=900",
        startedAt: jobCCreated,
        completedAt: jobCCompleted,
        metadata: {
          quantity: 1,
          modelId: cogSpec?.id,
          modelSummary: cogSpec ? formatModelSummary(cogSpec) : undefined,
          resolution: cogSpec?.defaults.resolution ?? "720p",
        },
        createdAt: jobCCreated,
        updatedAt: jobCCompleted,
      },
    ]);

    await tx.insert(dbSchema.jobEvents).values([
      {
        id: randomUUID(),
        jobId: jobAId,
        status: "pending",
        progress: 10,
        message: "Queued with Veo Quality pipeline",
        createdAt: addHours(jobAStarted, -0.05),
      },
      {
        id: randomUUID(),
        jobId: jobAId,
        status: "running",
        progress: 70,
        message: "Model is generating keyframes",
        createdAt: addHours(jobAStarted, -0.01),
      },
      {
        id: randomUUID(),
        jobId: jobAId,
        status: "completed",
        progress: 100,
        message: "Render delivered",
        createdAt: jobACompleted,
      },
      {
        id: randomUUID(),
        jobId: jobBId,
        status: "running",
        progress: 65,
        message: "Draft pass 1/2 ready",
        createdAt: jobBUpdated,
      },
      {
        id: randomUUID(),
        jobId: jobCId,
        status: "pending",
        progress: 5,
        message: "Task accepted by FAL",
        createdAt: addHours(jobCCreated, -0.1),
      },
      {
        id: randomUUID(),
        jobId: jobCId,
        status: "completed",
        progress: 100,
        message: "Loop delivered",
        createdAt: jobCCompleted,
      },
    ]);

    await tx.insert(dbSchema.jobAssets).values([
      {
        id: randomUUID(),
        jobId: jobAId,
        kind: "video",
        url: "https://example.com/mock-veo.mp4",
        sizeBytes: 58_000_000,
        createdAt: jobACompleted,
      },
      {
        id: randomUUID(),
        jobId: jobAId,
        kind: "thumbnail",
        url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900",
        sizeBytes: 320_000,
        createdAt: jobACompleted,
      },
      {
        id: randomUUID(),
        jobId: jobCId,
        kind: "video",
        url: "https://example.com/mock-fal.mp4",
        sizeBytes: 42_000_000,
        createdAt: jobCCompleted,
      },
    ]);

    const periodEnd = startOfMonth(now);
    const periodStart = subMonths(periodEnd, 1);

    await tx.insert(dbSchema.usageSnapshots).values([
      {
        id: randomUUID(),
        organizationId: DEMO_ORG_ID,
        provider: "veo",
        periodStart,
        periodEnd,
        secondsGenerated: 640,
        clipsGenerated: 48,
        costCents: 38900,
      },
      {
        id: randomUUID(),
        organizationId: DEMO_ORG_ID,
        provider: "fal",
        periodStart,
        periodEnd,
        secondsGenerated: 210,
        clipsGenerated: 32,
        costCents: 9800,
      },
    ]);
  });

  console.info("Database seeded with demo data.");
  await closeDb();
}

main().catch((error) => {
  console.error("Failed to seed database", error);
  process.exit(1);
});
