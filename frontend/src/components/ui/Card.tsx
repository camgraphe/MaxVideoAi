import clsx from 'clsx';
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'rounded-card border border-border bg-white shadow-card backdrop-blur-[2px]',
        className
      )}
      {...props}
    />
  )
);

Card.displayName = 'Card';
