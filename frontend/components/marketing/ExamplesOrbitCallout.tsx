'use client';

import clsx from 'clsx';
import { Link } from '@/i18n/navigation';
import { type CSSProperties, type SVGProps } from 'react';
import { getEnginePictogram } from '@/lib/engine-branding';
import styles from './examples-orbit.module.css';

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

const ORBIT_RADIUS = 148;
const ICON_SIZE = 56;
const ORBIT_DELAY_STEP = 0.45;

function pseudoRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function GalleryGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x="5" y="7" width="22" height="18" rx="3.5" />
      <path d="M11 14c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2Z" fill="currentColor" stroke="none" />
      <path d="m9 22 4.5-5L18 21l2.5-3 5.5 6" />
    </svg>
  );
}

export function ExamplesOrbitCallout({ heading, description, ctaLabel, eyebrow, engines }: ExamplesOrbitCalloutProps) {
  const orbitEngines = engines.slice(0, 6);
  if (!orbitEngines.length) return null;

  return (
    <section className="container-page max-w-6xl">
      <div className="relative overflow-hidden rounded-[40px] border border-hairline bg-white/75 p-8 shadow-card backdrop-blur-sm sm:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(80,102,255,0.16),transparent_55%)]" aria-hidden />
        <div className="pointer-events-none absolute -inset-px rounded-[42px] bg-gradient-to-b from-white/40 via-transparent to-white/20 opacity-80" aria-hidden />
        <div className="relative z-10 grid grid-gap-xl lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="stack-gap-lg text-center lg:text-left">
            {eyebrow ? (
              <span className="inline-flex items-center justify-center rounded-pill border border-hairline px-4 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                {eyebrow}
              </span>
            ) : null}
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{heading}</h2>
            <p className="text-sm text-text-secondary sm:text-base">{description}</p>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-xs sm:max-w-sm">
            <div className="absolute inset-0 rounded-full border border-hairline" aria-hidden />
            <div className="absolute inset-8 rounded-full border border-hairline" aria-hidden />
            <div className={clsx(styles.orbitField, 'absolute inset-0')}>
              {orbitEngines.map((engine, index) => {
                const angleRad = (index / orbitEngines.length) * Math.PI * 2;
                const angleDeg = (angleRad * 180) / Math.PI;
                const x = Math.cos(angleRad) * ORBIT_RADIUS;
                const y = Math.sin(angleRad) * ORBIT_RADIUS;
                const lineLength = ORBIT_RADIUS - ICON_SIZE / 2;
                const driftDelaySeconds = index * ORBIT_DELAY_STEP;
                const chaosSeed = index + orbitEngines.length;
                const chaos = pseudoRandom(chaosSeed);
                const chaosOffset = pseudoRandom(chaosSeed * 1.7) - 0.5;
                const jitterDistance = 10 + chaos * 18;
                const angleSkew = chaosOffset * (Math.PI / 4);
                const jitterAngle = angleRad + angleSkew;
                const jitterX = Math.cos(jitterAngle) * jitterDistance;
                const jitterY = Math.sin(jitterAngle) * jitterDistance;
                const jitterReturnX = -jitterX * 0.55;
                const jitterReturnY = -jitterY * 0.55;
                const radialUnitX = ORBIT_RADIUS ? x / ORBIT_RADIUS : 0;
                const radialUnitY = ORBIT_RADIUS ? y / ORBIT_RADIUS : 0;
                const radialJitter = radialUnitX * jitterX + radialUnitY * jitterY;
                const radialReturn = radialUnitX * jitterReturnX + radialUnitY * jitterReturnY;
                const driftDuration = 5.4 + chaos * 3.6;
                const lineDuration = driftDuration * (0.92 + chaos * 0.18);
                const delay = `${driftDelaySeconds}s`;
                const pictogram = getEnginePictogram({ id: engine.id, label: engine.label, brandId: engine.brandId });

                return (
                  <div key={engine.id} className="absolute left-1/2 top-1/2">
                    <span
                      className={clsx(
                        styles.orbitLine,
                        'absolute left-1/2 top-1/2 w-px origin-top bg-gradient-to-b from-accent/45 via-white/20 to-transparent'
                      )}
                      style={
                        {
                          '--orbit-angle': `${angleDeg}deg`,
                          '--orbit-line-length': `${lineLength}px`,
                          '--orbit-delay': delay,
                          '--orbit-line-jitter': `${radialJitter}px`,
                          '--orbit-line-return': `${radialReturn}px`,
                          '--orbit-drift-duration': `${lineDuration}s`,
                        } as CSSProperties
                      }
                    />
                    <div
                      className={clsx(
                        styles.orbitIcon,
                        'absolute left-1/2 top-1/2 flex h-14 w-14 items-center justify-center rounded-3xl border border-white/60 bg-white/95 shadow-[0_18px_45px_-24px_rgba(64,73,105,0.55)] backdrop-blur'
                      )}
                      style={
                        {
                          '--orbit-x': `${x}px`,
                          '--orbit-y': `${y}px`,
                          '--orbit-jitter-x': `${jitterX}px`,
                          '--orbit-jitter-y': `${jitterY}px`,
                          '--orbit-jitter-return-x': `${jitterReturnX}px`,
                          '--orbit-jitter-return-y': `${jitterReturnY}px`,
                          '--orbit-delay': delay,
                          '--orbit-drift-duration': `${driftDuration}s`,
                        } as CSSProperties
                      }
                    >
                      <span
                        aria-label={`${engine.label} engine`}
                        role="img"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold leading-none text-opacity-90 shadow-sm"
                        style={{ backgroundColor: pictogram.backgroundColor, color: pictogram.textColor }}
                        title={engine.label}
                      >
                        {pictogram.code}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link
              href="/examples"
              className={clsx(
                styles.portalButton,
                'group absolute left-1/2 top-1/2 z-20 flex h-28 w-28 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-bg'
              )}
              aria-label={ctaLabel}
            >
              <span className="sr-only">{ctaLabel}</span>
              <GalleryGlyph className="h-8 w-8 text-white/95 drop-shadow-[0_6px_18px_rgba(18,35,75,0.25)] transition-[transform,color] duration-300 ease-out group-hover:scale-[1.24] group-hover:text-white" />
            </Link>
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-2 opacity-60 blur-3xl" aria-hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
