import { FEATURES } from '@/content/feature-flags';
import type { AppGlyphName } from './AppGlyph';

type NavItemDefinition = {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: string | null;
  badgeKey?: string | null;
};

export const NAV_ITEMS: readonly NavItemDefinition[] = [
  { id: 'dashboard', label: 'Dashboard', badge: null, icon: 'dashboard', href: '/dashboard' },
  { id: 'generate', label: 'Generate Video', badge: null, icon: 'generate', href: '/app' },
  { id: 'generate-image', label: 'Generate Image', badge: null, icon: 'generate-image', href: '/app/image' },
  { id: 'generate-audio', label: 'Generate Audio', badge: null, icon: 'generate-audio', href: '/app/audio' },
  ...(FEATURES.studio.maxVideoAiEditor ? [{ id: 'studio', label: 'Studio', badge: null, icon: 'generate', href: '/app/studio/projects' }] : []),
  ...(FEATURES.workflows.toolsSection
    ? [{ id: 'tools', label: 'Tools', badge: null, icon: 'tools', href: '/app/tools' }]
    : []),
  { id: 'library', label: 'Media', badge: null, icon: 'library', href: '/app/library' },
  { id: 'jobs', label: 'History', badge: null, icon: 'jobs', href: '/jobs' },
  { id: 'billing', label: 'Billing', badge: null, icon: 'billing', href: '/billing' },
  { id: 'settings', label: 'Settings', badge: null, icon: 'settings', href: '/settings' }
];

export type AppPrimary = 'create' | 'studio' | 'media' | 'tools' | 'activity' | 'account';
export type AppActivity = 'video' | 'image' | 'audio';
export type AppNavItem = { id: string; label: string; href: string; glyph: AppGlyphName };

export const APP_ACTIVITIES: readonly AppNavItem[] = [
  { id: 'video', label: 'Video', href: '/app', glyph: 'video' },
  { id: 'image', label: 'Image', href: '/app/image', glyph: 'image' },
  { id: 'audio', label: 'Audio', href: '/app/audio', glyph: 'audio' },
];
const PRIMARY_ITEMS: readonly (AppNavItem & { id: AppPrimary })[] = [
  { id: 'create', label: 'Create', href: '/app', glyph: 'create' },
  ...(FEATURES.studio.maxVideoAiEditor
    ? [{ id: 'studio' as const, label: 'Studio', href: '/app/studio/projects', glyph: 'studio' as const }]
    : []),
  { id: 'media', label: 'Media', href: '/app/library', glyph: 'library' },
  { id: 'tools', label: 'Tools', href: '/app/tools', glyph: 'tools' },
  { id: 'activity', label: 'Activity', href: '/jobs', glyph: 'prompt' },
  { id: 'account', label: 'Account', href: '/settings', glyph: 'settings' },
];
const TOOL_ITEMS: readonly AppNavItem[] = [
  { id: 'character-builder', label: 'Character Builder', href: '/app/tools/character-builder', glyph: 'reference' },
  { id: 'storyboard', label: 'Storyboard', href: '/app/tools/storyboard', glyph: 'image' },
  { id: 'angle', label: 'Angle / Perspective', href: '/app/tools/angle', glyph: 'image' },
  { id: 'upscale', label: 'Upscale', href: '/app/tools/upscale', glyph: 'image' },
  { id: 'background-removal', label: 'Background Remover', href: '/app/tools/background-removal', glyph: 'video' },
  { id: 'restore-video', label: 'Restore Video', href: '/app/tools/restore-video', glyph: 'video' },
  { id: 'denoise', label: 'Denoise Video', href: '/app/tools/denoise', glyph: 'video' },
  { id: 'fix-blur', label: 'Fix Motion Blur', href: '/app/tools/fix-blur', glyph: 'video' },
  { id: 'smooth-motion', label: 'Smooth Motion', href: '/app/tools/smooth-motion', glyph: 'video' },
];
export function canShowStudioNavigation(isAdmin: boolean): boolean {
  return FEATURES.studio.maxVideoAiEditor && (!FEATURES.studio.adminOnly || isAdmin);
}
export function getAppNavigation(
  toolsEnabled: boolean = FEATURES.workflows.toolsSection,
  studioVisible: boolean = canShowStudioNavigation(false),
) {
  return PRIMARY_ITEMS.filter((item) => (
    (toolsEnabled || item.id !== 'tools') && (studioVisible || item.id !== 'studio')
  ));
}
export function getAppMenuItems(
  toolsEnabled: boolean = FEATURES.workflows.toolsSection,
  studioVisible: boolean = canShowStudioNavigation(false),
): readonly AppNavItem[] {
  return [
    { id: 'dashboard', label: 'Dashboard', href: '/dashboard', glyph: 'library' },
    ...APP_ACTIVITIES,
    ...(studioVisible && FEATURES.studio.maxVideoAiEditor
      ? [{ id: 'studio', label: 'Studio', href: '/app/studio/projects', glyph: 'studio' as const }]
      : []),
    ...(toolsEnabled ? [...PRIMARY_ITEMS.filter((item) => item.id === 'tools'), ...TOOL_ITEMS] : []),
    { id: 'library', label: 'Media', href: '/app/library', glyph: 'library' },
    { id: 'jobs', label: 'History', href: '/jobs', glyph: 'prompt' },
    { id: 'billing', label: 'Billing', href: '/billing', glyph: 'wallet' },
    { id: 'settings', label: 'Settings', href: '/settings', glyph: 'settings' },
    { id: 'connections', label: 'Connections', href: '/account/connections', glyph: 'connect' },
  ];
}
export function getAppNavigationSelection(
  pathname: string | null | undefined,
  toolsEnabled: boolean = FEATURES.workflows.toolsSection,
  studioVisible: boolean = canShowStudioNavigation(false),
): { primary: AppPrimary | null; activity: AppActivity | null } {
  const path = pathname?.replace(/\/+$/, '') || '/';
  const matches = (href: string) => path === href || path.startsWith(`${href}/`);
  if (matches('/app/studio')) return { primary: studioVisible ? 'studio' : null, activity: null };
  if (matches('/app/library')) return { primary: 'media', activity: null };
  if (matches('/app/tools')) return { primary: toolsEnabled ? 'tools' : null, activity: null };
  if (matches('/jobs')) return { primary: 'activity', activity: null };
  if (['/dashboard', '/settings', '/account/connections', '/billing'].some(matches)) return { primary: 'account', activity: null };
  const activity = path === '/app' ? 'video' : matches('/app/image') ? 'image' : matches('/app/audio') ? 'audio' : null;
  return { primary: activity ? 'create' : null, activity };
}

const LOCAL_LABELS: Record<string, [string, string]> = {
  create: ['Créer', 'Crear'], media: ['Médias', 'Medios'], tools: ['Outils', 'Herramientas'], activity: ['Activité', 'Actividad'], account: ['Compte', 'Cuenta'],
  studio: ['Studio', 'Studio'],
  video: ['Vidéo', 'Vídeo'], image: ['Image', 'Imagen'], audio: ['Audio', 'Audio'], dashboard: ['Tableau de bord', 'Panel'], library: ['Médias', 'Medios'], jobs: ['Historique', 'Historial'], billing: ['Facturation', 'Facturación'], settings: ['Paramètres', 'Ajustes'], connections: ['Connexions', 'Conexiones'],
  'character-builder': ['Créateur de personnages', 'Creador de personajes'], storyboard: ['Storyboard', 'Guion gráfico'], angle: ['Angle / Perspective', 'Ángulo / Perspectiva'], upscale: ['Améliorer la résolution', 'Mejorar resolución'], 'background-removal': ['Supprimer le fond', 'Eliminar fondo'],
  'restore-video': ['Restaurer une vidéo', 'Restaurar vídeo'], denoise: ['Débruiter une vidéo', 'Reducir ruido'], 'fix-blur': ['Corriger le flou', 'Corregir desenfoque'], 'smooth-motion': ['Fluidifier une vidéo', 'Suavizar movimiento'],
};
export function appNavLabel(item: Pick<AppNavItem, 'id' | 'label'>, locale: string): string {
  return (locale === 'fr' ? LOCAL_LABELS[item.id]?.[0] : locale === 'es' ? LOCAL_LABELS[item.id]?.[1] : undefined) ?? item.label;
}
