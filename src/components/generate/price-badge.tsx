"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EstimateCostOutput } from "@/types/pricing";
import { formatCurrency } from "@/lib/format";

interface PriceBadgeProps {
  cost?: EstimateCostOutput;
  disabled?: boolean;
}

export function PriceBadge({ cost, disabled }: PriceBadgeProps) {
  const [open, setOpen] = React.useState(false);

  if (!cost) {
    return (
      <Badge variant="outline" className="h-9 items-center gap-2 bg-muted/40 text-xs uppercase tracking-wide">
        Estimate —
        <span className="font-medium">--</span>
      </Badge>
    );
  }

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
          Estimated cost
          <Badge variant="secondary" className="bg-primary/90 text-primary-foreground">
            {formatCurrency(cost.subtotalCents)}
          </Badge>
          <Info className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 text-sm">
        <div className="font-semibold">Cost breakdown</div>
        <ul className="space-y-2">
          {cost.breakdown.map((item) => (
            <li key={item.label} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{item.label}</span>
              <span className="font-medium text-foreground">{formatCurrency(item.amountCents)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-border/70 pt-3 text-xs">
          <span>Total estimate</span>
          <span className="text-base font-semibold text-primary">
            {formatCurrency(cost.subtotalCents)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Calculated before launch. Server verification runs again right before `startJob()`.
        </p>
      </PopoverContent>
    </Popover>
  );
}
