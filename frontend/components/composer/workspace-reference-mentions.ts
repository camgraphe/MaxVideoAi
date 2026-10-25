import type { AssetFieldConfig, ComposerAttachment } from './composer-types';
import type { EngineCaps, EngineInputField } from '@/types/engines';
import { isKlingOmniEngine, normalizeKlingOmniPromptReferences } from '@/lib/kling-provider-limits';

export type ReferenceMention = { fieldId: string; slotIndex: number; token: string; identity: string; syntax?: 'kling-omni' };

function tokenPattern(engine: EngineCaps, field: EngineInputField): string | null {
  // A slot label is not automatically a provider prompt binding (for example character{n}).
  if (field.type === 'image' && field.slotLabelPattern === '@Image{n}') return '@Image{n}';
  if (engine.id === 'grok-imagine-video-1-5' && field.slotLabelPattern === '<IMAGE_{n}>') return '<IMAGE_{n}>';
  if (engine.id.startsWith('kling-o3-') && field.id === 'video_url' && field.description?.includes('@Video1')) return '@Video{n}';
  if (engine.id === 'wan-2-6' && field.id === 'video_urls') return '@Video{n}';
  return null;
}

/** Mirrors the submitted URL lists: compact null slots and deduplicate canonical URLs. */
export function buildReferenceMentions(engine: EngineCaps, fields: AssetFieldConfig[], assets: Record<string, (ComposerAttachment | null)[]>): ReferenceMention[] {
  const groups = new Map<string, string[]>();
  return fields.flatMap(({ field }) => {
    const pattern = tokenPattern(engine, field);
    if (!pattern) return [];
    const identities = groups.get(pattern) ?? [];
    groups.set(pattern, identities);
    return (assets[field.id] ?? []).flatMap((asset, slotIndex) => {
      if (!asset) return [];
      const identity = asset.url ?? asset.id ?? asset.previewUrl;
      let index = identities.indexOf(identity);
      if (index === -1) { index = identities.length; identities.push(identity); }
      return [{ fieldId: field.id, slotIndex, identity, token: pattern.replace('{n}', String(index + (pattern === '<IMAGE_{n}>' ? 0 : 1))),
        ...(isKlingOmniEngine(engine.id) ? { syntax: 'kling-omni' as const } : {}) }];
    });
  });
}

function containsMention(prompt: string, { token, syntax }: ReferenceMention): boolean {
  if (syntax === 'kling-omni') {
    // Match exactly the aliases normalized for submission, without modifying stored prose.
    return normalizeKlingOmniPromptReferences(prompt).includes(normalizeKlingOmniPromptReferences(token));
  }
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w])${escaped}(?![\\w])`).test(prompt);
}

/** Do not rewrite prose. Require review before an existing token can acquire another asset. */
export function changedReferenceMentions(prompt: string, previous: ReferenceMention[], current: ReferenceMention[]): string[] {
  return [...new Set(previous.filter((before) => containsMention(prompt, before)
    && !current.some((after) => after.token === before.token && after.identity === before.identity)).map(({ token }) => token))];
}

export function insertReferenceMention(prompt: string, token: string, selectionStart = prompt.length, selectionEnd = selectionStart) {
  const start = Math.max(0, Math.min(prompt.length, selectionStart));
  const end = Math.max(start, Math.min(prompt.length, selectionEnd));
  const before = prompt.slice(0, start);
  const after = prompt.slice(end);
  const inserted = `${before && !/\s$/.test(before) ? ' ' : ''}${token}${after && /^\s/.test(after) ? '' : ' '}`;
  return { text: before + inserted + after, caret: before.length + inserted.length };
}

export function selectedReferenceLabel(engine: EngineCaps, field: EngineInputField, kind: ComposerAttachment['kind'], sequence: number, locale: string, source = false): string {
  if (engine.activeVideoOperation === 'h3-recast' && field.id === 'reference_image_urls') return `${locale === 'es' ? 'Retrato' : 'Portrait'} ${sequence}`;
  if (engine.activeVideoOperation === 'h3-relight' && field.id === 'reference_image_url') return locale === 'fr' ? 'Éclairage' : locale === 'es' ? 'Iluminación' : 'Lighting';
  if (source && !field.description?.includes('@Video1')) {
    const label = locale === 'fr' ? 'Vidéo source' : locale === 'es' ? 'Vídeo fuente' : 'Source video';
    return (field.maxCount ?? 1) > 1 ? `${label} ${sequence}` : label;
  }
  const label = kind === 'image' ? locale === 'es' ? 'Imagen' : 'Image' : kind === 'video' ? locale === 'fr' ? 'Vidéo' : locale === 'es' ? 'Vídeo' : 'Video' : 'Audio';
  return `${label} ${sequence}`;
}

export function referenceMentionCopy(locale: string) {
  return locale === 'fr' ? {
    insert: (token: string) => `Insérer ${token} dans le prompt`,
    changed: 'Les médias associés à ces mentions ont changé. Vérifiez le prompt et les références avant de générer.',
    reviewed: 'J’ai vérifié les références',
    portraits: 'Les portraits remplacent les personnes de gauche à droite dans chaque plan.',
  } : locale === 'es' ? {
    insert: (token: string) => `Insertar ${token} en el prompt`,
    changed: 'Los medios asociados a estas menciones han cambiado. Revisa el prompt y las referencias antes de generar.',
    reviewed: 'He revisado las referencias',
    portraits: 'Los retratos sustituyen a las personas de izquierda a derecha en cada plano.',
  } : {
    insert: (token: string) => `Insert ${token} into the prompt`,
    changed: 'The media linked to these mentions changed. Review the prompt and references before generating.',
    reviewed: 'I reviewed the references',
    portraits: 'Portraits replace people from left to right in each shot.',
  };
}
