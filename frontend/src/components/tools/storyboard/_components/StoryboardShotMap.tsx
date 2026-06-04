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
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted dark:text-white/[0.50]">{title}</p>
          <h3 className="mt-1 text-base font-semibold text-text-primary dark:text-white/[0.92]">{emptyTitle}</h3>
          <p className="mt-1 max-w-2xl text-xs text-text-secondary dark:text-white/[0.62]">{emptyBody}</p>
        </div>
        <div className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold text-text-secondary dark:border-white/[0.12] dark:bg-white/[0.045] dark:text-white/[0.68]">
          {plan.shots.length} panels
        </div>
      </div>
      <div className="grid flex-1 auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plan.shots.map((shot) => (
          <article key={shot.id} className="flex min-h-[150px] flex-col rounded-card border border-border bg-surface p-3 dark:border-white/[0.10] dark:bg-white/[0.035]">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-micro text-text-muted dark:text-white/[0.45]">Panel {shot.panel}</p>
                <h4 className="mt-1 text-sm font-semibold text-text-primary dark:text-white/[0.92]">{shot.title}</h4>
              </div>
              <span className="rounded-full border border-border bg-bg px-2 py-1 text-[10px] font-medium text-text-secondary dark:border-white/[0.12] dark:bg-white/[0.045] dark:text-white/[0.62]">
                {shot.panel}
              </span>
            </div>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="font-semibold text-text-muted dark:text-white/[0.48]">Framing</dt>
                <dd className="mt-0.5 text-text-secondary dark:text-white/[0.62]">{shot.framing}</dd>
              </div>
              <div>
                <dt className="font-semibold text-text-muted dark:text-white/[0.48]">Beat</dt>
                <dd className="mt-0.5 text-text-secondary dark:text-white/[0.62]">{shot.actionBeat}</dd>
              </div>
              <div>
                <dt className="font-semibold text-text-muted dark:text-white/[0.48]">Priority</dt>
                <dd className="mt-0.5 text-text-secondary dark:text-white/[0.62]">{shot.visualPriority}</dd>
              </div>
              {shot.dialogueBeat ? (
                <div className="rounded-input border border-brand/20 bg-brand/5 px-2 py-1.5 dark:border-white/[0.16] dark:bg-white/[0.055]">
                  <dt className="font-semibold text-text-muted dark:text-white/[0.48]">Dialogue</dt>
                  <dd className="mt-0.5 text-text-primary dark:text-white/[0.86]">{shot.dialogueBeat}</dd>
                </div>
              ) : null}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
