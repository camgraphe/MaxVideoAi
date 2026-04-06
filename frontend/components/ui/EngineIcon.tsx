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
}

function computeFontSize(size: number) {
  return Math.max(12, Math.round(size * 0.44));
}

function computeMarkSize(size: number, scale: number, framed: boolean) {
  const framedScale = framed ? scale : Math.min(scale + 0.12, 0.9);
  return Math.max(14, Math.round(size * framedScale));
}

export function EngineIcon({
  engine,
  label,
  size = 36,
  className,
  rounded = 'xl',
  framed = true,
}: EngineIconProps) {
  const explicitLabel = label ?? engine?.label ?? 'Engine';
  const brandMark = getPartnerBrandMark({
    id: engine?.id ?? null,
    brandId: engine?.brandId ?? null,
  });
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

  return (
    <div
      aria-label={`${explicitLabel} engine`}
      role="img"
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
            alt=""
            aria-hidden="true"
            className="block select-none object-contain dark:hidden"
            width={markSize}
            height={markSize}
            sizes={`${markSize}px`}
            draggable={false}
            style={{
              width: markSize,
              height: markSize,
              objectFit: brandMark.light.fit ?? 'contain',
            }}
          />
          <Image
            src={brandMark.dark.src}
            alt=""
            aria-hidden="true"
            className="hidden select-none object-contain dark:block"
            width={markSize}
            height={markSize}
            sizes={`${markSize}px`}
            draggable={false}
            style={{
              width: markSize,
              height: markSize,
              objectFit: brandMark.dark.fit ?? 'contain',
            }}
          />
        </>
      ) : (
        <span>{pictogram.code}</span>
      )}
    </div>
  );
}
