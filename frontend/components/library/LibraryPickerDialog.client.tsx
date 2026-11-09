'use client';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { useLibraryImportQueue } from '@/hooks/useLibraryImportQueue';
import { AssetLibraryBrowser, type AssetLibraryBrowserProps } from './AssetLibraryBrowser';
import type { LibraryImportQueueController } from '@/lib/library-import-queue';
import type { ReferencePickerSelection } from './ReferenceLibraryPicker.client';
type Props = Omit<AssetLibraryBrowserProps, 'selection'> & {
  open: boolean;
  userId: string | null | undefined;
  intent: string;
  selection: Omit<ReferencePickerSelection, 'scope'>;
  allowImport?: boolean;
};
/** The caller owns destination intent and admission; this host owns only dialog/queue lifetime. */
export function LibraryPickerDialog(props: Props) {
  const intent = useRef(props.intent);
  if (props.open) intent.current = props.intent;
  const imports = useLibraryImportQueue(props.userId ?? undefined, intent.current);
  return props.open ? (
    <OpenLibraryPickerDialog key={JSON.stringify([props.userId, props.intent])} {...props} queue={imports.queue} />
  ) : null;
}
function OpenLibraryPickerDialog({
  selection,
  userId,
  intent,
  allowImport = true,
  queue,
  ...props
}: Props & { queue: LibraryImportQueueController }) {
  const [busy, setBusy] = useState(false);
  const close = () => {
    if (!busy && !selection.busy) props.onClose?.();
  };
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose: close, closeDisabled: busy || selection.busy });
  return createPortal(
    <div
      className="app-experience app-library-picker-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="app-picker-host"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
      >
        <AssetLibraryBrowser
          {...props}
          onClose={close}
          selection={{
            ...selection,
            ownerId: userId,
            scope: JSON.stringify([userId, intent]),
            importQueue: allowImport ? queue : undefined,
            onBusyChange: (value) => {
              setBusy(value);
              selection.onBusyChange?.(value);
            },
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
