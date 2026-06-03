import type { StoryboardShotPlan } from '../_lib/storyboard-shot-plan';

type StoryboardShotMapProps = {
  emptyBody: string;
  emptyTitle: string;
  plan: StoryboardShotPlan;
  title: string;
};

export function StoryboardShotMap({ emptyBody, emptyTitle, plan, title }: StoryboardShotMapProps) {
  return (
    <div className="flex h-full w-full flex-col p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{title}</p>
          <h3 className="mt-1 text-base font-semibold text-text-primary">{emptyTitle}</h3>
          <p className="mt-1 max-w-2xl text-xs text-text-secondary">{emptyBody}</p>
        </div>
        <div className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold text-text-secondary">
          {plan.shots.length} panels
        </div>
      </div>
      <div className="grid flex-1 auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plan.shots.map((shot) => (
          <article key={shot.id} className="flex min-h-[150px] flex-col rounded-card border border-border bg-surface p-3">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">Panel {shot.panel}</p>
                <h4 className="mt-1 text-sm font-semibold text-text-primary">{shot.title}</h4>
              </div>
              <span className="rounded-full border border-border bg-bg px-2 py-1 text-[10px] font-medium text-text-secondary">
                {shot.panel}
              </span>
            </div>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="font-semibold text-text-muted">Framing</dt>
                <dd className="mt-0.5 text-text-secondary">{shot.framing}</dd>
              </div>
              <div>
                <dt className="font-semibold text-text-muted">Beat</dt>
                <dd className="mt-0.5 text-text-secondary">{shot.actionBeat}</dd>
              </div>
              <div>
                <dt className="font-semibold text-text-muted">Priority</dt>
                <dd className="mt-0.5 text-text-secondary">{shot.visualPriority}</dd>
              </div>
              {shot.dialogueBeat ? (
                <div className="rounded-input border border-brand/20 bg-brand/5 px-2 py-1.5">
                  <dt className="font-semibold text-text-muted">Dialogue</dt>
                  <dd className="mt-0.5 text-text-primary">{shot.dialogueBeat}</dd>
                </div>
              ) : null}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
