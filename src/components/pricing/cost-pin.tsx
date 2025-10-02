"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { estimateCost, setPricingOverrides, type EstimateInput, type Estimate } from "@/lib/pricing";
import { formatCurrency } from "@/lib/format";

export interface CostPinProps {
  input: EstimateInput;
  overridesJSON?: string | null;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function CostPin({ input, overridesJSON, className, title = "Estimated cost", subtitle }: CostPinProps) {
  const memoisedInput = React.useMemo(() => input, [input]);

  React.useEffect(() => {
    if (overridesJSON) {
      setPricingOverrides(overridesJSON);
    }
  }, [overridesJSON]);

  const memoisedEstimate = React.useMemo<Estimate>(() => estimateCost(memoisedInput), [memoisedInput]);

  const amountLabel = memoisedEstimate.costUsd != null
    ? formatCurrency(Math.round(memoisedEstimate.costUsd * 100))
    : "—";

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{title}</span>
        <span className="text-3xl font-semibold text-primary">{amountLabel}</span>
        {subtitle ? <p className="text-xs text-muted-foreground/80">{subtitle}</p> : null}
      </div>

      {memoisedEstimate.breakdown.length > 0 ? (
        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          {memoisedEstimate.breakdown.map((entry, index) => (
            <div key={`${entry}-${index}`} className="flex items-start gap-2">
              <span className="mt-[2px] inline-block h-1.5 w-1.5 flex-none rounded-full bg-primary/70" aria-hidden />
              <span className="text-left leading-relaxed">{entry}</span>
            </div>
          ))}
        </div>
      ) : null}

      {memoisedEstimate.assumptions.length > 0 ? (
        <div className="mt-4 space-y-1 rounded-lg border border-dashed border-muted/40 bg-muted/10 p-3 text-[11px] text-muted-foreground">
          {memoisedEstimate.assumptions.map((item, index) => (
            <p key={`${item}-${index}`}>Assumption: {item}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
