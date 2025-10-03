"use client";

import { useMemo } from "react";
import { Funnel, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export interface WallFilterState {
  tier: string;
  engine: string;
  aspect: string;
  duration: string;
  price: string;
  audioOnly: boolean;
}

interface WallFiltersProps {
  filters: WallFilterState;
  onChange: (key: keyof WallFilterState, value: string | boolean) => void;
  onReset: () => void;
  onPauseAll: () => void;
  options: {
    tiers: string[];
    engines: string[];
    aspects: string[];
    durations: { id: string; label: string }[];
    priceBuckets: { id: string; label: string }[];
  };
  resultsCount: number;
}

export function WallFilters({ filters, onChange, onReset, onPauseAll, options, resultsCount }: WallFiltersProps) {
  const filterSummary = useMemo(() => {
    const active = [filters.tier, filters.engine, filters.aspect, filters.duration, filters.price].filter(
      (value) => value !== "all"
    );
    return active.length;
  }, [filters]);

  return (
    <div className="sticky top-20 z-30 rounded-3xl border border-white/10 bg-[rgba(10,13,24,0.82)] p-4 backdrop-blur">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.28em] text-muted-foreground">
            <Funnel className="h-4 w-4" /> Filters
            {filterSummary ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {filterSummary} active
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-full px-3" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-full px-3" onClick={onPauseAll}>
              <Pause className="h-3.5 w-3.5" /> Pause all
            </Button>
            <span className="hidden text-muted-foreground sm:inline-flex">
              Showing <strong className="ml-1 text-foreground">{resultsCount}</strong> clips
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <FilterSelect
            label="Tier"
            value={filters.tier}
            onValueChange={(value) => onChange("tier", value)}
            options={[{ id: "all", label: "All tiers" }, ...options.tiers.map((tier) => ({ id: tier, label: tier }))]}
          />
          <FilterSelect
            label="Engine"
            value={filters.engine}
            onValueChange={(value) => onChange("engine", value)}
            options={[{ id: "all", label: "All engines" }, ...options.engines.map((engine) => ({ id: engine, label: engine }))]}
          />
          <FilterSelect
            label="Aspect"
            value={filters.aspect}
            onValueChange={(value) => onChange("aspect", value)}
            options={[{ id: "all", label: "Any aspect" }, ...options.aspects.map((aspect) => ({ id: aspect, label: aspect }))]}
          />
          <FilterSelect
            label="Duration"
            value={filters.duration}
            onValueChange={(value) => onChange("duration", value)}
            options={[{ id: "all", label: "Any length" }, ...options.durations]}
          />
          <FilterSelect
            label="Price bucket"
            value={filters.price}
            onValueChange={(value) => onChange("price", value)}
            options={[{ id: "all", label: "Any price" }, ...options.priceBuckets]}
          />
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div>
              <Label htmlFor="audio-capable" className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Audio capable
              </Label>
              <p className="text-[13px] text-muted-foreground">Show models that ship with audio tracks</p>
            </div>
            <Switch
              id="audio-capable"
              checked={filters.audioOnly}
              onCheckedChange={(checked) => onChange("audioOnly", checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onValueChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onValueChange }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-10 rounded-xl border-white/10 bg-background/60 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border border-border/50 bg-background/95 text-sm">
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id} className="rounded-lg text-sm">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
