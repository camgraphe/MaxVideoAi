'use client';
import { useSyncExternalStore } from 'react';
import type { LibraryImportQueueController } from '@/lib/library-import-queue';
import { MediaDialog } from './MediaDialog.client';
const copy = (locale: string) =>
  locale.startsWith('fr')
    ? {
        large: 'Ce fichier est trop volumineux pour être importé.',
        title: 'Importer des médias',
        close: 'Fermer',
        queued: 'En attente',
        uploading: 'Import en cours',
        success: 'Importé',
        failed: 'Échec',
        retry: 'Réessayer',
        pause: 'Suspendre après ce fichier',
        resume: 'Continuer',
        saved: 'Enregistré ; finalisation à réessayer',
        help: 'Les fichiers importés restent dans votre bibliothèque. Fermer cette fenêtre ne les supprime pas.',
        start: 'Importer',
      }
    : locale.startsWith('es')
      ? {
          large: 'Este archivo es demasiado grande para importarlo.',
          title: 'Importar medios',
          close: 'Cerrar',
          queued: 'En espera',
          uploading: 'Importando',
          success: 'Importado',
          failed: 'Error',
          retry: 'Reintentar',
          pause: 'Pausar después de este archivo',
          resume: 'Continuar',
          saved: 'Guardado; reintentar finalización',
          help: 'Los archivos importados permanecen en tu biblioteca. Cerrar esta ventana no los elimina.',
          start: 'Importar',
        }
      : {
          large: 'This file is too large to import.',
          title: 'Import media',
          close: 'Close',
          queued: 'Queued',
          uploading: 'Importing',
          success: 'Imported',
          failed: 'Failed',
          retry: 'Retry',
          pause: 'Pause after this file',
          resume: 'Continue',
          saved: 'Saved; retry completion',
          help: 'Imported files remain in your library. Closing this window does not delete them.',
          start: 'Import',
        };
/** Inline content, no portal/focus trap: picker hosts can reuse this exact queue. */
export function LibraryImportQueue({
  queue,
  locale,
}: {
  queue: LibraryImportQueueController;
  locale: string;
}) {
  const state = useSyncExternalStore(
      queue.subscribe,
      queue.getSnapshot,
      queue.getSnapshot,
    ),
    labels = copy(locale);
  return (
    <section className="app-library-import">
      <p>{labels.help}</p>
      <ul aria-live="polite">
        {state.files.map((file) => (
          <li key={file.id}>
            <span>{file.name}</span>
            <span>
              {file.saved && file.status === 'failed'
                ? labels.saved
                : file.error === 'FILE_TOO_LARGE'
                  ? labels.large
                  : labels[file.status]}
            </span>
            {file.status === 'failed' ? (
              <button
                type="button"
                disabled={state.running}
                onClick={() => void queue.retry(file.id)}
              >
                {labels.retry}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {state.running ? (
        <button
          type="button"
          onClick={() => (state.paused ? queue.resume() : queue.pause())}
        >
          {state.paused ? labels.resume : labels.pause}
        </button>
      ) : state.files.some((file) => file.status === 'queued') ? (
        <button
          type="button"
          onClick={() => {
            queue.resume();
            void queue.start();
          }}
        >
          {labels.start}
        </button>
      ) : null}
    </section>
  );
}
export function LibraryImportDialog({
  queue,
  locale,
  onClose,
}: {
  queue: LibraryImportQueueController;
  locale: string;
  onClose: () => void;
}) {
  const labels = copy(locale);
  return (
    <MediaDialog
      title={labels.title}
      closeLabel={labels.close}
      onClose={onClose}
    >
      <LibraryImportQueue queue={queue} locale={locale} />
    </MediaDialog>
  );
}
