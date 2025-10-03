"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ExternalLink, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { pauseVideo, requestPlay } from "./video-controller";
import type { ClipItem } from "@/data/wall";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

interface WallTileProps {
  clip: ClipItem;
  index: number;
}

export function WallTile({ clip, index }: WallTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const badgeColor = useMemo(() => tierTone(clip.tier), [clip.tier]);

  const handleEnter = () => {
    if (prefersReducedMotion) return;
    if (!videoRef.current) return;
    requestPlay(videoRef.current);
  };

  const handleLeave = () => {
    pauseVideo(videoRef.current, true);
  };

  const handleManualPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      requestPlay(videoRef.current);
    } else {
      pauseVideo(videoRef.current, false);
    }
  };

  return (
    <Card
      tabIndex={0}
      onFocus={handleEnter}
      onBlur={handleLeave}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onTouchStart={handleManualPlay}
      className={cn(
        "group relative isolate flex flex-col gap-4 overflow-hidden rounded-3xl border border-white/10 bg-[rgba(18,22,35,0.7)] p-4 text-foreground shadow-[0_24px_48px_-32px_rgba(12,18,30,0.4)] backdrop-blur transition duration-200 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_65px_-30px_rgba(66,133,244,0.45)]",
        "dark:bg-[rgba(10,13,23,0.9)]",
        "break-inside-avoid"
      )}
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/70">
        <video
          ref={videoRef}
          poster={clip.media.poster}
          preload="metadata"
          muted
          loop
          playsInline
          height={360}
          className="h-full w-full object-cover"
          onLoadedData={() => setIsReady(true)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          <source src={clip.media.video} type="video/webm" />
          {clip.media.fallback ? <source src={clip.media.fallback} type="video/mp4" /> : null}
        </video>
        {!isReady && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted/40 to-muted/10" />
        )}
        {prefersReducedMotion && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-2">
            <Badge variant="secondary" className="bg-black/60 text-xs text-white">
              Tap to play
            </Badge>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/35" />
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
          <Badge className={cn("bg-white/10 text-xs font-medium uppercase tracking-wide", badgeColor.bg, badgeColor.text)}>
            {clip.tier}
          </Badge>
          {clip.editorPick ? (
            <Badge variant="secondary" className="bg-amber-400/90 text-black">
              Editor&apos;s pick #{index + 1}
            </Badge>
          ) : null}
        </div>
        <div className="pointer-events-none absolute right-3 top-3 flex items-center rounded-full bg-black/60 px-2 py-1 text-xs text-white">
          {clip.cost.display}
          {clip.cost.billing === "per_second" ? <span className="ml-1 text-white/70">/sec</span> : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">{clip.title}</h3>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
              {clip.engineVersion}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{clip.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clip.badges.map((badge) => (
            <Badge key={badge} variant="outline" className="border-white/10 bg-white/5 text-xs text-muted-foreground">
              {badge}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{clip.durationSeconds}s</span>
          <span aria-hidden>{"\u2022"}</span>
          <span>{clip.aspect}</span>
          <span aria-hidden>{"\u2022"}</span>
          <span>{clip.hasAudio ? "Audio on" : "Audio off"}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            asChild
            size="sm"
            className="hidden flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold shadow-sm transition group-hover:flex"
          >
            <Link href={`/generate?clip=${clip.slug}`}>
              Remix
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="hidden flex-1 items-center justify-center gap-2 rounded-full border-primary/40 bg-transparent text-sm font-semibold text-primary shadow-sm transition group-hover:flex"
          >
            <Link href={`/chains?focus=${clip.slug}`}>
              <Wand2 className="h-4 w-4" /> Enhance
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition group-hover:flex"
            onClick={handleManualPlay}
            aria-label="Toggle playback"
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{clip.cost.display}</span>
            <span>{clip.cost.billing === "per_second" ? "per second" : "per clip"}</span>
            {clip.cost.notes ? <span>{"\u00b7"} {clip.cost.notes}</span> : null}
          </div>
          <Button asChild variant="link" className="h-auto px-0 text-xs text-primary">
            <Link href={`/clip/${clip.slug}`} className="inline-flex items-center gap-1">
              Open recipe <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function tierTone(tier: ClipItem["tier"]) {
  switch (tier) {
    case "Premium":
      return { bg: "bg-white/20", text: "text-white" };
    case "Pro":
      return { bg: "bg-blue-500/20", text: "text-blue-100" };
    case "Budget":
      return { bg: "bg-emerald-500/20", text: "text-emerald-100" };
    case "Open":
      return { bg: "bg-slate-500/20", text: "text-slate-100" };
    default:
      return { bg: "bg-white/15", text: "text-white" };
  }
}
