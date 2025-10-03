"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { WallTile } from "./wall-tile";
import { WallFilters, type WallFilterState } from "./wall-filters";
import { pauseAllVideos } from "./video-controller";
import type { ClipItem } from "@/data/wall";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getClipEffectivePrice } from "@/lib/wall";

const DEFAULT_FILTERS: WallFilterState = {
  tier: "all",
  engine: "all",
  aspect: "all",
  duration: "all",
  price: "all",
  audioOnly: false,
};

const DURATION_BUCKETS = [
  { id: "short", label: "<= 5s" },
  { id: "standard", label: "6-8s" },
  { id: "extended", label: "> 8s" },
];

const PRICE_BUCKETS = [
  { id: "under-1", label: "Under $1" },
  { id: "1-3", label: "$1 - $3" },
  { id: "above-3", label: "Above $3" },
];

interface WallExperienceProps {
  clips: ClipItem[];
}

export function WallExperience({ clips }: WallExperienceProps) {
  const [filters, setFilters] = useState<WallFilterState>(DEFAULT_FILTERS);

  const options = useMemo(() => {
    const tiers = Array.from(new Set(clips.map((clip) => clip.tier)));
    const engines = Array.from(new Set(clips.map((clip) => clip.engineVersion)));
    const aspects = Array.from(new Set(clips.map((clip) => clip.aspect)));
    return { tiers, engines, aspects };
  }, [clips]);

  const filteredClips = useMemo(() => {
    return clips.filter((clip) => {
      if (filters.tier !== "all" && clip.tier !== filters.tier) return false;
      if (filters.engine !== "all" && clip.engineVersion !== filters.engine) return false;
      if (filters.aspect !== "all" && clip.aspect !== filters.aspect) return false;
      if (filters.audioOnly && !clip.hasAudio) return false;

      if (filters.duration !== "all") {
        if (filters.duration === "short" && clip.durationSeconds > 5) return false;
        if (filters.duration === "standard" && (clip.durationSeconds < 6 || clip.durationSeconds > 8)) return false;
        if (filters.duration === "extended" && clip.durationSeconds <= 8) return false;
      }

      if (filters.price !== "all") {
        const effectivePrice = getClipEffectivePrice(clip);
        if (filters.price === "under-1" && effectivePrice >= 1) return false;
        if (filters.price === "1-3" && (effectivePrice < 1 || effectivePrice > 3)) return false;
        if (filters.price === "above-3" && effectivePrice <= 3) return false;
      }

      return true;
    });
  }, [clips, filters]);

  const editorPicks = useMemo(() => filteredClips.filter((clip) => clip.editorPick), [filteredClips]);
  const restOfWall = useMemo(() => filteredClips.filter((clip) => !clip.editorPick), [filteredClips]);

  const handleChange = (key: keyof WallFilterState, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    pauseAllVideos();
  };

  return (
    <div className="relative flex flex-col gap-8">
      <header className="relative mt-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-[rgba(10,13,20,0.85)] p-8 text-white shadow-[0_40px_80px_-40px_rgba(12,18,30,0.65)] backdrop-blur">
        <Badge variant="secondary" className="w-fit gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.32em] text-primary">
          <Sparkles className="h-3 w-3" /> The Wall
        </Badge>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            All the AI video engines. One control room. Clear prices.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Browse Veo 3, Kling 2.5, Pika 2.2, Luma, WAN, Hunyuan and more. Filter by tier, aspect, price bucket, and instantly see what it costs to remix.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>North-star: successful remixes - Guard KPIs: Wall to Clip CTR, Clip to Remix, LCP under 2.0s</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="gap-2 rounded-full bg-primary px-6 py-5 text-base shadow-[0_25px_55px_-25px_rgba(67,105,255,0.7)]">
            <a href="#editor-picks">
              Jump to Editor&apos;s Picks <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
          <Button asChild size="lg" variant="secondary" className="gap-2 rounded-full border border-white/10 bg-transparent px-6 py-5 text-base">
            <a href="/pricing">See pricing tiers</a>
          </Button>
        </div>
      </header>

      <WallFilters
        filters={filters}
        onChange={handleChange}
        onReset={handleReset}
        onPauseAll={pauseAllVideos}
        options={{
          tiers: options.tiers,
          engines: options.engines,
          aspects: options.aspects,
          durations: DURATION_BUCKETS,
          priceBuckets: PRICE_BUCKETS,
        }}
        resultsCount={filteredClips.length}
      />

      <section id="editor-picks" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Editor&apos;s Picks
          </div>
          <span className="text-xs text-muted-foreground">
            Hand-picked hero clips to showcase breadth and quality.
          </span>
        </div>
        {editorPicks.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {editorPicks.map((clip, index) => (
              <WallTile key={clip.id} clip={clip} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState message="No picks match the current filters. Adjust the filters to surface featured clips." />
        )}
      </section>

      <section aria-label="Video wall" className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="uppercase tracking-[0.28em]">Wall</span>
          <span>Scroll for more - we limit playback to nine clips at a time for performance.</span>
        </div>
        {restOfWall.length ? (
          <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
            {restOfWall.map((clip, index) => (
              <div key={clip.id} className="mb-4 break-inside-avoid">
                <WallTile clip={clip} index={index} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Nothing here yet. Try switching tiers or disabling the audio-only toggle." />
        )}
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
