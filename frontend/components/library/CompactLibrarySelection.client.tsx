'use client';
import { CompactLibraryPopup } from './CompactLibraryPopup.client';
import { compactLibraryCopy } from './compact-library-copy';
import type { useLibraryManagementSelection } from './useLibraryManagementSelection';

/** Selection scope commands; actions on the selection are exposed in their own bar. */
export function CompactLibrarySelection({ locale, selection, isLoading }: {
  locale: string;
  selection: ReturnType<typeof useLibraryManagementSelection>;
  isLoading: boolean;
}) {
  const copy = compactLibraryCopy(locale);
  return <CompactLibraryPopup className="compact-library-selection-trigger" label={copy.select} active={selection.count > 0}>
    {(close) => <div className="compact-library-selection">
      <button type="button" disabled={isLoading || selection.pending} onClick={() => { selection.selectLoaded(); close(); }}>{copy.selectLoaded}</button>
      <button type="button" disabled={isLoading || selection.pending} onClick={() => { void selection.selectAllResults(); close(); }}>{copy.selectResults}</button>
      <button type="button" disabled={!selection.count || selection.pending} onClick={() => { selection.clear(); close(); }}>{copy.clear}</button>
    </div>}
  </CompactLibraryPopup>;
}
