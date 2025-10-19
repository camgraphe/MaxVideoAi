import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { getConfiguredEngines } from '@/server/engines';
import { ensureEngineSettingsSeed, fetchEngineSettings } from '@/server/engine-settings';
import { fetchEngineOverrides } from '@/server/engine-overrides';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    const engines = await getConfiguredEngines(true);
    return NextResponse.json({
      ok: true,
      engines: engines.map((engine) => ({
        engine,
        disabled: false,
        override: null,
        settings: null,
      })),
    });
  }

  await ensureEngineSettingsSeed();
  const [engines, settingsMap, overrideMap] = await Promise.all([
    getConfiguredEngines(true),
    fetchEngineSettings(),
    fetchEngineOverrides(),
  ]);

  const payload = engines.map((engine) => {
    const override = overrideMap.get(engine.id) ?? null;
    const disabled = override?.active === false || false;
    const settings = settingsMap.get(engine.id) ?? null;
    return {
      engine,
      disabled,
      override: override
        ? {
            active: override.active,
            availability: override.availability,
            status: override.status,
            latencyTier: override.latency_tier,
          }
        : null,
      settings,
    };
  });

  return NextResponse.json({ ok: true, engines: payload });
}
