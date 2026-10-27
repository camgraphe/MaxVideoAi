import { getRuntimeModelById } from '../../frontend/config/model-runtime';

/** Closed/rollback fixture in one disposable test process; never contacts a provider. */
export async function withClosedKlingV4Release<T>(run: () => T | Promise<T>): Promise<T> {
  const model = getRuntimeModelById('kling-v4')!;
  const original = model.publication.app.published;
  try {
    model.publication.app.published = false;
    return await run();
  } finally {
    model.publication.app.published = original;
  }
}
