import clsx from 'clsx';
import type { EngineCaps } from '@/types/engines';
import { getEnginePictogram } from '@/lib/engine-branding';

type EngineIconSource = Pick<EngineCaps, 'id' | 'label' | 'brandId'> | null | undefined;

interface EngineIconProps {
  engine?: EngineIconSource;
  label?: string;
  size?: number;
  className?: string;
  rounded?: 'full' | 'xl';
}

function computeFontSize(size: number) {
  return Math.max(12, Math.round(size * 0.44));
}

export function EngineIcon({ engine, label, size = 36, className, rounded = 'xl' }: EngineIconProps) {
  const explicitLabel = label ?? engine?.label ?? 'Engine';
  const pictogram = getEnginePictogram(
    {
      id: engine?.id ?? null,
      brandId: engine?.brandId ?? null,
      label: engine?.label ?? null,
    },
    explicitLabel
  );

  const borderRadiusClass = rounded === 'full' ? 'rounded-full' : 'rounded-[12px]';
  const fontSize = computeFontSize(size);

  return (
    <div
      aria-label={`${explicitLabel} engine`}
      role="img"
      className={clsx(
        'flex items-center justify-center font-semibold leading-none tracking-tight shadow-sm text-opacity-90',
        borderRadiusClass,
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: pictogram.backgroundColor,
        color: pictogram.textColor,
        fontSize,
      }}
      title={explicitLabel}
    >
      <span>{pictogram.code}</span>
    </div>
  );
}
