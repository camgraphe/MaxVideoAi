"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Estimate } from "@/lib/pricing";
import { formatCurrency } from "@/lib/format";

interface PriceBadgeProps {
  cost?: Estimate;
  disabled?: boolean;
  creditsRequired?: number;
  creditsAvailable?: number;
}

export function PriceBadge({ cost, disabled, creditsRequired, creditsAvailable }: PriceBadgeProps) {
  const [open, setOpen] = React.useState(false);

  if (!cost) {
    return (
      <Badge variant="outline" className="h-9 items-center gap-2 bg-muted/40 text-xs uppercase tracking-wide">
        Estimate —
        <span className="font-medium">--</span>
      </Badge>
    );
  }

  const totalCents = cost.costUsd != null ? Math.round(cost.costUsd * 100) : null;
  const hasEnoughCredits =
    creditsRequired === undefined || creditsAvailable === undefined || creditsAvailable >= creditsRequired;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-9 gap-2 border-primary/40 bg-primary/5 text-xs font-semibold uppercase tracking-wide"
        >
          Estimated total
          <Badge variant="secondary" className="bg-primary/90 text-primary-foreground">
            {totalCents != null ? formatCurrency(totalCents) : "—"}
          </Badge>
          <Info className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 text-sm">
        <div className="font-semibold">Cost breakdown</div>
        {cost.breakdown.length ? (
          <ul className="space-y-2 text-xs text-muted-foreground">
            {cost.breakdown.map((entry, index) => (
              <li key={`${entry}-${index}`} className="leading-relaxed">
                {entry}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No granular pricing data available for this engine.</p>
        )}
        {totalCents != null ? (
          <div className="flex items-center justify-between border-t border-border/70 pt-3 text-xs">
            <span>Total estimate</span>
            <span className="text-base font-semibold text-primary">{formatCurrency(totalCents)}</span>
          </div>
        ) : null}
        {creditsRequired !== undefined ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
            <div className="flex items-center justify-between font-medium text-foreground">
              <span>Credits needed</span>
              <span className={!hasEnoughCredits ? "text-destructive" : ""}>
                {creditsRequired ?? "—"}
              </span>
            </div>
            {creditsAvailable !== undefined ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Balance: <span className={!hasEnoughCredits ? "text-destructive" : "text-foreground"}>{creditsAvailable}</span>
              </p>
            ) : null}
          </div>
        ) : null}
        {cost.assumptions.length > 0 ? (
          <div className="space-y-1 rounded-lg bg-muted/10 p-3 text-[11px] text-muted-foreground">
            {cost.assumptions.map((item, index) => (
              <p key={`${item}-${index}`}>Assumption: {item}</p>
            ))}
          </div>
        ) : null}
        <div className="space-y-2 text-[11px] text-muted-foreground">
          <p>Estimate calculated client-side. Final billing uses the provider&apos;s metered cost.</p>
          <p className="text-muted-foreground/80">
            Une fois le rendu terminé, nous appliquons un coefficient de 30&nbsp;% sur le coût réel communiqué par FAL.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
