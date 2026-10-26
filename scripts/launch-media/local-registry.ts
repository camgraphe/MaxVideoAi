import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, parse } from 'node:path';
import { check, readLocalFile, type Manifest, type Registration } from './manifest';
import type { Journal } from './private-staging';

/** Private operator files may never live in OUTREACH or any Git checkout. */
export async function privatePath(path: string, mustExist: boolean): Promise<string> {
  try {
    check(typeof path === 'string' && isAbsolute(path) && !path.split('/').includes('..'), 'PRIVATE_FILE');
    const parent = await realpath(dirname(path));
    const resolved = join(parent, parse(path).base);
    check(!resolved.split('/').some(part => part.toLowerCase() === 'outreach'), 'PRIVATE_FILE');
    const parentStat = await lstat(parent);
    check(parentStat.isDirectory() && (parentStat.mode & 0o077) === 0 && parentStat.uid === process.getuid?.(), 'PRIVATE_FILE');
    for (let directory = parent; ; directory = dirname(directory)) {
      let inRepository = false;
      try { await lstat(join(directory, '.git')); inRepository = true; } catch (error) {
        check((error as NodeJS.ErrnoException).code === 'ENOENT', 'PRIVATE_FILE');
      }
      check(!inRepository, 'PRIVATE_FILE');
      if (directory === dirname(directory)) break;
    }
    try {
      const stat = await lstat(resolved);
      check(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && (stat.mode & 0o077) === 0
        && stat.uid === process.getuid?.() && mustExist, 'PRIVATE_FILE');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || mustExist) throw error;
    }
    return resolved;
  } catch { throw new Error('LAUNCH_PRIVATE_FILE'); }
}

export async function readPrivateJson<T>(path: string): Promise<T> {
  try { return JSON.parse((await readLocalFile(await privatePath(path, true), 'PRIVATE_FILE')).toString('utf8')); }
  catch { throw new Error('LAUNCH_PRIVATE_FILE'); }
}

export async function writePrivateJson(path: string, value: unknown): Promise<void> {
  const destination = await privatePath(path, false);
  let handle;
  try {
    handle = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await handle.writeFile(`${JSON.stringify(value)}\n`); await handle.sync();
  } catch { throw new Error('LAUNCH_PRIVATE_FILE'); }
  finally { await handle?.close(); }
}

export async function loadPrivateRegistry(path: string) {
  const file = await readPrivateJson<{ schemaVersion: number; registration: Registration; manifestPath: string; statePath: string }>(path);
  check(file?.schemaVersion === 1 && file.registration && file.manifestPath !== file.statePath, 'PRIVATE_FILE');
  const manifest = await readPrivateJson<Manifest>(file.manifestPath);
  let state: Journal | undefined;
  let statePath: string;
  // Existing state is mandatory once written. Missing means a new batch, never an ignored parse/permission error.
  try { await lstat(file.statePath); statePath = await privatePath(file.statePath, true); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('LAUNCH_PRIVATE_FILE');
    statePath = await privatePath(file.statePath, false);
  }
  const lockPath = `${statePath}.lock`;
  let lock;
  try { lock = await open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
  catch { throw new Error('LAUNCH_LOCKED'); }
  let closed = false;
  const close = async () => {
    if (closed) return; closed = true;
    await lock.close(); await unlink(lockPath);
  };
  try {
    // Re-read after acquiring the cross-process lock.
    try { await lstat(statePath); state = await readPrivateJson<Journal>(statePath); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    return {
      manifest, registration: file.registration, state, close,
      async save(journal: Journal) {
        check(!closed, 'JOURNAL');
        const temp = `${statePath}.${randomUUID()}.tmp`;
        try {
          await writePrivateJson(temp, journal);
          // Refuse replacing a symlink or foreign/public file.
          try { await lstat(statePath); await privatePath(statePath, true); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
          await rename(temp, statePath);
          const directory = await open(dirname(statePath), constants.O_RDONLY);
          try { await directory.sync(); } finally { await directory.close(); }
        } catch { throw new Error('LAUNCH_JOURNAL'); }
        finally { await unlink(temp).catch(() => {}); }
      },
    };
  } catch (error) { await close(); throw error; }
}
