"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export function HeroParticleField({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    const pointer = { x: 0, y: 0 };
    const particles: Particle[] = [];
    const BASE_PARTICLE_COUNT = 60;

    function resize() {
      if (!container || !ctx) return;
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * DPR);
      canvas.height = Math.floor(height * DPR);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      pointer.x = width / 2;
      pointer.y = height / 2;
    }

    function seedParticles() {
      particles.length = 0;
      const particleCount = Math.floor(BASE_PARTICLE_COUNT * Math.max(1, width / 1000));
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: 0.6 + Math.random() * 1.8,
        });
      }
    }

    function drawTrail() {
      if (!ctx) return;
      const gradient = ctx.createRadialGradient(
        pointer.x,
        pointer.y,
        0,
        pointer.x,
        pointer.y,
        Math.max(width, height) * 0.9,
      );
      gradient.addColorStop(0, "rgba(134,91,255,0.16)");
      gradient.addColorStop(0.25, "rgba(104,211,255,0.10)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    function drawParticles() {
      if (!ctx) return;
      ctx.save();
      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < -20) particle.x = width + 20;
        if (particle.x > width + 20) particle.x = -20;
        if (particle.y < -20) particle.y = height + 20;
        if (particle.y > height + 20) particle.y = -20;

        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pull = Math.max(0, 1 - dist / 280);

        ctx.beginPath();
        ctx.fillStyle = `rgba(134,91,255,${0.25 + pull * 0.45})`;
        ctx.arc(particle.x, particle.y, particle.radius + pull * 4, 0, Math.PI * 2);
        ctx.fill();

        if (pull > 0.4) {
          ctx.strokeStyle = `rgba(104,211,255,${pull * 0.7})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function loop() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // soft base gradient
      const baseGradient = ctx.createLinearGradient(0, 0, width, height);
      baseGradient.addColorStop(0, "rgba(255,255,255,0.08)");
      baseGradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = baseGradient;
      ctx.fillRect(0, 0, width, height);

      // subtle horizontal shimmer
      const shimmer = ctx.createLinearGradient(0, height * 0.3, width, height * 0.7);
      shimmer.addColorStop(0, "rgba(255,255,255,0.02)");
      shimmer.addColorStop(0.5, "rgba(134,91,255,0.035)");
      shimmer.addColorStop(1, "rgba(255,255,255,0.02)");
      ctx.fillStyle = shimmer;
      ctx.fillRect(0, 0, width, height);

      drawTrail();
      drawParticles();

      rafRef.current = requestAnimationFrame(loop);
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!event.touches?.length) return;
      const rect = container.getBoundingClientRect();
      pointer.x = event.touches[0].clientX - rect.left;
      pointer.y = event.touches[0].clientY - rect.top;
    };

    resize();
    seedParticles();
    loop();

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={"pointer-events-none absolute inset-0 z-0 overflow-hidden " + className}
      aria-hidden
    >
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-transparent dark:from-black/80 dark:via-black/40 dark:to-transparent" />
      <div
        className="absolute inset-0 mix-blend-color-dodge opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(80,64,204,0.3), transparent 35%), radial-gradient(circle at 80% 30%, rgba(32, 192, 255, 0.22), transparent 45%), radial-gradient(circle at 60% 80%, rgba(170, 80, 255, 0.18), transparent 50%)",
        }}
      />
    </div>
  );
}
