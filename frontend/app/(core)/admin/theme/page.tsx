import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { getThemeTokensSetting } from '@/server/app-settings';
import { ThemeTokensEditor } from '@/components/admin/ThemeTokensEditor';

export const dynamic = 'force-dynamic';

export default async function AdminThemeTokensPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/theme] access denied', error);
    notFound();
  }

  const setting = await getThemeTokensSetting();

  return (
    <div className="stack-gap-lg">
      <ThemeTokensEditor initialSetting={setting} />
    </div>
  );
}
