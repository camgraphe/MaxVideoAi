type PartnerBadgesProps = {
  className?: string;
};

type PartnerBadgeEntry = {
  id: string;
  html: string;
};

const PARTNER_BADGES: PartnerBadgeEntry[] = [
  {
    id: 'taaft-featured',
    html: '<a href="https://theresanaiforthat.com/ai/maxvideoai/?ref=featured&v=8201228" target="_blank" rel="nofollow"><img width="300" src="https://media.theresanaiforthat.com/featured-on-taaft.png?width=600" alt="Featured on There\'s An AI For That"></a>',
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
    <div className={classes}>
      {PARTNER_BADGES.map((badge) => (
        <div
          key={badge.id}
          className="w-full max-w-[300px] aspect-[600/125] [&>a>img]:h-auto [&>a>img]:w-full"
          dangerouslySetInnerHTML={{ __html: badge.html }}
        />
      ))}
    </div>
  );
}
