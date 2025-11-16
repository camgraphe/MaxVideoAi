import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { SVGProps } from 'react';

type UIIconProps = {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, 'ref'>;

export function UIIcon({ icon: Icon, size = 20, strokeWidth = 1.75, className, ...props }: UIIconProps) {
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={clsx('text-current', className)}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}
