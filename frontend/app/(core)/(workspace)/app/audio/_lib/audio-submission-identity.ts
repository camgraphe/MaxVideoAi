/** A lost HTTP response must reuse the same account-bound attempt, including after reload. */
export function getAudioSubmissionId(owner: string, inputKey: string, memory: Map<string, string>): string {
  const key = `maxvideoai.audio.submission.v1:${owner}:${inputKey}`;
  if (memory.has(key)) return memory.get(key)!;
  let id: string | null = null;
  try { id = sessionStorage.getItem(key); } catch { /* Session memory still protects a retry. */ }
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) id = crypto.randomUUID();
  memory.set(key, id);
  try { sessionStorage.setItem(key, id); } catch { /* Do not block generation when browser storage is unavailable. */ }
  return id;
}

export function clearAudioSubmissionId(owner: string, inputKey: string, memory: Map<string, string>) {
  const key = `maxvideoai.audio.submission.v1:${owner}:${inputKey}`;
  memory.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* No request data is stored outside this scope. */ }
}
