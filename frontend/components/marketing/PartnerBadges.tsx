type PartnerBadgesProps = {
  className?: string;
};

type PartnerBadgeEntry = {
  id: string;
  html: string;
  className?: string;
};

const PARTNER_BADGES: PartnerBadgeEntry[] = [
  {
    id: 'taaft-featured',
    html: '<a href="https://theresanaiforthat.com/ai/maxvideoai/?ref=featured&v=8201228" target="_blank" rel="nofollow"><img width="300" loading="lazy" decoding="async" src="https://media.theresanaiforthat.com/featured-on-taaft.png?width=600" alt="Featured on There\'s An AI For That"></a>',
  },
  {
    id: 'startup-fame-featured',
    className: 'max-w-[224px] aspect-[224/36]',
    html: '<a href="https://startupfa.me/s/maxvideoai?utm_source=maxvideoai.com" target="_blank"><img src="https://startupfa.me/badges/featured-badge-small.webp" alt="MaxVideoAI - Featured on Startup Fame" width="224" height="36" loading="lazy" decoding="async" /></a>',
  },
];

export function PartnerBadges({ className }: PartnerBadgesProps) {
  const classes = [
    'flex flex-wrap items-center gap-6',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={classes}>
        {PARTNER_BADGES.map((badge) => (
          <div
            key={badge.id}
            className={[
              'w-full max-w-[300px] aspect-[600/125] [&>a>img]:h-auto [&>a>img]:w-full',
              badge.className,
            ]
              .filter(Boolean)
              .join(' ')}
            dangerouslySetInnerHTML={{ __html: badge.html }}
          />
        ))}
      </div>
      <a
        href="https://startupfa.me"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-text-muted underline underline-offset-2 transition hover:text-text-primary"
      >
        Listed on Startup Fame
      </a>
    </div>
  );
}
