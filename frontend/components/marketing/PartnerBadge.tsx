type PartnerBadgeProps = {
  className?: string;
};

export function PartnerBadge({ className }: PartnerBadgeProps) {
  const classes = [
    'w-full max-w-[300px] aspect-[600/125] [&>a>img]:h-auto [&>a>img]:w-full',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <a
        href="https://theresanaiforthat.com/ai/maxvideoai/?ref=featured&v=8201228"
        target="_blank"
        rel="nofollow"
      >
        <img width="300" src="https://media.theresanaiforthat.com/featured-on-taaft.png?width=600" />
      </a>
    </div>
  );
}
