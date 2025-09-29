"use client";

import Link from "next/link";
import { ENGINE_LABELS } from "@/data/models";
import type { SerializedJob } from "@/db/repositories/jobs-repo";

interface JobsGalleryProps {
  jobs: SerializedJob[];
}

export function JobsGallery({ jobs }: JobsGalleryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={`/jobs/${job.id}`}
          className="group relative block overflow-hidden rounded-xl border border-black/10 bg-white/80 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-black/30"
        >
          <div className="aspect-video w-full overflow-hidden bg-muted">
            {job.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.thumbnailUrl}
                alt={job.prompt}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
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

