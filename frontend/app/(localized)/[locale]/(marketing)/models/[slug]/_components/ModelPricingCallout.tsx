import { Link } from '@/i18n/navigation';
import type { ModelPricingCallout as ModelPricingCalloutData } from '../_lib/model-page-pricing-callouts';

export function ModelPricingCallout({ callout }: { callout: ModelPricingCalloutData | null }) {
  if (!callout) return null;

  return (
    <section className="rounded-[12px] border border-hairline bg-surface/85 px-5 py-4 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{callout.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">{callout.body}</p>
        </div>
        <Link href={callout.href} className="shrink-0 text-sm font-semibold text-brand hover:text-brandHover">
          {callout.linkLabel}
        </Link>
      </div>
    </section>
  );
}
