import type { ComponentProps } from 'react';
import clsx from 'clsx';
import { Button, ButtonLink } from '@/components/ui/Button';

type AdminActionLinkProps = ComponentProps<typeof ButtonLink>;
type AdminActionButtonProps = ComponentProps<typeof Button>;

export function AdminActionLink({
  className,
  variant = 'outline',
  size = 'sm',
  ...props
}: AdminActionLinkProps) {
  return (
    <ButtonLink
      {...props}
      variant={variant}
      size={size}
      className={clsx(variant === 'outline' && 'border-border bg-surface', className)}
    />
  );
}

export function AdminActionButton({
  className,
  variant = 'outline',
  size = 'sm',
  ...props
}: AdminActionButtonProps) {
  return (
    <Button
      {...props}
      variant={variant}
      size={size}
      className={clsx(variant === 'outline' && 'border-border bg-surface', className)}
    />
  );
}
