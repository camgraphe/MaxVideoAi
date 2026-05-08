export function StartupFameLink({ label = 'Featured on Startup Fame', className }: { label?: string; className?: string }) {
  const classes = [
    'inline-flex items-center justify-center rounded-pill px-2.5 py-1 text-[10px] font-semibold uppercase tracking-micro text-text-muted/70 transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:text-white/45 dark:hover:text-white/70',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <a
      href="https://startupfa.me/s/maxvideoai?utm_source=maxvideoai.com"
      target="_blank"
      rel="noopener noreferrer"
      className={classes}
      aria-label={label}
    >
      {label}
    </a>
  );
}
