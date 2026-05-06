import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Camera, UserRound } from 'lucide-react';
import type { EngineCaps } from '@/types/engines';
import type { DashboardCopy } from '../_lib/dashboard-copy';
import { MetricDot, SectionGlyph } from './DashboardGlyphs';

const DASHBOARD_TOOL_THUMB_SIZES = '104px';
const TOOL_CHARACTER_PREVIEW_URL = '/assets/tools/character-builder-workspace.png';
const TOOL_ANGLE_PREVIEW_URL = '/assets/tools/angle-workspace.png';

export function ToolsPanel({ copy }: { copy: DashboardCopy }) {
  const tools = [
    {
      href: '/app/tools/character-builder',
      title: copy.tools.characterTitle,
      body: copy.tools.characterBody,
      badge: copy.tools.characterBadge,
      imageUrl: TOOL_CHARACTER_PREVIEW_URL,
      Icon: UserRound,
    },
    {
      href: '/app/tools/angle',
      title: copy.tools.angleTitle,
      body: copy.tools.angleBody,
      badge: copy.tools.angleBadge,
      imageUrl: TOOL_ANGLE_PREVIEW_URL,
      Icon: Camera,
    },
  ];

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2.5">
          <SectionGlyph />
          <h3 className="text-lg font-semibold text-text-primary">{copy.tools.title}</h3>
        </div>
        <span className="rounded-pill border border-hairline bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-text-muted">
          {tools.length}
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm leading-5 text-text-secondary">{copy.tools.subtitle}</p>
        <div className="mt-3 flex flex-col gap-2">
          {tools.map(({ href, title, body, badge, imageUrl, Icon }) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className="group flex gap-3 rounded-input border border-hairline bg-surface-2/70 p-2.5 transition-colors hover:border-border-hover hover:bg-surface"
            >
              <div className="relative h-[74px] w-[104px] shrink-0 overflow-hidden rounded-[6px] bg-[#05070d]">
                <Image
                  src={imageUrl}
                  alt=""
                  fill
                  className="object-cover object-top transition-transform duration-200 group-hover:scale-[1.03]"
                  sizes={DASHBOARD_TOOL_THUMB_SIZES}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                      <span className="line-clamp-2">{title}</span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-4 text-text-muted">{body}</p>
                  </div>
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
                </div>
                <span className="mt-2 inline-flex rounded-pill border border-hairline bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                  {badge}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-hairline px-4 py-3">
        <Link href="/app/tools" prefetch={false} className="inline-flex items-center gap-2 text-xs font-semibold text-brand hover:underline">
          {copy.tools.allTools}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

export function EngineStatusCompact({
  copy,
  engines,
  enginesError,
}: {
  copy: DashboardCopy;
  engines: EngineCaps[];
  enginesError: unknown;
}) {
  if (enginesError) {
    return (
      <section className="overflow-hidden rounded-card border border-warning-border bg-surface shadow-card">
        <div className="flex items-center gap-2.5 border-b border-warning-border px-4 py-3">
          <SectionGlyph tone="warning" />
          <h3 className="text-lg font-semibold text-text-primary">{copy.engines.title}</h3>
        </div>
        <p className="px-4 py-3 text-sm text-warning">{copy.engines.error}</p>
      </section>
    );
  }

  const flagged = engines.filter((engine) => isEngineAlert(engine));

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2.5">
          <SectionGlyph tone="success" />
          <h3 className="text-lg font-semibold text-text-primary">{copy.engines.title}</h3>
        </div>
      </div>
      {flagged.length === 0 ? (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3 rounded-input border border-success-border bg-success-bg px-3 py-2.5">
            <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <MetricDot tone="success" />
              {copy.engines.allOk}
            </p>
            <span className="rounded-pill bg-surface px-2 py-1 text-[11px] font-semibold text-success">OK</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2 px-4 py-3">
          {flagged.map((engine) => (
            <div key={engine.id} className="flex items-center justify-between gap-3 rounded-input border border-hairline bg-surface-2/70 px-3 py-2 text-xs">
              <span className="min-w-0 truncate font-semibold text-text-primary">{engine.label}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-text-muted">
                <span>
                  {engine.status}
                  {typeof engine.queueDepth === 'number'
                    ? ` · ${copy.engines.queueLabel.replace('{count}', String(engine.queueDepth))}`
                    : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function isEngineAlert(engine: EngineCaps): boolean {
  const status = engine.status ?? 'live';
  const availability = engine.availability ?? 'available';
  const okStatus = status === 'live' || status === 'busy' || status === 'early_access';
  const okAvailability = availability === 'available' || availability === 'limited';
  return !(okStatus && okAvailability);
}

