import clsx from 'clsx';

type MarketingHeroImageProps = {
  src: string;
  darkSrc?: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
};

export function MarketingHeroImage({
  src,
  darkSrc,
  alt = '',
  className,
  imageClassName,
  sizes = '100vw',
  priority = true,
}: MarketingHeroImageProps) {
  const sharedImageClassName = clsx('h-full w-full pointer-events-none object-cover', imageClassName ?? 'object-center');

  return (
    <div aria-hidden={alt ? undefined : 'true'} className={clsx('pointer-events-none absolute inset-0', className)}>
      <picture className="block h-full w-full">
        {darkSrc ? <source media="(prefers-color-scheme: dark)" srcSet={darkSrc} /> : null}
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          sizes={sizes}
          className={sharedImageClassName}
        />
      </picture>
    </div>
  );
}
