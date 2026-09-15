/** Decorative sprite animation; elapsed time and provider progress never drive it. */
export function GenerationPendingArtwork({ paused = false }: { paused?: boolean }) {
  return (
    <div className="generation-companion" data-paused={paused || undefined} aria-hidden="true">
      <div className="generation-companion-walk">
        <div className="generation-companion-sprite" />
      </div>
      <style jsx>{`
        .generation-companion {
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
          border-bottom: 1px solid color-mix(in srgb, currentColor 35%, transparent);
        }
        .generation-companion-walk {
          height: 100%;
          aspect-ratio: 1;
          animation: companion-stroll 10s ease-in-out infinite;
        }
        .generation-companion-sprite {
          width: 100%;
          height: 100%;
          background: url('/assets/illustrations/generation-companion-sprites.png') 0 0 / 400% 200% no-repeat;
          image-rendering: pixelated;
          animation: companion-steps 1.2s steps(1, end) infinite;
        }
        @keyframes companion-steps {
          0%, 100% { background-position: 0 0; }
          12.5% { background-position: 33.333333% 0; }
          25% { background-position: 66.666667% 0; }
          37.5% { background-position: 100% 0; }
          50% { background-position: 0 100%; }
          62.5% { background-position: 33.333333% 100%; }
          75% { background-position: 66.666667% 100%; }
          87.5% { background-position: 100% 100%; }
        }
        @keyframes companion-stroll {
          0%, 8% { transform: translateX(-18%) scaleX(1); }
          40%, 48% { transform: translateX(18%) scaleX(1); }
          49%, 56% { transform: translateX(18%) scaleX(-1); }
          88%, 98% { transform: translateX(-18%) scaleX(-1); }
          99%, 100% { transform: translateX(-18%) scaleX(1); }
        }
        .generation-companion[data-paused] * { animation: none; }
        @media (prefers-reduced-motion: reduce) {
          .generation-companion * { animation: none; }
        }
      `}</style>
    </div>
  );
}
