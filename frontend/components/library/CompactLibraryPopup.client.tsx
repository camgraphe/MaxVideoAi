'use client';

import { useState, type ReactNode } from 'react';
import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components';
import { ChevronDown } from 'lucide-react';

/** Commands stay out of the canvas; React Aria owns focus, Escape and outside dismissal. */
export function CompactLibraryPopup({
  label,
  children,
  active = false,
  className = '',
  disabled = false,
}: {
  label: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  active?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button
        className={`compact-library-menu-trigger ${className}`}
        data-active={active || undefined}
        isDisabled={disabled}
      >
        <span>{label}</span>
        <ChevronDown size={14} aria-hidden />
      </Button>
      <Popover
        placement="bottom start"
        offset={6}
        className="app-experience compact-library compact-library-popover"
      >
        <Dialog aria-label={label}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
