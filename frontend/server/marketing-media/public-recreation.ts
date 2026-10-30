const privateBindingKeys = new Set(['assetid', 'frontalassetid', 'videoassetid', 'referenceassetids',
  'sourceoutputid', 'sourcejobid', 'userid', 'ownerid', 'jobid']);

/** Public creative settings can retain media URLs, but never another account's owned-source bindings. */
export function sanitizePublicRecreationSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizePublicRecreationSnapshot);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !privateBindingKeys.has(key.replace(/[_-]/g, '').toLowerCase()))
        .map(([key, item]) => [key, sanitizePublicRecreationSnapshot(item)]),
    );
  }
  return value;
}
