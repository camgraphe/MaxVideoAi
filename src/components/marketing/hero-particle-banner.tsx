"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function HeroParticleBanner({ className }: { className?: string }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const pointer = { x: 0, y: 0 };
    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];

    function resize() {
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      pointer.x = w / 2;
      pointer.y = h / 2;
    }

    function seed() {
      particles.length = 0;
      const count = Math.min(120, Math.max(60, Math.floor(w / 12)));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          r: 0.6 + Math.random() * 1.8,
        });
      }
    }

    function loop() {
      ctx.clearRect(0, 0, w, h);

      // Base gradient backdrop within the banner
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "rgba(20,22,38,0.25)");
      bg.addColorStop(1, "rgba(20,22,38,0.05)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const dist = Math.hypot(dx, dy);
        const pull = Math.max(0, 1 - dist / 260);

        ctx.beginPath();
        ctx.fillStyle = `rgba(134,91,255,${0.22 + pull * 0.45})`;
        ctx.arc(p.x, p.y, p.r + pull * 3.5, 0, Math.PI * 2);
        ctx.fill();

        if (pull > 0.4) {
          ctx.strokeStyle = `rgba(104,211,255,${pull * 0.65})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = wrapper.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches.length) return;
      const rect = wrapper.getBoundingClientRect();
      pointer.x = e.touches[0].clientX - rect.left;
      pointer.y = e.touches[0].clientY - rect.top;
    };

    resize();
    seed();
    loop();
    window.addEventListener("resize", resize);
    wrapper.addEventListener("mousemove", onMouseMove, { passive: true });
    wrapper.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      wrapper.removeEventListener("mousemove", onMouseMove);
      wrapper.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black/80 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.6)] backdrop-blur-sm dark:bg-black/80",
        "h-[40vh] min-h-[260px]",
        className,
      )}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* light overlay gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 via-white/0 to-black/30 dark:from-white/0 dark:via-white/0 dark:to-black/40" />
    </div>
  );
}
