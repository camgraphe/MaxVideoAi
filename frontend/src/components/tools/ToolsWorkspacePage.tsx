'use client';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ToolboxCatalogue } from './ToolboxCatalogue';

export default function ToolsPage() {
  const { loading } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale, t } = useI18n();
  return <div className="flex min-h-screen flex-col bg-bg">
    <HeaderBar />
    <div className="flex flex-1 min-w-0 flex-col md:flex-row">
      <AppSidebar />
      <main className="app-scroll-surface min-w-0 flex-1 overflow-y-auto" aria-busy={loading}>
        {FEATURES.workflows.toolsSection ? <ToolboxCatalogue locale={locale} /> : <div className="p-8"><h1>{String(t('workspace.tools.disabledTitle') || 'Tools are unavailable')}</h1><p>{String(t('workspace.tools.disabledBody') || 'Please check back later.')}</p></div>}
      </main>
    </div>
  </div>;
}
