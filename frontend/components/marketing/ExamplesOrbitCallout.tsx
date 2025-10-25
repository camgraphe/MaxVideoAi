import Link from 'next/link';
import { EngineIcon } from '@/components/ui/EngineIcon';

type OrbitEngine = {
  id: string;
  label: string;
  brandId?: string;
};

type ExamplesOrbitCalloutProps = {
  heading: string;
  description: string;
  ctaLabel: string;
  eyebrow?: string;
  engines: OrbitEngine[];
};

const ORBIT_RADIUS = 140;
const ICON_SIZE = 48;

export function ExamplesOrbitCallout({ heading, description, ctaLabel, eyebrow, engines }: ExamplesOrbitCalloutProps) {
  const orbitEngines = engines.slice(0, 6);
  if (!orbitEngines.length) return null;

  return (
    <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[40px] border border-hairline bg-white/75 p-8 shadow-card backdrop-blur-sm sm:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(80,102,255,0.16),transparent_55%)]" aria-hidden />
        <div className="pointer-events-none absolute -inset-px rounded-[42px] bg-gradient-to-b from-white/40 via-transparent to-white/20 opacity-80" aria-hidden />
        <div className="relative z-10 grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="space-y-5 text-center lg:text-left">
            {eyebrow ? (
              <span className="inline-flex items-center justify-center rounded-pill border border-hairline px-4 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                {eyebrow}
              </span>
            ) : null}
            <h2 className="text-3xl font-semibold text-text-primary sm:text-4xl">{heading}</h2>
            <p className="text-sm text-text-secondary sm:text-base">{description}</p>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-xs sm:max-w-sm">
            <div className="absolute inset-0 rounded-full border border-accent/10" aria-hidden />
            <div className="absolute inset-8 rounded-full border border-accent/10" aria-hidden />
            <div className="absolute inset-0 animate-[orbitSpin_36s_linear_infinite]">
              {orbitEngines.map((engine, index) => {
                const angleRad = (index / orbitEngines.length) * Math.PI * 2;
                const angleDeg = (angleRad * 180) / Math.PI;
                const x = Math.cos(angleRad) * ORBIT_RADIUS;
                const y = Math.sin(angleRad) * ORBIT_RADIUS;
                const iconStyle = {
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                } as const;
                const lineStyle = {
                  height: `${ORBIT_RADIUS - ICON_SIZE / 2}px`,
                  transform: `translate(-50%, -50%) rotate(${angleDeg}deg)`,
                } as const;

                return (
                  <div key={engine.id} className="absolute left-1/2 top-1/2">
                    <span
                      className="absolute left-1/2 top-1/2 w-px origin-top bg-gradient-to-b from-accent/45 via-white/20 to-transparent"
                      style={lineStyle}
                    />
                    <div
                      className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-white/60 bg-white/95 shadow-[0_18px_45px_-30px_rgba(64,73,105,0.55)] backdrop-blur"
                      style={iconStyle}
                    >
                      <EngineIcon
                        engine={{ id: engine.id, label: engine.label, brandId: engine.brandId }}
                        size={28}
                        rounded="full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <Link
              href="/examples"
              className="absolute left-1/2 top-1/2 z-20 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent px-6 text-center text-sm font-semibold leading-tight text-white shadow-[0_35px_80px_-40px_rgba(54,88,255,0.85)] transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-white animate-[orbitPulse_6s_ease-in-out_infinite]"
            >
              {ctaLabel}
            </Link>
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" aria-hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
