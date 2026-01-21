'use client';

import clsx from 'clsx';
import { Link } from '@/i18n/navigation';
import { type CSSProperties } from 'react';
import { getEnginePictogram } from '@/lib/engine-branding';
import { ButtonLink } from '@/components/ui/Button';
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

export function ExamplesOrbitCallout({ heading, description, ctaLabel, eyebrow, engines }: ExamplesOrbitCalloutProps) {
  const orbitEngines = engines.slice(0, 6);
  if (!orbitEngines.length) return null;

  return (
    <div className="container-page max-w-6xl">
      <div
        className={clsx(
          styles.calloutShell,
          'relative overflow-hidden rounded-[40px] border border-hairline bg-surface-glass-75 p-8 shadow-card sm:p-12'
        )}
      >
        <div className={clsx(styles.cardGlow, 'pointer-events-none absolute inset-0')} aria-hidden />
        <div
          className={clsx(
            styles.calloutMist,
            'pointer-events-none absolute -inset-px rounded-[42px] bg-gradient-to-b from-white/40 via-transparent to-white/20 opacity-80'
          )}
          aria-hidden
        />
        <div className="relative z-10 grid grid-gap-xl lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="stack-gap-lg text-center lg:text-left">
            {eyebrow ? (
              <span className="inline-flex items-center justify-center rounded-pill border border-hairline px-4 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                {eyebrow}
              </span>
            ) : null}
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{heading}</h2>
            <p className="text-sm text-text-secondary sm:text-base">{description}</p>
            <ButtonLink href="/examples" size="lg" className="shadow-card" linkComponent={Link}>
              {ctaLabel}
            </ButtonLink>
          </div>
          <div className="relative mx-auto hidden aspect-square w-full max-w-xs sm:max-w-sm lg:block">
            <div className="absolute inset-0 rounded-full border border-hairline" aria-hidden />
            <div className="absolute inset-8 rounded-full border border-hairline" aria-hidden />
            <div className={clsx(styles.convergenceField, 'pointer-events-none absolute inset-[18%] rounded-full')} aria-hidden />
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
                        'absolute left-1/2 top-1/2 w-px origin-top bg-gradient-to-b from-brand/25 via-brand/10 to-transparent'
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
                        'absolute left-1/2 top-1/2 flex h-14 w-14 items-center justify-center rounded-3xl border border-surface-on-media-60 bg-surface-glass-95 shadow-[0_18px_45px_-24px_rgba(64,73,105,0.55)]'
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
          </div>
        </div>
      </div>
    </div>
  );
}
