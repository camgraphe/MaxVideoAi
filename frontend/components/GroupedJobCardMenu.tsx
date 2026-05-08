'use client';

import clsx from 'clsx';
import type { Ref } from 'react';
import type { GroupSummary } from '@/types/groups';
import { Button, ButtonLink } from '@/components/ui/Button';
import type { GroupedJobAction, GroupedJobMenuVariant } from './grouped-job-card-types';

interface GroupedJobCardMenuProps {
  allowRemove: boolean;
  closeMenu: () => void;
  group: GroupSummary;
  handleAction: (action: GroupedJobAction) => void;
  handleRemake: () => void;
  isImageGroup: boolean;
  menuRef: Ref<HTMLDivElement>;
  menuVariant: GroupedJobMenuVariant;
  onOpen?: (group: GroupSummary) => void;
  openLabel: string;
  recreateHref?: string;
  recreateLabel: string;
  savingToLibrary: boolean;
}

export function GroupedJobCardMenu({
  allowRemove,
  closeMenu,
  group,
  handleAction,
  handleRemake,
  isImageGroup,
  menuRef,
  menuVariant,
  onOpen,
  openLabel,
  recreateHref,
  recreateLabel,
  savingToLibrary,
}: GroupedJobCardMenuProps) {
  const showAdvancedMenuActions = menuVariant === 'full';
  const showGalleryActions = menuVariant === 'gallery';
  const showGalleryImageActions = menuVariant === 'gallery-image';

  return (
    <div
      ref={menuRef}
      className="absolute right-3 top-12 z-40 w-48 rounded-card border border-border bg-surface p-2 text-sm text-text-secondary shadow-card"
    >
      {showGalleryActions ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleAction('open')}
            className="w-full justify-between rounded-input px-2 py-1.5 text-left"
          >
            <span>Preview</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemake}
            disabled={!onOpen}
            className={clsx(
              'mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left',
              onOpen ? '' : 'cursor-not-allowed opacity-60'
            )}
          >
            <span>Remake</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleAction('download')}
            className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
          >
            <span>Download</span>
          </Button>
        </>
      ) : showGalleryImageActions ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleAction('open')}
            className="w-full justify-between rounded-input px-2 py-1.5 text-left"
          >
            <span>Open</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleAction('save-image')}
            className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
          >
            <span>Add to Library</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleAction('download')}
            className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
          >
            <span>Download</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleAction('copy')}
            className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
          >
            <span>Copy link</span>
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleAction('open')}
            className="w-full justify-between rounded-input px-2 py-1.5 text-left"
          >
            <span>{openLabel}</span>
            <span className="text-[11px] text-text-muted">↵</span>
          </Button>
          {recreateHref ? (
            <ButtonLink
              href={recreateHref}
              variant="ghost"
              size="sm"
              onClick={closeMenu}
              className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
            >
              <span>{recreateLabel}</span>
            </ButtonLink>
          ) : null}
          {showAdvancedMenuActions ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAction('continue')}
                className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
              >
                <span>Continue (Hero)</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAction('refine')}
                className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
              >
                <span>Refine (Hero)</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAction('branch')}
                className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
              >
                <span>Branch</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAction('compare')}
                className="mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left"
              >
                <span>Compare</span>
              </Button>
            </>
          ) : null}
        </>
      )}
      {isImageGroup && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleAction('save-image')}
          className={clsx('mt-1 w-full justify-between rounded-input px-2 py-1.5 text-left', savingToLibrary ? 'opacity-60' : '')}
          disabled={savingToLibrary}
        >
          <span>{savingToLibrary ? 'Saving…' : 'Add to Library'}</span>
        </Button>
      )}
      {allowRemove && group.count <= 1 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleAction('remove')}
          className="mt-2 w-full justify-between rounded-input px-2 py-1.5 text-left text-error hover:bg-error-bg"
        >
          <span>Remove</span>
        </Button>
      )}
    </div>
  );
}
