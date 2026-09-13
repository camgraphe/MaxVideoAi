// Read-only interaction projection from the real catalogue. Submission validation
// and quotes stay in the app; this prototype never sends a generation request.
const starts = new Set(['image_url', 'first_frame_url', 'start_image_url']);
const ends = new Set(['last_frame_url', 'end_image_url']);
const names = { first: 'Image de départ', last: 'Image de fin', image_urls: 'Références image',
  video_url: 'Vidéo à modifier', video_urls: 'Références vidéo', audio_urls: 'Références audio',
  extension_source_videos: 'Vidéos à prolonger' };
export function referenceProfile(model) {
  const grouped = new Map();
  for (const field of model.referenceFields ?? []) {
    const id = starts.has(field.id) ? 'first' : ends.has(field.id) ? 'last' : field.id;
    const role = grouped.get(id) ?? { id, kind: field.kind, name: names[id] ?? `Référence ${field.kind}`, max: 0, fields: [], modes: [] };
    role.fields.push(field);
    role.max = Math.max(role.max, field.max);
    role.modes = [...new Set([...role.modes, ...field.modes])];
    grouped.set(id, role);
  }
  const roles = [...grouped.values()];
  return { roles, max: roles.reduce((sum, role) => sum + role.max, 0), kind: 'video', modes: model.inputModes };
}
export function referenceMode(profile, refs) {
  if (!refs.length) return profile.modes?.includes('t2v') ? 't2v' : null;
  return ['i2v', 'fl2v', 'ref2v', 'r2v', 'v2v', 'extend'].find(mode =>
    profile.modes?.includes(mode) && refs.every(ref => profile.roles.find(role => role.id === ref.role)?.modes.includes(mode))) ?? null;
}
export function requiredReferences(profile, refs) {
  const mode = referenceMode(profile, refs);
  return mode ? profile.roles.filter(role => role.fields.some(field => field.requiredInModes.includes(mode)) && !refs.some(ref => ref.role === role.id)) : [];
}
