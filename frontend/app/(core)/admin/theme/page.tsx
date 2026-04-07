import { Layers3, MoonStar, PaintBucket, SlidersHorizontal } from 'lucide-react';
import { notFound } from 'next/navigation';
import { ThemeTokensEditor } from '@/components/admin/ThemeTokensEditor';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { ButtonLink } from '@/components/ui/Button';
import { THEME_TOKEN_DEFS, THEME_TOKEN_GROUPS } from '@/lib/theme-tokens';
import { requireAdmin } from '@/server/admin';
import { getThemeTokensSetting } from '@/server/app-settings';

export const dynamic = 'force-dynamic';

export default async function AdminThemeTokensPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/theme] access denied', error);
    notFound();
  }

  const setting = await getThemeTokensSetting();
  const metrics = buildThemeMetrics(setting);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Brand system"
        title="Theme tokens"
        description="Surface de pilotage des tokens globaux. Utilise le preview light ou dark pour contrôler contraste, densité et cohérence avant publication."
        actions={
          <>
            <ButtonLink href="/admin/system" variant="outline" size="sm" className="border-border bg-surface">
              Service notice
            </ButtonLink>
            <ButtonLink href="/admin/home" variant="outline" size="sm" className="border-border bg-surface">
              Homepage
            </ButtonLink>
            <ButtonLink href="/admin/audit?action=THEME_TOKENS_UPDATE" variant="outline" size="sm" className="border-border bg-surface">
              Audit
            </ButtonLink>
          </>
        }
      />

      <AdminSection
        title="Theme Pulse"
        description="Lecture courte du niveau de personnalisation déjà chargé pour les modes light et dark."
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
      </AdminSection>

      <AdminNotice tone="info">
        Le preview applique les changements immédiatement sur cette page. Sauvegarde uniquement quand le contraste et les états light/dark sont validés visuellement.
      </AdminNotice>

      <ThemeTokensEditor initialSetting={setting} embedded />
    </div>
  );
}

function buildThemeMetrics(setting: Awaited<ReturnType<typeof getThemeTokensSetting>>): AdminMetricItem[] {
  const lightOverrides = Object.keys(setting.light).length;
  const darkOverrides = Object.keys(setting.dark).length;
  const touchedGroups = new Set(
    Object.keys({ ...setting.light, ...setting.dark })
      .map((key) => THEME_TOKEN_DEFS.find((token) => token.key === key)?.group)
      .filter((value): value is string => Boolean(value))
  ).size;
  const advancedOverrides = new Set(
    Object.keys({ ...setting.light, ...setting.dark }).filter((key) =>
      THEME_TOKEN_DEFS.some((token) => token.key === key && token.advanced)
    )
  ).size;

  return [
    {
      label: 'Light overrides',
      value: String(lightOverrides),
      helper: lightOverrides ? 'Custom values active in light mode' : 'Using baseline palette',
      icon: PaintBucket,
    },
    {
      label: 'Dark overrides',
      value: String(darkOverrides),
      helper: darkOverrides ? 'Dark mode diverges from defaults' : 'No dark-specific changes saved',
      icon: MoonStar,
    },
    {
      label: 'Groups touched',
      value: String(touchedGroups),
      helper: `${THEME_TOKEN_GROUPS.length} groups available in the token catalog`,
      icon: Layers3,
    },
    {
      label: 'Advanced tokens',
      value: String(advancedOverrides),
      helper: advancedOverrides ? 'Low-level tuning is already in play' : 'Only core design tokens are customized',
      tone: advancedOverrides ? 'info' : 'default',
      icon: SlidersHorizontal,
    },
  ];
}
