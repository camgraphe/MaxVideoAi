import clsx from 'clsx';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import type { EngineCaps } from '@/types/engines';

type EngineIconSource = Pick<EngineCaps, 'iconUrl' | 'fallbackIcon' | 'label' | 'id'> | null | undefined;

interface EngineIconProps {
  engine?: EngineIconSource;
  label?: string;
  iconUrl?: string | null;
  fallbackIcon?: string | null;
  size?: number;
  className?: string;
  rounded?: 'full' | 'xl';
}

export function EngineIcon({
  engine,
  label,
  iconUrl,
  fallbackIcon,
  size = 36,
  className,
  rounded = 'xl',
}: EngineIconProps) {
  const explicitLabel = label ?? engine?.label ?? 'Engine icon';
  const primarySrc = iconUrl ?? engine?.iconUrl ?? undefined;
  const backupSrc = fallbackIcon ?? engine?.fallbackIcon ?? '/icons/engines/engine-generic.svg';

  const [src, setSrc] = useState<string>(primarySrc ?? backupSrc);
  const [hasTriedPrimary, setHasTriedPrimary] = useState(Boolean(primarySrc));

  const initials = useMemo(() => {
    const source = explicitLabel.trim();
    if (!source) return 'MV';
    const tokens = source.split(/\s|—|-/).filter(Boolean);
    if (tokens.length >= 2) {
      return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [explicitLabel]);

  const borderRadiusClass = rounded === 'full' ? 'rounded-full' : 'rounded-[12px]';

  return (
    <div
      className={clsx(
        'flex items-center justify-center border border-hairline bg-white/90 text-[11px] font-semibold text-text-primary',
        borderRadiusClass,
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={`${explicitLabel} logo`}
          width={size}
          height={size}
          className={clsx('object-contain', rounded === 'full' ? 'rounded-full' : 'rounded-[10px]')}
          onError={() => {
            if (!hasTriedPrimary && primarySrc) {
              setHasTriedPrimary(true);
              setSrc(backupSrc);
              return;
            }
            if (src !== backupSrc) {
              setSrc(backupSrc);
            } else {
              setSrc('');
            }
          }}
          priority={false}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

