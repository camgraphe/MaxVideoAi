type PartnerBadgeProps = {
  className?: string;
};

export function PartnerBadge({ className }: PartnerBadgeProps) {
  const classes = ['w-full max-w-[240px] sm:max-w-[280px] md:max-w-[300px]', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <a
        href="https://theresanaiforthat.com/ai/maxvideoai/?ref=featured&v=8201228"
        target="_blank"
        rel="nofollow"
      >
        <img
          width="300"
          height="63"
          src="https://media.theresanaiforthat.com/featured-on-taaft.png?width=600"
          alt="Featured on There's An AI For That"
          loading="lazy"
          className="h-auto w-full"
        />
      </a>
    </div>
  );
}
