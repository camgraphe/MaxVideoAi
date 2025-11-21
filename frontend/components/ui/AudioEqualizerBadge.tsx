import clsx from 'clsx';
import styles from './audio-badge.module.css';

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
        styles.badge,
        'absolute bottom-3 right-3',
        tone === 'light' ? styles.light : styles.dark,
        size === 'sm' ? styles.sm : styles.md,
        className
      )}
    >
      <span className={styles.icon} aria-hidden>
        <span className={clsx(styles.bar, styles.barA)} />
        <span className={clsx(styles.bar, styles.barB)} />
        <span className={clsx(styles.bar, styles.barC)} />
        <span className={clsx(styles.bar, styles.barD)} />
        <span className={clsx(styles.bar, styles.barE)} />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
