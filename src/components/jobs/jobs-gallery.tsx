"use client";

import Link from "next/link";
import { ENGINE_LABELS } from "@/data/models";
import type { SerializedJob } from "@/db/repositories/jobs-repo";

interface JobsGalleryProps {
  jobs: SerializedJob[];
}

export function JobsGallery({ jobs }: JobsGalleryProps) {
  return (
    <div className="grid auto-rows-[160px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={`/jobs/${job.id}`}
          className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-white/80 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-black/30"
        >
          <div className="relative h-full w-full overflow-hidden bg-muted">
            {job.outputUrl ? (
              <video
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                src={job.outputUrl}
                poster={job.thumbnailUrl ?? undefined}
                muted
                autoPlay
                loop
                playsInline
                preload="metadata"
              />
            ) : job.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.thumbnailUrl}
                alt={job.prompt}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                No preview yet
              </div>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 translate-y-2 p-3 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="rounded-lg bg-black/60 p-3 text-white backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                {ENGINE_LABELS[job.engine] ?? job.engine}
              </div>
              <div className="mt-1 line-clamp-2 text-xs">{job.prompt}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
