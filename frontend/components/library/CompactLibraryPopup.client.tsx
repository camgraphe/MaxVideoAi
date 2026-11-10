'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components';
import { ChevronDown } from 'lucide-react';

/** Commands stay out of the canvas; React Aria owns focus, Escape and outside dismissal. */
export function CompactLibraryPopup({
  label,
  children,
  active = false,
  className = '',
  disabled = false,
  icon,
}: {
  label: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  active?: boolean;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button
        ref={trigger}
        className={`compact-library-menu-trigger ${className}`}
        data-active={active || undefined}
        isDisabled={disabled}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown size={14} aria-hidden />
      </Button>
      <Popover
        // Keep overlays inside a native dialog's top layer and the host focus boundary.
        UNSTABLE_portalContainer={trigger.current?.closest('dialog, [role="dialog"]') ?? undefined}
        placement="bottom start"
        offset={6}
        className="app-experience compact-library compact-library-popover"
      >
        <div onKeyDown={event => {
          if (event.key === 'Tab' || event.key === 'Escape') event.stopPropagation();
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
        }}>
        <Dialog aria-label={label}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </Dialog>
        </div>
      </Popover>
    </DialogTrigger>
  );
}
