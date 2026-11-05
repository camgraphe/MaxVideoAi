/** Models sharing Kling V4's owned media and durable fal queue protocol. */
export function isKlingV4FalQueueEngineId(id: string | null | undefined): boolean {
  return ['kling-v4', 'kling-v4-flash'].includes(id?.trim().toLowerCase() ?? '');
}
