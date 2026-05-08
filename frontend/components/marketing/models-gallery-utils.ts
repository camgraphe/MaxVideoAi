import {
  AudioLines,
  Circle,
  Frame,
  ImageIcon,
  Music2,
  Repeat2,
  Sparkles,
  Video,
  type LucideIcon,
} from 'lucide-react';

const CTA_ARROW = '→';

export function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

export function normalizeCtaLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed.length || trimmed.toLowerCase().startsWith('explore')) {
    return `Full details ${CTA_ARROW}`;
  }
  return trimmed.endsWith(CTA_ARROW) ? trimmed : `${trimmed} ${CTA_ARROW}`;
}

export function getCapabilityIcon(capability: string): LucideIcon {
  const normalized = capability.toLowerCase();
  if (normalized === 't2v') return Video;
  if (normalized === 'i2v') return ImageIcon;
  if (normalized === 'v2v') return Repeat2;
  if (normalized.includes('first')) return Frame;
  if (normalized.includes('extend')) return Sparkles;
  if (normalized.includes('lip')) return Music2;
  if (normalized.includes('audio')) return AudioLines;
  return Circle;
}
