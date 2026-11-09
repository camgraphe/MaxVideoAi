import Uppy, { RestrictionError } from '@uppy/core';
import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import {
  importLibraryFile,
  finishLibraryImport,
  LibraryImportCompletionError,
} from './library-file-import';
export type LibraryImportItem = {
  id: string;
  name: string;
  status: 'queued' | 'uploading' | 'success' | 'failed';
  error?: string;
  result?: AssetBrowserAsset;
  saved?: boolean;
};
export type LibraryImportSnapshot = {
  files: LibraryImportItem[];
  running: boolean;
  paused: boolean;
};
export function createLibraryImportQueue({
  userId,
  upload = importLibraryFile,
}: {
  userId: string;
  upload?: (
    file: File,
    context: { userId: string; signal: AbortSignal },
  ) => Promise<AssetBrowserAsset>;
}) {
  const selectionIds = new WeakMap<object, string>();
  let nextSelectionId = 0;
  const uppy = new Uppy<Record<string, unknown>, { asset: AssetBrowserAsset }>({
    autoProceed: false,
    allowMultipleUploadBatches: true,
    onBeforeFileAdded(file, files) {
      if (!file.data) return false;
      // Name, size, MIME and mtime do not prove equal bytes. Only the same immutable
      // File object may reuse a queue result; fresh selections use the real import
      // owner's content identity. This never reads a large file into memory.
      const id = selectionIds.get(file.data) ?? `library-selection-${++nextSelectionId}`;
      selectionIds.set(file.data, id);
      file.id = id;
      return files[id] ? false : file;
    },
  });
  const listeners = new Set<() => void>();
  const controller = new AbortController();
  const completions = new Map<
    string,
    (signal: AbortSignal) => Promise<AssetBrowserAsset>
  >();
  let retired = false,
    wake: (() => void) | undefined;
  let snapshot: LibraryImportSnapshot = {
    files: [],
    running: false,
    paused: false,
  };
  function publish(patch: Partial<LibraryImportSnapshot>) {
    if (retired) return;
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  }
  function item(id: string, patch: Partial<LibraryImportItem>) {
    publish({
      files: snapshot.files.map((file) =>
        file.id === id ? { ...file, ...patch } : file,
      ),
    });
  }
  uppy.addUploader(async (ids) => {
    publish({ running: true });
    try {
      for (const id of ids) {
        if (retired) break;
        if (snapshot.files.find((file) => file.id === id)?.status === 'success')
          continue;
        if (snapshot.paused)
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        if (retired) break;
        const file = uppy.getFile(id);
        if (!file) continue;
        item(id, { status: 'uploading', error: undefined });
        try {
          const result = completions.has(id)
            ? await completions.get(id)!(controller.signal)
            : await upload(file.data as File, {
                userId,
                signal: controller.signal,
              });
          if (retired) break;
          completions.delete(id);
          item(id, { status: 'success', result, saved: true });
          uppy.emit('upload-success', file, {
            status: 200,
            body: { asset: result },
            uploadURL: result.url,
          });
        } catch (error) {
          if (retired) break;
          if (error instanceof LibraryImportCompletionError)
            completions.set(id, error.finish);
          const message =
            error instanceof Error ? error.message : 'UPLOAD_FAILED';
          item(id, {
            status: 'failed',
            error: message,
            ...(error instanceof LibraryImportCompletionError
              ? { result: error.asset, saved: true }
              : {}),
          });
          uppy.emit('upload-error', file, new Error(message));
        }
      }
    } finally {
      publish({ running: false });
    }
  });
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    add(files: File[]) {
      if (retired) return;
      for (const file of files) {
        try {
          const id = uppy.addFile({
            name: file.name,
            type: file.type,
            data: file,
          });
          publish({
            files: [
              ...snapshot.files,
              { id, name: file.name, status: 'queued' },
            ],
          });
        } catch (error) {
          // Only an exact File-object reselection is a queue duplicate. Other SDK
          // restrictions remain failures, even for an already known selection.
          if (
            !(error instanceof RestrictionError) ||
            !error.file ||
            error.message !==
              uppy.i18n('noDuplicates', {
                fileName: error.file.name ?? uppy.i18n('unnamed'),
              })
          )
            throw error;
          const existing = uppy.getFile(error.file.id);
          if (!existing) throw error;
          const accepted = snapshot.files.find(
            (entry) => entry.id === existing.id,
          );
          // A new explicit same-file import may mean Restore after Trash. Finish the
          // existing canonical import instead of silently ignoring it or uploading again.
          if (
            accepted?.status === 'success' &&
            accepted.result &&
            upload === importLibraryFile
          ) {
            completions.set(existing.id, (signal) =>
              finishLibraryImport(accepted.result!, userId, signal),
            );
            uppy.setFileState(existing.id, {
              progress: { ...existing.progress, uploadComplete: false },
              error: null,
            });
            item(existing.id, { status: 'queued', saved: true });
          }
        }
      }
    },
    async start() {
      if (!retired && !snapshot.running) await uppy.upload();
    },
    async retry(id: string) {
      if (
        !retired &&
        !snapshot.running &&
        snapshot.files.find((file) => file.id === id)?.status === 'failed'
      )
        await uppy.retryUpload(id);
    },
    pause() {
      publish({ paused: true });
    },
    resume() {
      publish({ paused: false });
      wake?.();
      wake = undefined;
    },
    retire() {
      if (retired) return;
      retired = true;
      controller.abort();
      wake?.();
      completions.clear();
      uppy.destroy();
      listeners.clear();
      snapshot = { files: [], running: false, paused: false };
    },
  };
}
export type LibraryImportQueueController = ReturnType<
  typeof createLibraryImportQueue
>;
