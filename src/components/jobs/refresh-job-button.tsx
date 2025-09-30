"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RefreshJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);
          await fetch(`/api/jobs/${jobId}?force=1`, { cache: "no-store" });
        } catch {
          // ignore
        } finally {
          setLoading(false);
          router.refresh();
        }
      }}
    >
      {loading ? "Refreshing…" : "Refresh from provider"}
    </Button>
  );
}

