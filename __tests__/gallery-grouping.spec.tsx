import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobsGallery } from "@/components/jobs/jobs-gallery";
import type { SerializedJob } from "@/db/repositories/jobs-repo";

function createJob(id: number, overrides: Partial<SerializedJob> = {}): SerializedJob {
  const isoDate = new Date().toISOString();
  return {
    id: `job-${id}`,
    organizationId: "org-1",
    createdBy: "user-1",
    provider: "fal",
    engine: "fal-ai/veo3",
    prompt: `Prompt ${id}`,
    ratio: "16:9",
    durationSeconds: 8,
    withAudio: false,
    quantity: 1,
    presetId: null,
    seed: null,
    status: "completed",
    progress: 100,
    costEstimateCents: 100,
    costActualCents: 90,
    durationActualSeconds: 8,
    externalJobId: null,
    outputUrl: `https://cdn.example.com/${id}.mp4`,
    thumbnailUrl: `https://cdn.example.com/${id}.jpg`,
    archiveUrl: null,
    error: null,
    metadata: {},
    createdAt: isoDate,
    updatedAt: isoDate,
    ...overrides,
  };
}

describe("JobsGallery grouping", () => {
  it("renders jobs in order and keeps the first four visible", () => {
    const jobs = Array.from({ length: 5 }, (_, index) => createJob(index + 1));
    render(<JobsGallery jobs={jobs} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(jobs.length);

    const firstFourHrefs = links.slice(0, 4).map((link) => link.getAttribute("href"));
    const expectedFirstFour = jobs.slice(0, 4).map((job) => `/jobs/${job.id}`);
    expect(firstFourHrefs).toEqual(expectedFirstFour);
  });
});
