'use client';
import { compactLibraryCopy } from './compact-library-copy';
import type { useLibraryManagementSelection } from './useLibraryManagementSelection';

/** Selection scope commands; actions on the selection are exposed in their own bar. */
export function CompactLibrarySelection({ locale, selection, isLoading, onClose }: {
  locale: string;
  selection: ReturnType<typeof useLibraryManagementSelection>;
  isLoading: boolean;
  onClose: () => void;
}) {
  const copy = compactLibraryCopy(locale);
  return <div className="compact-library-selection" role="group" aria-label={copy.select}>
    <button type="button" disabled={isLoading || selection.pending} onClick={() => { selection.selectLoaded(); onClose(); }}>{copy.selectLoaded}</button>
    <button type="button" disabled={isLoading || selection.pending} onClick={() => { void selection.selectAllResults(); onClose(); }}>{copy.selectResults}</button>
    <button type="button" disabled={!selection.count || selection.pending} onClick={() => { selection.clear(); onClose(); }}>{copy.clear}</button>
  </div>;
}
