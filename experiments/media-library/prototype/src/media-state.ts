import type { MediaItem, MediaKind, SelectionIntent, ToolTarget } from './types';

export const TARGETS: { id: ToolTarget; name: string; description: string; roles: SelectionIntent[] }[] = [
  { id: 'image-references', name: 'Créer une image', description: 'Références ordonnées', roles: [{ target: 'image-references', title: 'Ajouter des références', role: 'reference', kinds: ['image'], max: 4 }] },
  { id: 'angle', name: 'Angle', description: 'Une image source', roles: [{ target: 'angle', title: 'Choisir l’image source', role: 'source', kinds: ['image'], max: 1 }] },
  { id: 'upscale', name: 'Upscale', description: 'Une image ou une vidéo', roles: [{ target: 'upscale', title: 'Choisir le média à agrandir', role: 'source', kinds: ['image', 'video'], max: 1 }] },
  { id: 'lip-sync', name: 'Lip Sync', description: 'Un visuel et une piste audio', roles: [{ target: 'lip-sync', title: 'Choisir une photo ou une vidéo', role: 'source', kinds: ['image', 'video'], max: 1 }, { target: 'lip-sync', title: 'Choisir la piste audio', role: 'audio', kinds: ['audio'], max: 1 }] },
  { id: 'motion-transfer', name: 'Motion Transfer', description: 'Personnage et mouvement', roles: [{ target: 'motion-transfer', title: 'Choisir le personnage', role: 'source', kinds: ['image'], max: 1 }, { target: 'motion-transfer', title: 'Choisir la vidéo de mouvement', role: 'motion', kinds: ['video'], max: 1 }] },
  { id: 'subtitles', name: 'Sous-titres', description: 'Une vidéo ou un audio', roles: [{ target: 'subtitles', title: 'Choisir la source des sous-titres', role: 'source', kinds: ['video', 'audio'], max: 1 }] },
  { id: 'studio', name: 'Studio', description: 'Ajouter à une séquence', roles: [{ target: 'studio', title: 'Ajouter des médias à Studio', role: 'timeline', kinds: ['image', 'video', 'audio'], max: 12 }] },
];

export const KIND_LABELS: Record<MediaKind, string> = { image: 'Image', video: 'Vidéo', audio: 'Audio' };
export const formatCount = (count: number) => new Intl.NumberFormat('fr-FR').format(count);
export function durationLabel(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return '—';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
export function ratioLabel(item: Pick<MediaItem, 'width' | 'height' | 'kind'>) {
  if (item.kind === 'audio' || !item.width || !item.height) return '';
  const ratio = item.width / item.height;
  if (Math.abs(ratio - 16 / 9) < 0.025) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.025) return '9:16';
  if (Math.abs(ratio - 1) < 0.025) return '1:1';
  return `${item.width} × ${item.height}`;
}
export function explicitSelection(keys: 'all' | ReadonlySet<string | number>, items: MediaItem[]) {
  return keys === 'all' ? new Set(items.map(item => item.id)) : new Set([...keys].map(String));
}
export function allowedForIntent(item: MediaItem, intent: SelectionIntent) {
  return intent.kinds.includes(item.kind);
}
