import Image from 'next/image';
import clsx from 'clsx';
import type { EngineCaps } from '@/types/engines';
import { getPartnerBrandMark } from '@/lib/brand-partners';
import { getEnginePictogram } from '@/lib/engine-branding';

type EngineIconSource = Pick<EngineCaps, 'id' | 'label' | 'brandId'> | null | undefined;

interface EngineIconProps {
  engine?: EngineIconSource;
  label?: string;
  size?: number;
  className?: string;
  rounded?: 'full' | 'xl';
  framed?: boolean;
  imageAlt?: string;
}

function computeFontSize(size: number) {
  return Math.max(12, Math.round(size * 0.44));
}

function computeMarkSize(size: number, scale: number, framed: boolean) {
  const framedScale = framed ? scale : Math.min(scale + 0.12, 0.9);
  return Math.max(14, Math.round(size * framedScale));
}

function isRenderableImageSrc(src: string | undefined) {
  const value = src?.trim();
  return Boolean(value && value.toLowerCase() !== 'image' && (value.startsWith('/') || /^https?:\/\//i.test(value)));
}

function resolveRenderableBrandMark(mark: ReturnType<typeof getPartnerBrandMark>) {
  if (!mark) return undefined;
  const light = isRenderableImageSrc(mark.light.src) ? mark.light : null;
  const dark = isRenderableImageSrc(mark.dark.src) ? mark.dark : null;
  const fallback = light ?? dark;
  if (!fallback) return undefined;
  return {
    light: light ?? fallback,
    dark: dark ?? fallback,
  };
}

export function EngineIcon({
  engine,
  label,
  size = 36,
  className,
  rounded = 'xl',
  framed = true,
  imageAlt,
}: EngineIconProps) {
  const explicitLabel = label ?? engine?.label ?? 'Engine';
  const resolvedBrandMark = getPartnerBrandMark({
    id: engine?.id ?? null,
    brandId: engine?.brandId ?? null,
  });
  const brandMark = resolveRenderableBrandMark(resolvedBrandMark);
  const pictogram = getEnginePictogram(
    {
      id: engine?.id ?? null,
      brandId: engine?.brandId ?? null,
      label: engine?.label ?? null,
    },
    explicitLabel
  );

  const borderRadiusClass = rounded === 'full' ? 'rounded-full' : 'rounded-card';
  const fontSize = computeFontSize(size);
  const markScale = brandMark?.light.scale ?? brandMark?.dark.scale ?? 0.64;
  const markSize = computeMarkSize(size, markScale, framed);
  const hasDistinctDarkMark = Boolean(brandMark && brandMark.dark.src !== brandMark.light.src);
  const useImageAlt = Boolean(brandMark && imageAlt);

  return (
    <div
      aria-label={useImageAlt ? undefined : `${explicitLabel} engine`}
      role={useImageAlt ? undefined : 'img'}
      className={clsx(
        'flex shrink-0 items-center justify-center overflow-hidden leading-none',
        framed &&
          'border border-black/[0.06] bg-black/[0.04] shadow-sm dark:border-white/[0.08] dark:bg-white/[0.08]',
        !brandMark && 'font-semibold tracking-tight text-opacity-90',
        borderRadiusClass,
        className
      )}
      style={{
        width: size,
        height: size,
        ...(!brandMark
          ? {
              backgroundColor: framed ? pictogram.backgroundColor : 'transparent',
              color: pictogram.textColor,
              fontSize,
            }
          : {}),
      }}
      title={explicitLabel}
    >
      {brandMark ? (
        <>
          <Image
            src={brandMark.light.src}
            alt={imageAlt ?? ''}
            aria-hidden={imageAlt ? undefined : 'true'}
            className={clsx(
              'block select-none object-contain',
              hasDistinctDarkMark && 'dark:hidden',
              !framed && !hasDistinctDarkMark && 'dark:brightness-0 dark:invert'
            )}
            width={markSize}
            height={markSize}
            sizes={`${markSize}px`}
            draggable={false}
            style={{
              width: markSize,
              maxWidth: 'none',
              height: markSize,
              objectFit: brandMark.light.fit ?? 'contain',
            }}
          />
          {hasDistinctDarkMark ? (
            <Image
              src={brandMark.dark.src}
              alt={imageAlt ?? ''}
              aria-hidden={imageAlt ? undefined : 'true'}
              className="hidden select-none object-contain dark:block"
              width={markSize}
              height={markSize}
              sizes={`${markSize}px`}
              draggable={false}
              style={{
                width: markSize,
                maxWidth: 'none',
                height: markSize,
                objectFit: brandMark.dark.fit ?? 'contain',
              }}
            />
          ) : null}
        </>
      ) : (
        <span>{pictogram.code}</span>
      )}
    </div>
  );
}
