"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENGINE_LABELS } from "@/data/models";
import type { SerializedJob } from "@/db/repositories/jobs-repo";
import { formatCurrency } from "@/lib/format";

interface JobsTableProps {
  jobs: SerializedJob[];
}

const statusVariant: Record<SerializedJob["status"], "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  running: "secondary",
  completed: "default",
  failed: "destructive",
};

const statusLabel: Record<SerializedJob["status"], string> = {
  pending: "Queued",
  running: "Rendering",
  completed: "Completed",
  failed: "Failed",
};

export function JobsTable({ jobs }: JobsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleOpen = (id: string) => {
    startTransition(() => {
      router.push(`/jobs/${id}`);
    });
  };

  return (
    <div className="rounded-xl border border-black/10 dark:border-border/60">
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Prompt</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Estimated cost</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {jobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                No jobs yet. Launch your first render from the Generate tab.
              </TableCell>
            </TableRow>
          ) : (
            jobs.map((job) => (
              <TableRow key={job.id} className="transition hover:bg-muted/30">
                <TableCell className="max-w-xs overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">
                  {job.prompt}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {job.provider.toUpperCase()} — {ENGINE_LABELS[job.engine] ?? job.engine}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[job.status]}>{statusLabel[job.status]}</Badge>
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {formatCurrency(job.costEstimateCents)}
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {new Date(job.createdAt).toLocaleString("en-US", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell className="text-right text-xs">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpen(job.id)}
                      disabled={isPending}
                    >
                      View
                    </Button>
                    <Button size="sm" variant="outline">
                      Duplicate
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}
