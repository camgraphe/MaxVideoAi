import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { SVGProps } from 'react';

type UIIconProps = {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, 'ref'>;

export function UIIcon({ icon: Icon, size = 20, strokeWidth = 1.75, className, style, ...props }: UIIconProps) {
  const resolvedSize = size ?? 20;
  return (
    <Icon
      size={resolvedSize}
      strokeWidth={strokeWidth}
      className={clsx('text-current', className)}
      aria-hidden="true"
      focusable="false"
      style={{ width: resolvedSize, height: resolvedSize, ...style }}
      {...props}
    />
  );
}
