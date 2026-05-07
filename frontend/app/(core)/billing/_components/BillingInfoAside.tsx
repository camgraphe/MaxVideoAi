import type { BillingCopy } from '../_lib/billing-copy';
import type { MemberStatus } from '../_lib/billing-types';

type BillingInfoAsideProps = {
  copy: BillingCopy;
  member: MemberStatus | null;
};

export function BillingInfoAside({ copy, member }: BillingInfoAsideProps) {
  return (
    <aside className="space-y-4">
      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <h2 className="text-lg font-semibold text-text-primary">{copy.refunds.title}</h2>
        <ul className="mt-3 grid gap-2 text-sm text-text-secondary">
          {copy.refunds.points.map((point) => (
            <li key={point} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-text-primary">{copy.faq.title}</h3>
          <div className="mt-2 grid gap-2 text-sm text-text-secondary">
            {copy.faq.entries.map((entry, index) => (
              <p key={index}>
                <span className="font-medium text-text-primary">{entry.question}</span> {entry.answer}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <h2 className="text-lg font-semibold text-text-primary">{copy.membership.title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{copy.membership.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-bg px-2 py-1 text-xs text-text-secondary">
            {member?.tier ?? '--'}
          </span>
          <span className="rounded-full bg-surface-2 px-2 py-1 text-xs text-brand">
            {typeof member?.savingsPct === 'number'
              ? copy.membership.savingsChip.replace('{percent}', String(member.savingsPct))
              : '--'}
          </span>
        </div>
      </section>
    </aside>
  );
}
