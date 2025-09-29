"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function HeroVideoCard() {
  const rx = useSpring(0, { stiffness: 120, damping: 20 });
  const ry = useSpring(0, { stiffness: 120, damping: 20 });
  const tX = useTransform(ry, (v) => `rotateY(${v}deg)`);
  const tY = useTransform(rx, (v) => `rotateX(${v}deg)`);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    ry.set(dx * 8);
    rx.set(-dy * 8);
  }

  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <div className="relative isolate">
      <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-primary/30 blur-[120px]" />
      <motion.div
        style={{ rotateX: tY, rotateY: tX, transformPerspective: 1200 }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/85 shadow-[0_60px_120px_-40px_rgba(0,0,0,0.2)] backdrop-blur-xl dark:border-border/50 dark:bg-black/30"
      >
        <div className="flex items-center justify-between p-5">
          <Badge variant="outline" className="border-primary/40 text-primary">
            Live showreel
          </Badge>
          <span className="text-xs text-muted-foreground">Veo 3 Quality • 8s • 1080p</span>
        </div>
        <div className="px-5 pb-5">
          <div
            className="group relative aspect-video overflow-hidden rounded-xl border border-white/10"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1600')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 transition group-hover:opacity-70" />
            <button
              className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur transition hover:bg-white/20"
              aria-label="Play demo"
            >
              <Play className="h-4 w-4" /> Play demo
            </button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Duplicate the draft into a Veo Quality pass or route budget-friendly variants through FAL — continuity preserved.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
