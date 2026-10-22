'use client';

import { forwardRef, useId, useState, type MouseEventHandler, type ReactNode } from 'react';

/** Shared compact interaction for gallery shortcuts and the existing menu. */
export const GalleryActionButton = forwardRef<HTMLButtonElement, {
  label: string;
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  menuOpen?: boolean;
}>(function GalleryActionButton({ label, children, onClick, disabled, menuOpen }, ref) {
  const tooltipId = useId();
  const [dismissed, setDismissed] = useState(false);
  const isMenu = menuOpen !== undefined;
  return <button
    ref={ref}
    type="button"
    className={`app-gallery-icon-action${isMenu ? ' app-gallery-menu-action' : ''}`}
    aria-label={label}
    aria-describedby={tooltipId}
    aria-haspopup={isMenu ? 'dialog' : undefined}
    aria-expanded={menuOpen}
    disabled={disabled}
    onClick={onClick}
    onPointerEnter={() => setDismissed(false)}
    onFocus={() => setDismissed(false)}
    onKeyDown={event => { if (event.key === 'Escape') setDismissed(true); }}
    data-tooltip-dismissed={dismissed || menuOpen || undefined}
  >
    <span className="app-gallery-action-face">{children}</span>
    <span id={tooltipId} role="tooltip" className="app-gallery-action-tooltip">{label}</span>
  </button>;
});
