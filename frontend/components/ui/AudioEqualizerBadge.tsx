import clsx from 'clsx';

type AudioEqualizerBadgeProps = {
  className?: string;
  label?: string;
  tone?: 'dark' | 'light';
  size?: 'sm' | 'md';
};

/**
 * Displays a subtle animated equalizer to indicate that the media track provides audio.
 * The animation respects the prefers-reduced-motion setting and pauses automatically.
 */
export function AudioEqualizerBadge({
  className,
  label = 'Audio available',
  tone = 'dark',
  size = 'md',
}: AudioEqualizerBadgeProps) {
  return (
    <span
      className={clsx(
        'audio-badge absolute bottom-3 right-3',
        tone === 'light' ? 'audio-badge--light' : 'audio-badge--dark',
        size === 'sm' ? 'audio-badge--sm' : 'audio-badge--md',
        className
      )}
    >
      <span className="audio-badge__icon" aria-hidden>
        <span className="audio-badge__bar audio-badge__bar--a" />
        <span className="audio-badge__bar audio-badge__bar--b" />
        <span className="audio-badge__bar audio-badge__bar--c" />
        <span className="audio-badge__bar audio-badge__bar--d" />
        <span className="audio-badge__bar audio-badge__bar--e" />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
